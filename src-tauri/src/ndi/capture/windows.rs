use std::ffi::c_void;
use std::mem::ManuallyDrop;
use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::Manager;
use windows::core::Interface;
use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Direct3D11::{
  D3D11_BIND_RENDER_TARGET, D3D11_CPU_ACCESS_READ, D3D11_MAP_READ,
  D3D11_MAPPED_SUBRESOURCE, D3D11_TEX2D_VPIV, D3D11_TEX2D_VPOV,
  D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT, D3D11_USAGE_STAGING,
  D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE, D3D11_VIDEO_PROCESSOR_CONTENT_DESC,
  D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC, D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC_0,
  D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC, D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC_0,
  D3D11_VIDEO_PROCESSOR_STREAM, D3D11_VIDEO_USAGE_PLAYBACK_NORMAL,
  D3D11_VPIV_DIMENSION_TEXTURE2D, D3D11_VPOV_DIMENSION_TEXTURE2D,
  ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D, ID3D11VideoContext,
  ID3D11VideoDevice, ID3D11VideoProcessor, ID3D11VideoProcessorEnumerator,
  ID3D11VideoProcessorOutputView,
};
use windows::Win32::Graphics::Dxgi::Common::{
  DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_RATIONAL, DXGI_SAMPLE_DESC,
};
use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::{GraphicsCaptureApi, InternalCaptureControl};
use windows_capture::settings::{
  ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
  MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::window::Window;

use super::{ActiveCapture, CaptureContext, CaptureStarted};
use crate::ndi::pipeline::{fit_within, FrameMailbox};
use crate::ndi::status::{
  CapturePermission, NdiErrorCode, NdiErrorInfo, StatusSink,
};
use std::sync::{atomic::AtomicBool, Arc};

const LIVE_WINDOW_LABEL: &str = "live-output";
const MAX_WIDTH: u32 = 1920;
const MAX_HEIGHT: u32 = 1080;

#[derive(Clone)]
struct CaptureFlags {
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
      fit_within(source_width, source_height, MAX_WIDTH, MAX_HEIGHT);
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
        source_width,
        source_height,
        target_width,
        target_height,
      )?);
    }
    self.reader.as_ref().expect("reader was created").read(
      frame.as_raw_texture(),
      frame.device_context(),
      &self.flags.mailbox,
    )?;

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
    MinimumUpdateIntervalSettings::Custom(Duration::from_millis(33))
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

struct VideoScaleResources {
  source_width: u32,
  source_height: u32,
  target_width: u32,
  target_height: u32,
  video_device: ID3D11VideoDevice,
  enumerator: ID3D11VideoProcessorEnumerator,
  processor: ID3D11VideoProcessor,
  output: ID3D11Texture2D,
  output_view: ID3D11VideoProcessorOutputView,
}

struct D3dFrameReader {
  source_width: u32,
  source_height: u32,
  target_width: u32,
  target_height: u32,
  staging: ID3D11Texture2D,
  scaler: Option<VideoScaleResources>,
}

impl D3dFrameReader {
  fn new(
    device: &ID3D11Device,
    source_width: u32,
    source_height: u32,
    target_width: u32,
    target_height: u32,
  ) -> Result<Self, NdiErrorInfo> {
    let staging_desc = texture_description(
      target_width,
      target_height,
      D3D11_USAGE_STAGING,
      0,
      D3D11_CPU_ACCESS_READ.0 as u32,
    );
    let staging = create_texture(device, &staging_desc, "CPU staging")?;
    let scaler = if source_width == target_width && source_height == target_height {
      None
    } else {
      Some(VideoScaleResources::new(
        device,
        source_width,
        source_height,
        target_width,
        target_height,
      )?)
    };
    Ok(Self {
      source_width,
      source_height,
      target_width,
      target_height,
      staging,
      scaler,
    })
  }

  fn read(
    &self,
    source: &ID3D11Texture2D,
    device_context: &ID3D11DeviceContext,
    mailbox: &FrameMailbox,
  ) -> Result<(), NdiErrorInfo> {
    let scaled = if let Some(scaler) = &self.scaler {
      scaler.blit(source, device_context)?;
      &scaler.output
    } else {
      source
    };

    unsafe {
      device_context.CopyResource(&self.staging, scaled);
    }
    let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
    unsafe {
      device_context
        .Map(&self.staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped))
        .map_err(|error| scaling_error(format!("Could not map the D3D11 staging texture: {error}")))?;
      let stride = mapped.RowPitch as usize;
      let length = stride
        .checked_mul(self.target_height as usize)
        .ok_or_else(|| scaling_error("The mapped D3D11 frame is too large."))?;
      let pixels = std::slice::from_raw_parts(mapped.pData.cast::<u8>(), length);
      mailbox.publish(self.target_width, self.target_height, stride, pixels);
      device_context.Unmap(&self.staging, 0);
    }
    Ok(())
  }
}

