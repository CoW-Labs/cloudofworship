//! Windows: scaling and colour conversion on the GPU.
//!
//! Windows Graphics Capture hands over BGRA textures at the window's physical
//! size. Everything downstream (the YouTube encoder, NDI) wants NV12 at the
//! output size, so the D3D11 video processor, which every DirectX 11 GPU has as
//! fixed-function hardware, scales and converts in one pass. The CPU then only
//! copies the finished frame, which is 3/8 the bytes of the BGRA frame it would
//! otherwise be scaling by hand (at 4K60 that's ~750 MB/s instead of ~2 GB/s,
//! and no per-pixel arithmetic on the CPU at all).
//!
//! One converter belongs to one capture thread: it uses the capture's immediate
//! device context and is not `Sync`.

use std::collections::VecDeque;
use std::mem::ManuallyDrop;

use windows::core::Interface;
use windows::Win32::Foundation::RECT;
use windows::Win32::Graphics::Direct3D11::{
  ID3D11Device, ID3D11DeviceContext, ID3D11Texture2D, ID3D11VideoContext, ID3D11VideoDevice,
  ID3D11VideoProcessor, ID3D11VideoProcessorEnumerator, ID3D11VideoProcessorInputView,
  ID3D11VideoProcessorOutputView, D3D11_BIND_RENDER_TARGET, D3D11_CPU_ACCESS_READ,
  D3D11_MAPPED_SUBRESOURCE, D3D11_MAP_FLAG_DO_NOT_WAIT, D3D11_MAP_READ, D3D11_TEX2D_VPIV, D3D11_TEX2D_VPOV,
  D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT, D3D11_USAGE_STAGING,
  D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE, D3D11_VIDEO_PROCESSOR_COLOR_SPACE,
  D3D11_VIDEO_PROCESSOR_CONTENT_DESC, D3D11_VIDEO_PROCESSOR_FORMAT_SUPPORT_INPUT,
  D3D11_VIDEO_PROCESSOR_FORMAT_SUPPORT_OUTPUT, D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC,
  D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC_0, D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC,
  D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC_0, D3D11_VIDEO_PROCESSOR_STREAM,
  D3D11_VIDEO_USAGE_PLAYBACK_NORMAL, D3D11_VPIV_DIMENSION_TEXTURE2D,
  D3D11_VPOV_DIMENSION_TEXTURE2D,
};
use windows::Win32::Graphics::Dxgi::DXGI_ERROR_WAS_STILL_DRAWING;
use windows::Win32::Graphics::Dxgi::Common::{
  DXGI_FORMAT, DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_FORMAT_NV12, DXGI_RATIONAL, DXGI_SAMPLE_DESC,
};

/// `D3D11_VIDEO_PROCESSOR_COLOR_SPACE` is a bit-field: Usage:1, RGB_Range:1,
/// YCbCr_Matrix:1, YCbCr_xvYCC:1, Nominal_Range:2.
const fn color_space(rgb_range: u32, ycbcr_matrix: u32, nominal_range: u32) -> u32 {
  (rgb_range << 1) | (ycbcr_matrix << 2) | (nominal_range << 4)
}

/// The window is full-range RGB; the video is BT.709 with studio range
/// (16–235), which is what every player and YouTube assume for HD and UHD.
const INPUT_COLOR_SPACE: u32 = color_space(0, 1, 0);
const OUTPUT_COLOR_SPACE: u32 = color_space(0, 1, 1);

pub struct Nv12Converter {
  pub width: u32,
  pub height: u32,
  context: ID3D11DeviceContext,
  video_context: ID3D11VideoContext,
  processor: ID3D11VideoProcessor,
  /// A copy of the capture frame: the capture's own texture is only valid
  /// during the callback and can't be a video processor input.
  input: ID3D11Texture2D,
  input_view: ID3D11VideoProcessorInputView,
  output: ID3D11Texture2D,
  output_view: ID3D11VideoProcessorOutputView,
  /// CPU-readable copies of the output. Two let a readback be in flight while
  /// the next frame is converted.
  staging: Vec<ID3D11Texture2D>,
  /// Staging slots with a copy submitted and not yet read, oldest first.
  pending: VecDeque<usize>,
  // Kept alive for the views and the processor.
  _enumerator: ID3D11VideoProcessorEnumerator,
  _video_device: ID3D11VideoDevice,
}

