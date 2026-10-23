//! macOS: ScreenCaptureKit window capture. The window is found by its AppKit
//! window number, and off-screen windows are listed too: a full-screen live
//! window on its own desktop counts as "off screen" while the operator is on
//! another one.

use std::sync::{mpsc, Arc};
use std::time::Duration;

use objc2::runtime::AnyObject;
use screencapturekit::cm::{CMSampleBufferSCExt, SCFrameStatus};
use screencapturekit::cv::CVPixelBufferLockFlags;
use screencapturekit::prelude::*;
use screencapturekit::stream::delegate_trait::ErrorHandler;
use tauri::{AppHandle, Manager};

use super::{Sink, Target, LIVE_WINDOW_LABEL};

/// ScreenCaptureKit scales into the configured size, so frames come out at
/// the broadcast's 720p directly.
const OUTPUT_HEIGHT: u32 = 720;

pub(super) type NativeTarget = SCWindow;
pub(super) type NativeCapture = SCStream;

pub(super) fn locate(app: &AppHandle) -> Result<Target, String> {
  let window = app
    .get_webview_window(LIVE_WINDOW_LABEL)
    .ok_or("Open the live output window first, then go live.")?;
  let number = appkit_window_number(&window)? as u32;
  keep_rendering_when_hidden(&window);

  let content = SCShareableContent::create()
    .with_on_screen_windows_only(false)
    .get()
    .or_else(|_| SCShareableContent::current_process())
    .map_err(|e| {
      format!(
        "macOS refused to list windows for capture ({e}). Allow Cloud of Worship in \
         System Settings → Privacy & Security → Screen Recording, then restart the app."
      )
    })?;
  let windows = content.windows();
  let Some(found) = windows.iter().find(|w| w.window_id() == number) else {
    let pid = std::process::id() as i32;
    let ours: Vec<String> = windows
      .iter()
      .filter(|w| w.owning_application().is_some_and(|a| a.process_id() == pid))
      .map(|w| format!("#{} {:?} on_screen={}", w.window_id(), w.title(), w.is_on_screen()))
      .collect();
    log::warn!(
      "live window #{number} not in ScreenCaptureKit's list ({} windows; ours: {ours:?})",
      windows.len()
    );
    return Err(
      "macOS didn't offer the live output window for capture. Check Screen Recording \
       permission for Cloud of Worship, then try again."
        .into(),
    );
  };
  let frame = found.frame();
  log::info!(
    "capturing live window #{number} {:?} {}x{} on_screen={}",
    found.title(),
    frame.size.width,
    frame.size.height,
    found.is_on_screen()
  );

  let aspect = if frame.size.height > 0.0 { frame.size.width / frame.size.height } else { 16.0 / 9.0 };
  let width = ((OUTPUT_HEIGHT as f64 * aspect).round() as u32).max(2) & !1;
  Ok(Target { native: found.clone(), width, height: OUTPUT_HEIGHT })
}

pub(super) fn start(window: SCWindow, sink: Arc<Sink>) -> Result<SCStream, String> {
  let (width, height) = (sink.width, sink.height);
  let filter = SCContentFilter::create()
    .with_window(&window)
    .try_build()
    .map_err(|e| format!("Could not set up live window capture ({e})."))?;
  let interval = CMTime::new(1, 30);
  let configuration = SCStreamConfiguration::new()
    .with_width(width)
    .with_height(height)
    .with_pixel_format(PixelFormat::BGRA)
    .with_scales_to_fit(true)
    .with_shows_cursor(false)
    .with_ignores_shadows_single_window(true)
    .with_queue_depth(3)
    .with_minimum_frame_interval(&interval);

  let delegate = {
    let sink = sink.clone();
    ErrorHandler::new(move |error| {
      sink.fail(format!("Live window capture stopped unexpectedly ({error})."));
    })
  };
  let mut stream = SCStream::new_with_delegate(&filter, &configuration, delegate);
  let handler = stream.add_output_handler(
    move |sample: CMSampleBuffer, output_type: SCStreamOutputType| {
      if output_type != SCStreamOutputType::Screen {
        return;
      }
      // Idle/blank/suspended callbacks carry no new picture. Anything else with
      // pixels is usable — including frames whose status attachment is
      // missing, which is what macOS 26 sends for every frame.
      let status = sample.frame_status();
      if matches!(
        status,
        Some(SCFrameStatus::Idle | SCFrameStatus::Blank | SCFrameStatus::Suspended | SCFrameStatus::Stopped)
      ) {
        sink.reject(format!("{status:?}"));
        return;
      }
      let Some(buffer) = sample.image_buffer() else {
        sink.reject(format!("{status:?} without pixels"));
        return;
      };
      let Ok(guard) = buffer.lock(CVPixelBufferLockFlags::READ_ONLY) else {
        sink.reject(format!("{status:?} lock failed"));
        return;
      };
      if guard.width() as u32 != width || guard.height() as u32 != height {
        sink.reject(format!("{}x{} (want {width}x{height})", guard.width(), guard.height()));
        return;
      }
      let row = width as usize * 4;
      let stride = guard.bytes_per_row();
      let data = guard.as_slice();
      let mut packed = Vec::with_capacity(row * height as usize);
      for y in 0..height as usize {
        packed.extend_from_slice(&data[y * stride..y * stride + row]);
      }
      sink.publish(packed);
    },
    SCStreamOutputType::Screen,
  );
  if handler.is_none() {
    return Err("macOS rejected the live window capture output.".into());
  }
  stream
    .start_capture()
    .map_err(|e| format!("Could not start live window capture ({e})."))?;
  Ok(stream)
}

pub(super) fn stop(stream: SCStream) {
  let _ = stream.stop_capture();
}

/// WebKit stops painting a window it thinks nobody can see (covered, or full
/// screen on another desktop). Static slides survive that, but a playing video
/// freezes in the stream. This opts the live window out of WebKit's occlusion
/// detection (a WebKit SPI, so it's checked before use).
fn keep_rendering_when_hidden(window: &tauri::WebviewWindow) {
  let result = window.with_webview(|webview| {
    let view = unsafe { &*(webview.inner() as *const AnyObject) };
    let selector = objc2::sel!(_setWindowOcclusionDetectionEnabled:);
    let supported: bool = unsafe { objc2::msg_send![view, respondsToSelector: selector] };
    if supported {
      let _: () = unsafe { objc2::msg_send![view, _setWindowOcclusionDetectionEnabled: false] };
    }
    log::info!("live window keeps rendering when hidden: {supported}");
  });
  if let Err(e) = result {
    log::warn!("could not reach the live window's web view ({e})");
  }
}

fn appkit_window_number(window: &tauri::WebviewWindow) -> Result<isize, String> {
  let pointer = window
    .ns_window()
    .map_err(|e| format!("Could not access the live window ({e})."))? as usize;
  let (sender, receiver) = mpsc::sync_channel(1);
  window
    .run_on_main_thread(move || {
      let object = unsafe { &*(pointer as *const AnyObject) };
      let number: isize = unsafe { objc2::msg_send![object, windowNumber] };
      let _ = sender.send(number);
    })
    .map_err(|e| format!("Could not query the live window ({e})."))?;
  receiver
    .recv_timeout(Duration::from_secs(2))
    .map_err(|_| "The live window didn't respond.".to_string())
}