impl VideoScaleResources {
  fn new(
    device: &ID3D11Device,
    source_width: u32,
    source_height: u32,
    target_width: u32,
    target_height: u32,
  ) -> Result<Self, NdiErrorInfo> {
    let video_device: ID3D11VideoDevice = device
      .cast()
      .map_err(|error| scaling_error(format!("D3D11 video processing is unavailable: {error}")))?;
    let content = D3D11_VIDEO_PROCESSOR_CONTENT_DESC {
      InputFrameFormat: D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE,
      InputFrameRate: DXGI_RATIONAL {
        Numerator: 30,
        Denominator: 1,
      },
      InputWidth: source_width,
      InputHeight: source_height,
      OutputFrameRate: DXGI_RATIONAL {
        Numerator: 30,
        Denominator: 1,
      },
      OutputWidth: target_width,
      OutputHeight: target_height,
      Usage: D3D11_VIDEO_USAGE_PLAYBACK_NORMAL,
    };
    let enumerator = unsafe { video_device.CreateVideoProcessorEnumerator(&content) }
      .map_err(|error| scaling_error(format!("Could not create the D3D11 video processor: {error}")))?;
    let processor = unsafe { video_device.CreateVideoProcessor(&enumerator, 0) }
      .map_err(|error| scaling_error(format!("Could not initialize D3D11 video scaling: {error}")))?;

    let output_desc = texture_description(
      target_width,
      target_height,
      D3D11_USAGE_DEFAULT,
      D3D11_BIND_RENDER_TARGET.0 as u32,
      0,
    );
    let output = create_texture(device, &output_desc, "video processor output")?;
    let view_desc = D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC {
      ViewDimension: D3D11_VPOV_DIMENSION_TEXTURE2D,
      Anonymous: D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC_0 {
        Texture2D: D3D11_TEX2D_VPOV { MipSlice: 0 },
      },
    };
    let mut output_view = None;
    unsafe {
      video_device
        .CreateVideoProcessorOutputView(
          &output,
          &enumerator,
          &view_desc,
          Some(&mut output_view),
        )
        .map_err(|error| scaling_error(format!("Could not create the D3D11 output view: {error}")))?;
    }
    Ok(Self {
      source_width,
      source_height,
      target_width,
      target_height,
      video_device,
      enumerator,
      processor,
      output,
      output_view: output_view
        .ok_or_else(|| scaling_error("D3D11 did not return a video processor output view."))?,
    })
  }

  fn blit(
    &self,
    source: &ID3D11Texture2D,
    device_context: &ID3D11DeviceContext,
  ) -> Result<(), NdiErrorInfo> {
    let input_desc = D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC {
      FourCC: 0,
      ViewDimension: D3D11_VPIV_DIMENSION_TEXTURE2D,
      Anonymous: D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC_0 {
        Texture2D: D3D11_TEX2D_VPIV {
          MipSlice: 0,
          ArraySlice: 0,
        },
      },
    };
    let mut input_view = None;
    unsafe {
      self
        .video_device
        .CreateVideoProcessorInputView(
          source,
          &self.enumerator,
          &input_desc,
          Some(&mut input_view),
        )
        .map_err(|error| scaling_error(format!("Could not create the D3D11 input view: {error}")))?;
    }
    let input_view = input_view
      .ok_or_else(|| scaling_error("D3D11 did not return a video processor input view."))?;
    let video_context: ID3D11VideoContext = device_context
      .cast()
      .map_err(|error| scaling_error(format!("D3D11 video processing context is unavailable: {error}")))?;
    let source_rect = RECT {
      left: 0,
      top: 0,
      right: self
        .source_width
        .try_into()
        .unwrap_or(i32::MAX),
      bottom: self
        .source_height
        .try_into()
        .unwrap_or(i32::MAX),
    };
    let destination_rect = RECT {
      left: 0,
      top: 0,
      right: self.target_width.try_into().unwrap_or(i32::MAX),
      bottom: self.target_height.try_into().unwrap_or(i32::MAX),
    };
    unsafe {
      video_context.VideoProcessorSetStreamFrameFormat(
        &self.processor,
        0,
        D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE,
      );
      video_context.VideoProcessorSetStreamSourceRect(
        &self.processor,
        0,
        true,
        Some(&source_rect),
      );
      video_context.VideoProcessorSetStreamDestRect(
        &self.processor,
        0,
        true,
        Some(&destination_rect),
      );
    }
    let stream = D3D11_VIDEO_PROCESSOR_STREAM {
      Enable: true.into(),
      pInputSurface: ManuallyDrop::new(Some(input_view)),
      ..Default::default()
    };
    let mut streams = [stream];
    let result = unsafe {
      video_context.VideoProcessorBlt(&self.processor, &self.output_view, 0, &streams)
    };
    unsafe {
      ManuallyDrop::drop(&mut streams[0].pInputSurface);
    }
    result.map_err(|error| scaling_error(format!("D3D11 could not scale the live frame: {error}")))
  }
}

fn texture_description(
  width: u32,
  height: u32,
  usage: windows::Win32::Graphics::Direct3D11::D3D11_USAGE,
  bind_flags: u32,
  cpu_access_flags: u32,
) -> D3D11_TEXTURE2D_DESC {
  D3D11_TEXTURE2D_DESC {
    Width: width,
    Height: height,
    MipLevels: 1,
    ArraySize: 1,
    Format: DXGI_FORMAT_B8G8R8A8_UNORM,
    SampleDesc: DXGI_SAMPLE_DESC {
      Count: 1,
      Quality: 0,
    },
    Usage: usage,
    BindFlags: bind_flags,
    CPUAccessFlags: cpu_access_flags,
    MiscFlags: 0,
  }
}

fn create_texture(
  device: &ID3D11Device,
  description: &D3D11_TEXTURE2D_DESC,
  purpose: &str,
) -> Result<ID3D11Texture2D, NdiErrorInfo> {
  let mut texture = None;
  unsafe {
    device
      .CreateTexture2D(description, None, Some(&mut texture))
      .map_err(|error| scaling_error(format!("Could not create the D3D11 {purpose} texture: {error}")))?;
  }
  texture.ok_or_else(|| scaling_error(format!("D3D11 did not return the {purpose} texture.")))
}

fn scaling_error(message: impl Into<String>) -> NdiErrorInfo {
  NdiErrorInfo::new(NdiErrorCode::ScalingFailed, message, true)
}