impl Nv12Converter {
  /// A converter from `source_width`×`source_height` BGRA to `width`×`height`
  /// NV12 (both even).
  pub fn new(
    device: &ID3D11Device,
    context: &ID3D11DeviceContext,
    source_width: u32,
    source_height: u32,
    width: u32,
    height: u32,
    fps: u32,
  ) -> Result<Self, String> {
    if width < 2 || height < 2 || width % 2 != 0 || height % 2 != 0 {
      return Err(format!("{width}x{height} isn't a valid video size."));
    }
    let video_device: ID3D11VideoDevice = device
      .cast()
      .map_err(|e| format!("This graphics card has no video processing ({e})."))?;
    let video_context: ID3D11VideoContext = context
      .cast()
      .map_err(|e| format!("This graphics card has no video processing ({e})."))?;
    let rate = DXGI_RATIONAL { Numerator: fps.max(1), Denominator: 1 };
    let content = D3D11_VIDEO_PROCESSOR_CONTENT_DESC {
      InputFrameFormat: D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE,
      InputFrameRate: rate,
      InputWidth: source_width,
      InputHeight: source_height,
      OutputFrameRate: rate,
      OutputWidth: width,
      OutputHeight: height,
      Usage: D3D11_VIDEO_USAGE_PLAYBACK_NORMAL,
    };
    let enumerator = unsafe { video_device.CreateVideoProcessorEnumerator(&content) }
      .map_err(|e| format!("Could not create the video processor ({e})."))?;
    let supported = |format: DXGI_FORMAT, flag: i32| {
      unsafe { enumerator.CheckVideoProcessorFormat(format) }
        .is_ok_and(|bits| bits & flag as u32 != 0)
    };
    if !supported(DXGI_FORMAT_B8G8R8A8_UNORM, D3D11_VIDEO_PROCESSOR_FORMAT_SUPPORT_INPUT.0)
      || !supported(DXGI_FORMAT_NV12, D3D11_VIDEO_PROCESSOR_FORMAT_SUPPORT_OUTPUT.0)
    {
      return Err("This graphics card can't convert the live window to video.".into());
    }
    let processor = unsafe { video_device.CreateVideoProcessor(&enumerator, 0) }
      .map_err(|e| format!("Could not start the video processor ({e})."))?;

    let input = create_texture(
      device,
      source_width,
      source_height,
      DXGI_FORMAT_B8G8R8A8_UNORM,
      D3D11_USAGE_DEFAULT,
      D3D11_BIND_RENDER_TARGET.0 as u32,
      0,
    )?;
    let output = create_texture(
      device,
      width,
      height,
      DXGI_FORMAT_NV12,
      D3D11_USAGE_DEFAULT,
      D3D11_BIND_RENDER_TARGET.0 as u32,
      0,
    )?;
    let staging = (0..2)
      .map(|_| {
        create_texture(
          device,
          width,
          height,
          DXGI_FORMAT_NV12,
          D3D11_USAGE_STAGING,
          0,
          D3D11_CPU_ACCESS_READ.0 as u32,
        )
      })
      .collect::<Result<Vec<_>, _>>()?;

    let input_desc = D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC {
      FourCC: 0,
      ViewDimension: D3D11_VPIV_DIMENSION_TEXTURE2D,
      Anonymous: D3D11_VIDEO_PROCESSOR_INPUT_VIEW_DESC_0 {
        Texture2D: D3D11_TEX2D_VPIV { MipSlice: 0, ArraySlice: 0 },
      },
    };
    let mut input_view = None;
    unsafe {
      video_device
        .CreateVideoProcessorInputView(&input, &enumerator, &input_desc, Some(&mut input_view))
        .map_err(|e| format!("Could not create the video input ({e})."))?;
    }
    let output_desc = D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC {
      ViewDimension: D3D11_VPOV_DIMENSION_TEXTURE2D,
      Anonymous: D3D11_VIDEO_PROCESSOR_OUTPUT_VIEW_DESC_0 {
        Texture2D: D3D11_TEX2D_VPOV { MipSlice: 0 },
      },
    };
    let mut output_view = None;
    unsafe {
      video_device
        .CreateVideoProcessorOutputView(&output, &enumerator, &output_desc, Some(&mut output_view))
        .map_err(|e| format!("Could not create the video output ({e})."))?;
    }

    // These persist on the processor, so they're set once.
    let source_rect =
      RECT { left: 0, top: 0, right: source_width as i32, bottom: source_height as i32 };
    let target_rect = RECT { left: 0, top: 0, right: width as i32, bottom: height as i32 };
    let input_space = D3D11_VIDEO_PROCESSOR_COLOR_SPACE { _bitfield: INPUT_COLOR_SPACE };
    let output_space = D3D11_VIDEO_PROCESSOR_COLOR_SPACE { _bitfield: OUTPUT_COLOR_SPACE };
    unsafe {
      video_context.VideoProcessorSetStreamFrameFormat(
        &processor,
        0,
        D3D11_VIDEO_FRAME_FORMAT_PROGRESSIVE,
      );
      video_context.VideoProcessorSetStreamSourceRect(&processor, 0, true, Some(&source_rect));
      video_context.VideoProcessorSetStreamDestRect(&processor, 0, true, Some(&target_rect));
      video_context.VideoProcessorSetOutputTargetRect(&processor, true, Some(&target_rect));
      video_context.VideoProcessorSetStreamColorSpace(&processor, 0, &input_space);
      video_context.VideoProcessorSetOutputColorSpace(&processor, &output_space);
      // No driver "enhancement" (noise reduction, edge sharpening) on slides.
      video_context.VideoProcessorSetStreamAutoProcessingMode(&processor, 0, false);
    }

    Ok(Self {
      width,
      height,
      context: context.clone(),
      video_context,
      processor,
      input,
      input_view: input_view.ok_or("The video processor gave no input.")?,
      output,
      output_view: output_view.ok_or("The video processor gave no output.")?,
      staging,
      pending: VecDeque::new(),
      _enumerator: enumerator,
      _video_device: video_device,
    })
  }

