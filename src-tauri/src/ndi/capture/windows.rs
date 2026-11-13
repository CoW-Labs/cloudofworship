use std::ffi::c_void;
use std::sync::atomic::Ordering;
use std::sync::{Condvar, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use tauri::Manager;
use windows::Win32::Graphics::Direct3D11::{ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D};
use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::{GraphicsCaptureApi, InternalCaptureControl};
use windows_capture::settings::{
  ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
  MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::window::Window;

use super::{ActiveCapture, CaptureContext, CaptureStarted};
use crate::d3d_nv12::Nv12Converter;
use crate::ndi::pipeline::{fit_within, FrameMailbox};
use crate::ndi::quality::NdiQuality;
use crate::ndi::status::{CapturePermission, NdiErrorCode, NdiErrorInfo, StatusSink};
use std::sync::{atomic::AtomicBool, Arc};

const LIVE_WINDOW_LABEL: &str = "live-output";

#[derive(Clone)]
struct CaptureFlags {
  quality: NdiQuality,
  mailbox: Arc<FrameMailbox>,
  stop: Arc<AtomicBool>,
  status: StatusSink,
}

struct WindowsFrameHandler {
  flags: CaptureFlags,
  reader: Option<D3dFrameReader>,
}

impl GraphicsCaptureApiHandler for WindowsFrameHandler {
  type Flags = CaptureFlags;
  type Error = NdiErrorInfo;

  fn new(context: Context<Self::Flags>) -> Result<Self, Self::Error> {
    Ok(Self {
      flags: context.flags,
      reader: None,
    })
  }

  fn on_frame_arrived(
    &mut self,
    frame: &mut Frame,
    _capture_control: InternalCaptureControl,
  ) -> Result<(), Self::Error> {
    if self.flags.stop.load(Ordering::Acquire) {
      return Ok(());
    }

    let source_width = frame.width();
    let source_height = frame.height();
    let (target_width, target_height) =
      fit_within(
        source_width,
        source_height,
        self.flags.quality.max_width,
        self.flags.quality.max_height,
      );
    if target_width == 0 || target_height == 0 {
      return Err(NdiErrorInfo::new(
        NdiErrorCode::ScalingFailed,
        "Windows Graphics Capture produced an invalid frame size.",
        true,
      ));
    }

    let needs_rebuild = self.reader.as_ref().is_none_or(|reader| {
      reader.source_width != source_width
        || reader.source_height != source_height
        || reader.target_width != target_width
        || reader.target_height != target_height
    });
    if needs_rebuild {
      // WGC reports physical pixels. A resize or DPI/display-scale change alters
      // these dimensions, so every dependent GPU resource is rebuilt together.
      self.reader = Some(D3dFrameReader::new(
        frame.device(),
        frame.device_context(),
        self.flags.clone(),
        source_width,
        source_height,
        target_width,
        target_height,
      )?);
    }
    self
      .reader
      .as_ref()
      .expect("reader was created")
      .capture_snapshot(frame.as_raw_texture());

    Ok(())
  }

  fn on_closed(&mut self) -> Result<(), Self::Error> {
    if !self.flags.stop.swap(true, Ordering::AcqRel) {
      self.flags.mailbox.close();
      self.flags.status.fail(NdiErrorInfo::new(
        NdiErrorCode::CaptureStopped,
        "Windows stopped capturing the live output window.",
        true,
      ));
    }
    Ok(())
  }
}

struct WindowsCapture {
  control: Option<CaptureControl<WindowsFrameHandler, NdiErrorInfo>>,
}

impl ActiveCapture for WindowsCapture {
  fn stop(&mut self) -> Result<(), NdiErrorInfo> {
    let Some(control) = self.control.take() else {
      return Ok(());
    };
    control.stop().map_err(|error| {
      NdiErrorInfo::new(
        NdiErrorCode::CaptureStopped,
        format!("Windows Graphics Capture could not stop cleanly: {error}"),
        true,
      )
    })
  }
}

pub fn start_capture(context: CaptureContext) -> Result<CaptureStarted, NdiErrorInfo> {
  let supported = GraphicsCaptureApi::is_supported().map_err(|error| {
    NdiErrorInfo::new(
      NdiErrorCode::CaptureStartFailed,
      format!("Could not query Windows Graphics Capture support: {error}"),
      true,
    )
  })?;
  if !supported {
    return Err(
      NdiErrorInfo::new(
        NdiErrorCode::UnsupportedOsVersion,
        "NDI live output requires Windows 10 version 1903 or newer.",
        false,
      )
      .hint("Update Windows, then try again."),
    );
  }

  let webview = context
    .app
    .get_webview_window(LIVE_WINDOW_LABEL)
    .ok_or_else(|| {
      NdiErrorInfo::new(
        NdiErrorCode::LiveWindowMissing,
        "Open the live output window before starting NDI.",
        true,
      )
    })?;
  let hwnd = webview.hwnd().map_err(|error| {
    NdiErrorInfo::new(
      NdiErrorCode::LiveWindowMissing,
      format!("Could not access the native live window: {error}"),
      true,
    )
  })?;
  let window = Window::from_raw_hwnd(hwnd.0 as *mut c_void);
  if !window.is_valid() {
    return Err(NdiErrorInfo::new(
      NdiErrorCode::LiveWindowMissing,
      "The live output window is not available for capture.",
      true,
    ));
  }

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
    MinimumUpdateIntervalSettings::Custom(Duration::from_secs_f64(1.0 / context.quality.fps as f64))
  } else {
    MinimumUpdateIntervalSettings::Default
  };
  let settings = Settings::new(
    window,
    cursor,
    border,
    secondary,
    interval,
    DirtyRegionSettings::Default,
    ColorFormat::Bgra8,
    CaptureFlags {
      quality: context.quality,
      mailbox: context.mailbox,
      stop: context.stop,
      status: context.status,
    },
  );

  let control = WindowsFrameHandler::start_free_threaded(settings).map_err(|error| {
    NdiErrorInfo::new(
      NdiErrorCode::CaptureStartFailed,
      format!("Could not start Windows Graphics Capture: {error}"),
      true,
    )
  })?;

  Ok(CaptureStarted {
    handle: Box::new(WindowsCapture {
      control: Some(control),
    }),
    permission: CapturePermission::NotRequired,
  })
}

pub fn open_capture_settings() -> Result<(), NdiErrorInfo> {
  Ok(())
}

// Capture retains one GPU snapshot. Scaling, colour conversion and CPU readback
// are admitted by the worker at the tier's frame rate, including on Windows
// without MinUpdateInterval. A new callback replaces this snapshot, so the last
// static frame is never discarded. The frame goes out as NV12, which the GPU
// produces while scaling: 3/8 the bytes of BGRA to read back and copy, and
// cheaper for the NDI runtime to compress.
struct ReadbackState {
  converter: Nv12Converter,
  dirty: bool,
  shutdown: bool,
}

struct D3dFrameReader {
  source_width: u32,
  source_height: u32,
  target_width: u32,
  target_height: u32,
  shared: Arc<(Mutex<ReadbackState>, Condvar)>,
  worker: Option<JoinHandle<()>>,
}

impl D3dFrameReader {
  fn new(
    device: &ID3D11Device,
    context: &ID3D11DeviceContext,
    flags: CaptureFlags,
    source_width: u32,
    source_height: u32,
    target_width: u32,
    target_height: u32,
  ) -> Result<Self, NdiErrorInfo> {
    let converter = Nv12Converter::new(
      device,
      context,
      source_width,
      source_height,
      target_width,
      target_height,
      flags.quality.fps,
    )
    .map_err(scaling_error)?;
    let shared = Arc::new((
      Mutex::new(ReadbackState { converter, dirty: false, shutdown: false }),
      Condvar::new(),
    ));
    let worker_shared = shared.clone();
    let worker = std::thread::Builder::new()
      .name("cow-ndi-readback".into())
      .spawn(move || {
        if let Err(error) = run_readback(&worker_shared, &flags, target_width, target_height) {
          if !flags.stop.swap(true, Ordering::AcqRel) {
            flags.mailbox.close();
            flags.status.fail(error);
          }
        }
      })
      .map_err(|error| scaling_error(format!("Could not start GPU readback: {error}")))?;
    Ok(Self {
      source_width,
      source_height,
      target_width,
      target_height,
      shared,
      worker: Some(worker),
    })
  }

  fn capture_snapshot(&self, source: &ID3D11Texture2D) {
    let (lock, changed) = &*self.shared;
    let mut state = lock.lock().unwrap_or_else(|p| p.into_inner());
    // All immediate-context access is serialized with the readback worker.
    // Copy while WGC still owns its frame; retaining only its texture after
    // returning would let the capture pool recycle pixels under the worker.
    state.converter.snapshot(source);
    state.dirty = true;
    changed.notify_one();
  }
}

impl Drop for D3dFrameReader {
  fn drop(&mut self) {
    let (lock, changed) = &*self.shared;
    lock.lock().unwrap_or_else(|p| p.into_inner()).shutdown = true;
    changed.notify_one();
    if let Some(worker) = self.worker.take() {
      let _ = worker.join();
    }
  }
}

fn run_readback(
  shared: &(Mutex<ReadbackState>, Condvar),
  flags: &CaptureFlags,
  width: u32,
  height: u32,
) -> Result<(), NdiErrorInfo> {
  let (lock, changed) = shared;
  let interval = Duration::from_secs_f64(1.0 / flags.quality.fps as f64);
  let mut next_capture = Instant::now();
  let mut state = lock.lock().unwrap_or_else(|p| p.into_inner());
  loop {
    if state.shutdown || flags.stop.load(Ordering::Acquire) {
      return Ok(());
    }

    // Collect every frame the GPU has finished, without waiting for the rest.
    while state
      .converter
      .poll_readback(|luma, luma_stride, chroma, chroma_stride| {
        flags.mailbox.publish_nv12(width, height, luma, luma_stride, chroma, chroma_stride)
      })
      .map_err(scaling_error)?
      .is_some()
    {}

    let now = Instant::now();
    if state.dirty && now >= next_capture && state.converter.can_submit() {
      state.converter.blit().map_err(scaling_error)?;
      state.converter.submit_readback();
      state.dirty = false;
      next_capture = now + interval;
    }

    let delay = if state.converter.has_pending() {
      Duration::from_millis(1)
    } else if state.dirty {
      next_capture.saturating_duration_since(Instant::now())
    } else {
      Duration::from_millis(100)
    };
    // Wait releases the mutex. Capture can replace its GPU snapshot while
    // readback is pending, without ever waiting for Map to finish on the GPU.
    state = changed.wait_timeout(state, delay).unwrap_or_else(|p| p.into_inner()).0;
  }
}

fn scaling_error(message: impl Into<String>) -> NdiErrorInfo {
  NdiErrorInfo::new(NdiErrorCode::ScalingFailed, message, true)
}
