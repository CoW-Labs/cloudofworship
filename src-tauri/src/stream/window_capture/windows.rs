//! Windows: Windows Graphics Capture of the live window by its HWND — the same
//! capture library the NDI output uses on Windows. WGC hands frames over at
//! the window's physical size; they're box-downscaled by an integer factor
//! (e.g. 4K → 1080p) and packed for the encoder, which does the final scale.

use std::ffi::c_void;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::{GraphicsCaptureApi, InternalCaptureControl};
use windows_capture::settings::{
  ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
  MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::window::Window;

use super::{pack_frame, Sink, Target, LIVE_WINDOW_LABEL};

/// Frames taller than this are downscaled by an integer factor before they're
/// piped to the encoder, to keep the pipe at a sane data rate.
const MAX_PIPE_HEIGHT: u32 = 1080;

pub(super) struct NativeTarget {
  window: Window,
  factor: u32,
}

pub(super) type NativeCapture = CaptureControl<FrameHandler, String>;

pub(super) fn locate(app: &AppHandle) -> Result<Target, String> {
  if !GraphicsCaptureApi::is_supported().unwrap_or(false) {
    return Err("Streaming the live window needs Windows 10 version 1903 or newer.".into());
  }
  let webview = app
    .get_webview_window(LIVE_WINDOW_LABEL)
    .ok_or("Open the live output window first, then go live.")?;
  let hwnd = webview
    .hwnd()
    .map_err(|e| format!("Could not access the live window ({e})."))?;
  let window = Window::from_raw_hwnd(hwnd.0 as *mut c_void);
  if !window.is_valid() {
    return Err("The live output window isn't available for capture.".into());
  }
  let size = webview
    .outer_size()
    .map_err(|e| format!("Could not read the live window size ({e})."))?;
  let factor = size.height.div_ceil(MAX_PIPE_HEIGHT).max(1);
  let width = (size.width / factor).max(2) & !1;
  let height = (size.height / factor).max(2) & !1;
  log::info!(
    "capturing live window {}x{} → {width}x{height}",
    size.width,
    size.height
  );
  Ok(Target { native: NativeTarget { window, factor }, width, height })
}

pub(super) fn start(target: NativeTarget, sink: Arc<Sink>) -> Result<NativeCapture, String> {
  let cursor = if GraphicsCaptureApi::is_cursor_settings_supported().unwrap_or(false) {
    CursorCaptureSettings::WithoutCursor
  } else {
    CursorCaptureSettings::Default
  };
  let border = if GraphicsCaptureApi::is_border_settings_supported().unwrap_or(false) {
    DrawBorderSettings::WithoutBorder
  } else {
    DrawBorderSettings::Default
  };
  let secondary = if GraphicsCaptureApi::is_secondary_windows_supported().unwrap_or(false) {
    SecondaryWindowSettings::Exclude
  } else {
    SecondaryWindowSettings::Default
  };
  let interval = if GraphicsCaptureApi::is_minimum_update_interval_supported().unwrap_or(false) {
    MinimumUpdateIntervalSettings::Custom(Duration::from_secs_f64(1.0 / 30.0))
  } else {
    MinimumUpdateIntervalSettings::Default
  };
  let settings = Settings::new(
    target.window,
    cursor,
    border,
    secondary,
    interval,
    DirtyRegionSettings::Default,
    ColorFormat::Bgra8,
    (sink, target.factor),
  );
  FrameHandler::start_free_threaded(settings)
    .map_err(|e| format!("Could not start live window capture ({e})."))
}

pub(super) fn stop(control: NativeCapture) {
  let _ = control.stop();
}

pub(super) struct FrameHandler {
  sink: Arc<Sink>,
  factor: u32,
}

impl GraphicsCaptureApiHandler for FrameHandler {
  type Flags = (Arc<Sink>, u32);
  type Error = String;

  fn new(context: Context<Self::Flags>) -> Result<Self, Self::Error> {
    let (sink, factor) = context.flags;
    Ok(Self { sink, factor })
  }

  fn on_frame_arrived(
    &mut self,
    frame: &mut Frame,
    _capture_control: InternalCaptureControl,
  ) -> Result<(), Self::Error> {
    let mut buffer = match frame.buffer() {
      Ok(buffer) => buffer,
      Err(error) => {
        self.sink.reject(format!("buffer: {error}"));
        return Ok(());
      }
    };
    let (source_width, source_height) = (buffer.width(), buffer.height());
    let stride = buffer.row_pitch() as usize;
    let packed = pack_frame(
      buffer.as_raw_buffer(),
      stride,
      source_width,
      source_height,
      self.factor,
      self.sink.width,
      self.sink.height,
    );
    self.sink.publish(packed);
    Ok(())
  }

  fn on_closed(&mut self) -> Result<(), Self::Error> {
    self.sink.fail("Windows stopped capturing the live output window.".into());
    Ok(())
  }
}