  /// Whether this converter was built for frames of this size.
  pub fn takes(&self, source_width: u32, source_height: u32) -> bool {
    let mut desc = D3D11_TEXTURE2D_DESC::default();
    unsafe { self.input.GetDesc(&mut desc) };
    desc.Width == source_width && desc.Height == source_height
  }

  /// Copies the capture's frame into the converter's own texture. The capture
  /// frame is only valid during its callback, so this is the one thing that
  /// has to happen there.
  pub fn snapshot(&self, source: &ID3D11Texture2D) {
    unsafe { self.context.CopyResource(&self.input, source) };
  }

  /// Scales and converts the last snapshot into the NV12 output, on the GPU.
  pub fn blit(&self) -> Result<(), String> {
    unsafe {
      let stream = D3D11_VIDEO_PROCESSOR_STREAM {
        Enable: true.into(),
        pInputSurface: ManuallyDrop::new(Some(self.input_view.clone())),
        ..Default::default()
      };
      let mut streams = [stream];
      let result =
        self.video_context.VideoProcessorBlt(&self.processor, &self.output_view, 0, &streams);
      ManuallyDrop::drop(&mut streams[0].pInputSurface);
      result.map_err(|e| format!("The graphics card couldn't convert a frame ({e})."))
    }
  }

  /// `snapshot` and `blit` together.
  pub fn convert(&self, source: &ID3D11Texture2D) -> Result<(), String> {
    self.snapshot(source);
    self.blit()
  }

