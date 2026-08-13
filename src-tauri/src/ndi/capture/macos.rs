use std::process::Command;
use std::sync::atomic::Ordering;
use std::sync::mpsc;

use core_graphics::access::ScreenCaptureAccess;
use objc2::runtime::AnyObject;
use screencapturekit::cv::CVPixelBufferLockFlags;
use screencapturekit::prelude::*;
use screencapturekit::stream::delegate_trait::ErrorHandler;
use tauri::Manager;

use super::{ActiveCapture, CaptureContext, CaptureStarted};
use crate::ndi::pipeline::fit_within;
use crate::ndi::status::{
  CapturePermission, NdiErrorCode, NdiErrorInfo, FRAME_RATE,
};

const LIVE_WINDOW_LABEL: &str = "live-output";
const LIVE_WINDOW_TITLE: &str = "Cloud of Worship - Live Output";
const MAX_WIDTH: u32 = 1920;
const MAX_HEIGHT: u32 = 1080;

struct MacCapture {
  stream: SCStream,
}

impl ActiveCapture for MacCapture {
  fn stop(&mut self) -> Result<(), NdiErrorInfo> {
    self.stream.stop_capture().map_err(|error| {
      NdiErrorInfo::new(
        NdiErrorCode::CaptureStopped,
        format!("ScreenCaptureKit could not stop cleanly: {error}"),
        true,
      )
    })
  }
}

pub fn start_capture(context: CaptureContext) -> Result<CaptureStarted, NdiErrorInfo> {
  let window = context
    .app
    .get_webview_window(LIVE_WINDOW_LABEL)
    .ok_or_else(|| {
      NdiErrorInfo::new(
        NdiErrorCode::LiveWindowMissing,
        "Open the live output window before starting NDI.",
        true,
      )
    })?;

  let permission = if macos_at_least(14, 4) {
    CapturePermission::NotRequired
  } else {
    let access = ScreenCaptureAccess;
    if access.preflight() {
      CapturePermission::Granted
    } else {
      let requested = access.request();
      return Err(
        NdiErrorInfo::new(
          if requested {
            NdiErrorCode::CapturePermissionRequired
          } else {
            NdiErrorCode::CapturePermissionDenied
          },
          "Screen Recording permission is required to capture the live output on this macOS version.",
          true,
        )
        .hint("Enable Cloud of Worship in Privacy & Security > Screen Recording, then restart the app."),
      );
    }
  };

  let native_number = appkit_window_number(&window)?;
  let outer_size = window.outer_size().map_err(|error| {
    NdiErrorInfo::new(
      NdiErrorCode::CaptureStartFailed,
      format!("Could not read the live window size: {error}"),
      true,
    )
  })?;
  let scale_factor = window.scale_factor().unwrap_or(1.0).max(1.0);
  let logical_width = outer_size.width as f64 / scale_factor;
  let logical_height = outer_size.height as f64 / scale_factor;

  let content = if macos_at_least(14, 4) {
    SCShareableContent::current_process()
  } else {
    SCShareableContent::get()
  }
  .map_err(|error| capture_error(format!("Could not enumerate capturable windows: {error}")))?;

  let process_id = std::process::id() as i32;
  let mut process_windows: Vec<SCWindow> = content
    .windows()
    .into_iter()
    .filter(|candidate| {
      candidate
        .owning_application()
        .is_some_and(|application| application.process_id() == process_id)
    })
    .collect();

  let frame_matches = |candidate: &SCWindow| {
    let frame = candidate.frame();
    (frame.size.width - logical_width).abs() <= 8.0
      && (frame.size.height - logical_height).abs() <= 8.0
  };
  let title_matches = |candidate: &SCWindow| {
    candidate.title().as_deref() == Some(LIVE_WINDOW_TITLE)
  };

  let selected_index = process_windows
    .iter()
    .position(|candidate| {
        native_number > 0
          && candidate.window_id() == native_number as u32
          && title_matches(candidate)
          && frame_matches(candidate)
    })
    .or_else(|| {
      let matches: Vec<_> = process_windows
        .iter()
        .enumerate()
        .filter(|(_, candidate)| title_matches(candidate) && frame_matches(candidate))
        .map(|(index, _)| index)
        .collect();
      (matches.len() == 1).then_some(matches[0])
    })
    .or_else(|| {
      let matches: Vec<_> = process_windows
        .iter()
        .enumerate()
        .filter(|(_, candidate)| frame_matches(candidate))
        .map(|(index, _)| index)
        .collect();
      (matches.len() == 1).then_some(matches[0])
    });

  let sc_window = match selected_index {
    Some(index) => process_windows.swap_remove(index),
    None if process_windows.is_empty() => {
      return Err(NdiErrorInfo::new(
        NdiErrorCode::LiveWindowMissing,
        "ScreenCaptureKit could not find the live output window.",
        true,
      ));
    }
    None => {
      return Err(
        NdiErrorInfo::new(
          NdiErrorCode::AmbiguousLiveWindow,
          "ScreenCaptureKit could not uniquely identify the live output window.",
          true,
        )
        .hint("Close duplicate Cloud of Worship windows and try again."),
      );
    }
  };

  let frame = sc_window.frame();
  let pixel_width = (frame.size.width * scale_factor).round().max(2.0) as u32;
  let pixel_height = (frame.size.height * scale_factor).round().max(2.0) as u32;
  let (target_width, target_height) = fit_within(pixel_width, pixel_height, MAX_WIDTH, MAX_HEIGHT);
  if target_width == 0 || target_height == 0 {
    return Err(NdiErrorInfo::new(
      NdiErrorCode::ScalingFailed,
      "The live output window has an invalid capture size.",
      true,
    ));
  }

  let filter = SCContentFilter::create()
    .with_window(&sc_window)
    .try_build()
    .map_err(|error| capture_error(format!("Could not create a window capture filter: {error}")))?;
  let interval = CMTime::new(1, FRAME_RATE as i32);
  let configuration = SCStreamConfiguration::new()
    .with_width(target_width)
    .with_height(target_height)
    .with_pixel_format(PixelFormat::BGRA)
    .with_scales_to_fit(true)
    .with_shows_cursor(false)
    .with_ignores_shadows_single_window(true)
    .with_queue_depth(3)
    .with_minimum_frame_interval(&interval);

  let stop_for_error = context.stop.clone();
  let mailbox_for_error = context.mailbox.clone();
  let status_for_error = context.status.clone();
  let delegate = ErrorHandler::new(move |error| {
    if !stop_for_error.swap(true, Ordering::AcqRel) {
      mailbox_for_error.close();
      status_for_error.fail(NdiErrorInfo::new(
        NdiErrorCode::CaptureStopped,
        format!("ScreenCaptureKit stopped unexpectedly: {error}"),
        true,
      ));
    }
  });
  let mut stream = SCStream::new_with_delegate(&filter, &configuration, delegate);
  let mailbox = context.mailbox.clone();
  let handler_id = stream.add_output_handler(
    move |sample: CMSampleBuffer, output_type: SCStreamOutputType| {
      if output_type != SCStreamOutputType::Screen {
        return;
      }
      let Some(buffer) = sample.image_buffer() else {
        return;
      };
      let Ok(guard) = buffer.lock(CVPixelBufferLockFlags::READ_ONLY) else {
        return;
      };
      let width = guard.width() as u32;
      let height = guard.height() as u32;
      let stride = guard.bytes_per_row();
      mailbox.publish(width, height, stride, guard.as_slice());
    },
    SCStreamOutputType::Screen,
  );
  if handler_id.is_none() {
    return Err(capture_error(
      "ScreenCaptureKit rejected the video output handler.",
    ));
  }
  stream
    .start_capture()
    .map_err(|error| capture_error(format!("Could not start ScreenCaptureKit: {error}")))?;

  Ok(CaptureStarted {
    handle: Box::new(MacCapture { stream }),
    permission,
  })
}

