//! Windows: Windows Graphics Capture of the live window by its HWND — the same
//! capture library the NDI output uses on Windows. WGC hands frames over as GPU
//! textures at the window's physical size; the GPU's video processor scales
//! them to the tier's size and converts them to NV12 (see `d3d_nv12`), so the
//! CPU only copies finished frames and the encoder needs no scaling or colour
//! conversion of its own.

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

use super::{Sink, StreamQuality, Target, LIVE_WINDOW_LABEL};
use crate::d3d_nv12::Nv12Converter;

pub(super) struct NativeTarget {
  window: Window,
}

pub(super) type NativeCapture = CaptureControl<FrameHandler, String>;

pub(super) fn source_height(app: &AppHandle) -> Option<u32> {
  app.get_webview_window(LIVE_WINDOW_LABEL)?.outer_size().ok().map(|size| size.height)
}

pub(super) fn locate(app: &AppHandle, quality: StreamQuality) -> Result<Target, String> {
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
  // The GPU scales to the tier's height whatever the window's size (a
  // smaller window is upscaled, which the picker warns about).
  let aspect =
    if size.height > 0 { size.width as f64 / size.height as f64 } else { 16.0 / 9.0 };
  let (width, height) = (quality.width_for(aspect), quality.height);
  log::info!(
    "capturing live window {}x{} → {width}x{height} NV12 on the GPU",
    size.width,
    size.height
  );
  Ok(Target { native: NativeTarget { window }, width, height })
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
    MinimumUpdateIntervalSettings::Custom(Duration::from_secs_f64(1.0 / sink.fps.max(1) as f64))
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
    sink,
  );
  FrameHandler::start_free_threaded(settings)
    .map_err(|e| format!("Could not start live window capture ({e})."))
}

pub(super) fn stop(control: NativeCapture) {
  let _ = control.stop();
}

pub(super) struct FrameHandler {
  sink: Arc<Sink>,
  /// Rebuilt when the window's size changes (a resize or a display-scale
  /// change alters the physical size WGC delivers).
  converter: Option<Nv12Converter>,
}

impl GraphicsCaptureApiHandler for FrameHandler {
  type Flags = Arc<Sink>;
  type Error = String;

  fn new(context: Context<Self::Flags>) -> Result<Self, Self::Error> {
    Ok(Self { sink: context.flags, converter: None })
  }

  fn on_frame_arrived(
    &mut self,
    frame: &mut Frame,
    _capture_control: InternalCaptureControl,
  ) -> Result<(), Self::Error> {
    let (source_width, source_height) = (frame.width(), frame.height());
    if source_width < 2 || source_height < 2 {
      self.sink.reject(format!("empty frame {source_width}x{source_height}"));
      return Ok(());
    }
    if self.converter.as_ref().is_none_or(|c| !c.takes(source_width, source_height)) {
      match Nv12Converter::new(
        frame.device(),
        frame.device_context(),
        source_width,
        source_height,
        self.sink.width,
        self.sink.height,
        self.sink.fps,
      ) {
        Ok(converter) => self.converter = Some(converter),
        Err(error) => {
          self.sink.fail(error);
          return Ok(());
        }
      }
    }
    let Some(converter) = self.converter.as_mut() else { return Ok(()) };
    let mut packed = self.sink.buffer();
    let converted = converter
      .convert(frame.as_raw_texture())
      .and_then(|_| converter.read_packed(&mut packed));
    match converted {
      Ok(()) => self.sink.publish(packed),
      Err(error) => self.sink.reject(error),
    }
    Ok(())
  }

  fn on_closed(&mut self) -> Result<(), Self::Error> {
    self.sink.fail("Windows stopped capturing the live output window.".into());
    Ok(())
  }
}