  /// Whether a converted frame can be queued for reading right now.
  pub fn can_submit(&self) -> bool {
    self.pending.len() < self.staging.len()
  }

  /// Whether a queued readback hasn't been collected yet.
  pub fn has_pending(&self) -> bool {
    !self.pending.is_empty()
  }

  /// Queues a copy of the converted frame for the CPU and submits the GPU
  /// work, so it completes even if nothing else is drawn afterwards.
  pub fn submit_readback(&mut self) -> bool {
    let Some(slot) = (0..self.staging.len()).find(|slot| !self.pending.contains(slot)) else {
      return false;
    };
    unsafe {
      self.context.CopyResource(&self.staging[slot], &self.output);
      self.context.Flush();
    }
    self.pending.push_back(slot);
    true
  }

  /// Hands the oldest queued frame's planes to `read` as
  /// `(luma, luma_stride, chroma, chroma_stride)` if the GPU has finished it,
  /// without waiting. `Ok(None)` means nothing is ready yet.
  pub fn poll_readback<R>(
    &mut self,
    read: impl FnOnce(&[u8], usize, &[u8], usize) -> R,
  ) -> Result<Option<R>, String> {
    let Some(&slot) = self.pending.front() else { return Ok(None) };
    let result = self.map_and_read(slot, true, read)?;
    if result.is_some() {
      self.pending.pop_front();
    }
    Ok(result)
  }

  /// Converts what's been blitted and returns it, waiting for the GPU. For
  /// callers that read one frame at a time (the YouTube feed).
  pub fn read_blocking<R>(
    &mut self,
    read: impl FnOnce(&[u8], usize, &[u8], usize) -> R,
  ) -> Result<R, String> {
    if !self.submit_readback() {
      return Err("The previous frame is still being read.".into());
    }
    let slot = self.pending.pop_back().expect("a frame was just queued");
    self
      .map_and_read(slot, false, read)?
      .ok_or_else(|| "The graphics card returned no frame.".to_string())
  }

  fn map_and_read<R>(
    &self,
    slot: usize,
    nowait: bool,
    read: impl FnOnce(&[u8], usize, &[u8], usize) -> R,
  ) -> Result<Option<R>, String> {
    let flags = if nowait { D3D11_MAP_FLAG_DO_NOT_WAIT.0 as u32 } else { 0 };
    unsafe {
      let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
      match self.context.Map(&self.staging[slot], 0, D3D11_MAP_READ, flags, Some(&mut mapped)) {
        Err(e) if e.code() == DXGI_ERROR_WAS_STILL_DRAWING => return Ok(None),
        Err(e) => return Err(format!("Could not read a converted frame ({e}).")),
        Ok(()) => {}
      }
      let stride = mapped.RowPitch as usize;
      let result = if mapped.pData.is_null() || stride < self.width as usize {
        Err("The graphics card returned an empty frame.".to_string())
      } else {
        // NV12: the chroma plane follows the luma plane, `height` rows in.
        let luma_len = stride * self.height as usize;
        let chroma_len = stride * (self.height as usize / 2);
        let base = mapped.pData.cast::<u8>();
        let luma = std::slice::from_raw_parts(base, luma_len);
        let chroma = std::slice::from_raw_parts(base.add(luma_len), chroma_len);
        Ok(Some(read(luma, stride, chroma, stride)))
      };
      self.context.Unmap(&self.staging[slot], 0);
      result
    }
  }

  /// The converted frame as one tightly packed NV12 buffer (`width` bytes per
  /// row, luma then chroma), written into `out` so its allocation is reused.
  pub fn read_packed(&mut self, out: &mut Vec<u8>) -> Result<(), String> {
    let (w, h) = (self.width as usize, self.height as usize);
    self.read_blocking(|luma, luma_stride, chroma, chroma_stride| {
      out.clear();
      out.reserve(w * h * 3 / 2);
      for row in 0..h {
        out.extend_from_slice(&luma[row * luma_stride..row * luma_stride + w]);
      }
      for row in 0..h / 2 {
        out.extend_from_slice(&chroma[row * chroma_stride..row * chroma_stride + w]);
      }
    })
  }
}