fn appkit_window_number(window: &tauri::WebviewWindow) -> Result<isize, NdiErrorInfo> {
  let pointer = window.ns_window().map_err(|error| {
    capture_error(format!("Could not access the native live window: {error}"))
  })? as usize;
  let (sender, receiver) = mpsc::sync_channel(1);
  window
    .run_on_main_thread(move || {
      let object = unsafe { &*(pointer as *const AnyObject) };
      let number: isize = unsafe { objc2::msg_send![object, windowNumber] };
      let _ = sender.send(number);
    })
    .map_err(|error| capture_error(format!("Could not query the AppKit window: {error}")))?;
  receiver
    .recv_timeout(std::time::Duration::from_secs(2))
    .map_err(|error| capture_error(format!("AppKit did not return the window number: {error}")))
}

fn macos_at_least(major: u32, minor: u32) -> bool {
  let Ok(output) = Command::new("/usr/bin/sw_vers")
    .args(["-productVersion"])
    .output()
  else {
    return false;
  };
  let version = String::from_utf8_lossy(&output.stdout);
  let mut parts = version.trim().split('.').filter_map(|part| part.parse::<u32>().ok());
  let installed_major = parts.next().unwrap_or(0);
  let installed_minor = parts.next().unwrap_or(0);
  (installed_major, installed_minor) >= (major, minor)
}

fn capture_error(message: impl Into<String>) -> NdiErrorInfo {
  NdiErrorInfo::new(NdiErrorCode::CaptureStartFailed, message, true)
}

pub fn open_capture_settings() -> Result<(), NdiErrorInfo> {
  Command::new("/usr/bin/open")
    .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
    .spawn()
    .map(|_| ())
    .map_err(|error| {
      NdiErrorInfo::new(
        NdiErrorCode::CapturePermissionRequired,
        format!("Could not open Screen Recording settings: {error}"),
        true,
      )
    })
}
