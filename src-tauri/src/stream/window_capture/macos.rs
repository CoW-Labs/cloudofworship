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

use super::vt_encoder::VtEncoder;
use super::{Sink, StreamQuality, Target, LIVE_WINDOW_LABEL};

/// ScreenCaptureKit scales into the configured size on the GPU, so frames come
/// out at the tier's size directly.

pub(super) type NativeTarget = SCWindow;
pub(super) type NativeCapture = SCStream;

pub(super) fn source_height(app: &AppHandle) -> Option<u32> {
  app.get_webview_window(LIVE_WINDOW_LABEL)?.outer_size().ok().map(|size| size.height)
}

pub(super) fn locate(app: &AppHandle, quality: StreamQuality) -> Result<Target, String> {
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
  let width = quality.width_for(aspect);
  let height = quality.height;

  // Prefer encoding on the GPU straight from capture surfaces. If this Mac
  // can't (no hardware encoder for the size), FFmpeg encodes from raw frames
  // instead, which is fine up to 1080p but not beyond.
  let encoder = match VtEncoder::new(width, height, quality) {
    Ok(encoder) => {
      log::info!("stream: hardware encoder ready for {width}x{height} @ {} fps", quality.fps);
      Some(Arc::new(encoder))
    }
    Err(reason) => {
      log::warn!("stream: in-process encoder unavailable ({reason}); encoding in FFmpeg");
      None
    }
  };
  if encoder.is_none() && height > 1080 {
    return Err(format!(
      "This Mac's hardware encoder can't take {width}x{height}. Choose 1080p or lower."
    ));
  }
  Ok(Target { native: found.clone(), width, height, encoder })
}

pub(super) fn start(window: SCWindow, sink: Arc<Sink>) -> Result<SCStream, String> {
  let (width, height) = (sink.width, sink.height);
  let filter = SCContentFilter::create()
    .with_window(&window)
    .try_build()
    .map_err(|e| format!("Could not set up live window capture ({e})."))?;
  let interval = CMTime::new(1, sink.fps as i32);
  // The hardware encoder takes NV12 (video range) as it comes, so the GPU does
  // the colour conversion and nothing converts on the CPU. The FFmpeg path
  // needs packed BGRA. Surfaces are kept until the next one replaces them, so
  // that mode gets a deeper queue to leave the capture room to work.
  let (pixel_format, queue_depth) =
    if sink.hardware { (PixelFormat::YCbCr_420v, 6) } else { (PixelFormat::BGRA, 3) };
  let mut configuration = SCStreamConfiguration::new()
    .with_width(width)
    .with_height(height)
    .with_pixel_format(pixel_format)
    .with_scales_to_fit(true)
    .with_shows_cursor(false)
    .with_ignores_shadows_single_window(true)
    .with_queue_depth(queue_depth)
    .with_minimum_frame_interval(&interval);
  if sink.hardware {
    // The encoder tags its output from the surfaces, and players assume
    // BT.709 for HD video, so say so rather than rely on a default.
    configuration.set_color_matrix("ITU_R_709_2");
  }

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
      if sink.hardware {
        if buffer.width() as u32 != width || buffer.height() as u32 != height {
          sink.reject(format!("{}x{} (want {width}x{height})", buffer.width(), buffer.height()));
          return;
        }
        // No copy: the encoder reads the capture's own surface.
        sink.publish_surface(buffer);
        return;
      }
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
      let mut packed = sink.buffer();
      packed.clear();
      packed.reserve(row * height as usize);
      if stride == row {
        packed.extend_from_slice(&data[..row * height as usize]);
      } else {
        for y in 0..height as usize {
          packed.extend_from_slice(&data[y * stride..y * stride + row]);
        }
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