fn create_texture(
  device: &ID3D11Device,
  width: u32,
  height: u32,
  format: DXGI_FORMAT,
  usage: windows::Win32::Graphics::Direct3D11::D3D11_USAGE,
  bind_flags: u32,
  cpu_access_flags: u32,
) -> Result<ID3D11Texture2D, String> {
  let desc = D3D11_TEXTURE2D_DESC {
    Width: width,
    Height: height,
    MipLevels: 1,
    ArraySize: 1,
    Format: format,
    SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
    Usage: usage,
    BindFlags: bind_flags,
    CPUAccessFlags: cpu_access_flags,
    MiscFlags: 0,
  };
  let mut texture = None;
  unsafe {
    device
      .CreateTexture2D(&desc, None, Some(&mut texture))
      .map_err(|e| format!("Could not allocate a {width}x{height} video frame ({e})."))?;
  }
  texture.ok_or_else(|| "The graphics card gave no video frame.".to_string())
}

#[cfg(test)]
mod tests {
  use super::*;
  use windows::Win32::Foundation::HMODULE;
  use windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_HARDWARE;
  use windows::Win32::Graphics::Direct3D11::{
    D3D11CreateDevice, D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_SDK_VERSION,
    D3D11_SUBRESOURCE_DATA,
  };

  /// Converts a solid red window on the real GPU and checks the colour and the
  /// plane layout: BT.709 studio-range red is Y≈63, Cb≈102, Cr≈240.
  #[test]
  fn red_becomes_bt709_studio_range_nv12() {
    let (mut device, mut context) = (None, None);
    let created = unsafe {
      D3D11CreateDevice(
        None,
        D3D_DRIVER_TYPE_HARDWARE,
        HMODULE::default(),
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,
        None,
        D3D11_SDK_VERSION,
        Some(&mut device),
        None,
        Some(&mut context),
      )
    };
    let (Ok(()), Some(device), Some(context)) = (created.map(|_| ()), device, context) else {
      eprintln!("no D3D11 device here; skipping");
      return;
    };
    let (sw, sh) = (128u32, 72u32);
    let pixels: Vec<u8> = (0..sw * sh).flat_map(|_| [0u8, 0, 255, 255]).collect(); // B G R A
    let data =
      D3D11_SUBRESOURCE_DATA { pSysMem: pixels.as_ptr().cast(), SysMemPitch: sw * 4, SysMemSlicePitch: 0 };
    let desc = D3D11_TEXTURE2D_DESC {
      Width: sw,
      Height: sh,
      MipLevels: 1,
      ArraySize: 1,
      Format: DXGI_FORMAT_B8G8R8A8_UNORM,
      SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
      Usage: D3D11_USAGE_DEFAULT,
      BindFlags: D3D11_BIND_RENDER_TARGET.0 as u32,
      CPUAccessFlags: 0,
      MiscFlags: 0,
    };
    let mut source = None;
    unsafe { device.CreateTexture2D(&desc, Some(&data), Some(&mut source)).unwrap() };
    let source = source.unwrap();

    let mut converter = Nv12Converter::new(&device, &context, sw, sh, 64, 36, 30).unwrap();
    assert!(converter.takes(sw, sh));
    converter.convert(&source).unwrap();
    let mut packed = Vec::new();
    converter.read_packed(&mut packed).unwrap();
    assert_eq!(packed.len(), 64 * 36 * 3 / 2);
    let (luma, chroma) = packed.split_at(64 * 36);
    let near = |value: u8, want: i32| (value as i32 - want).abs() <= 4;
    assert!(near(luma[18 * 64 + 32], 63), "Y was {}", luma[18 * 64 + 32]);
    assert!(near(chroma[9 * 64 + 32], 102), "Cb was {}", chroma[9 * 64 + 32]);
    assert!(near(chroma[9 * 64 + 33], 240), "Cr was {}", chroma[9 * 64 + 33]);
  }
}
