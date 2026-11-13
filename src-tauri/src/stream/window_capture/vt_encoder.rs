//! In-process hardware H.264 encoding with VideoToolbox (macOS).
//!
//! The capture hands over ScreenCaptureKit's own surfaces, already NV12, so
//! encoding is surface → media engine with no CPU copy and no colour
//! conversion. What leaves this module is Annex B H.264, a few MB/s even at
//! 4K60, and FFmpeg only muxes it with the audio. Piping the same picture to
//! FFmpeg as raw frames would be ~2 GB/s at 4K60.
//!
//! The encoder is built for a fixed size and rate and fed one surface per tick
//! of the pacer; presentation times are the frame index at the tier's rate, so
//! the stream is constant frame rate and carries no B-frames.

use std::ffi::{c_char, c_void};
use std::io::Write;
use std::process::ChildStdin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use screencapturekit::cv::CVPixelBuffer;
use core_foundation::base::{CFRelease, CFTypeRef, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::{CFDictionary, CFDictionaryRef};
use core_foundation::number::CFNumber;
use core_foundation::string::{CFString, CFStringRef};

use super::super::quality::Codec;
use super::super::StreamQuality;
use super::FailHandler;

type OSStatus = i32;
type Session = *mut c_void;
type SampleBuffer = *const c_void;

/// `CMTime`, passed by value to VideoToolbox.
#[repr(C)]
#[derive(Clone, Copy)]
struct CMTime {
  value: i64,
  timescale: i32,
  flags: u32,
  epoch: i64,
}

const CM_TIME_VALID: u32 = 1;
const CODEC_H264: u32 = u32::from_be_bytes(*b"avc1");
const CODEC_HEVC: u32 = u32::from_be_bytes(*b"hvc1");
const INFO_FRAME_DROPPED: u32 = 1 << 1;

type OutputCallback = extern "C" fn(
  refcon: *mut c_void,
  frame_refcon: *mut c_void,
  status: OSStatus,
  info_flags: u32,
  sample: SampleBuffer,
);

#[link(name = "VideoToolbox", kind = "framework")]
extern "C" {
  fn VTCompressionSessionCreate(
    allocator: *const c_void,
    width: i32,
    height: i32,
    codec: u32,
    encoder_specification: CFDictionaryRef,
    source_attributes: CFDictionaryRef,
    compressed_allocator: *const c_void,
    callback: OutputCallback,
    refcon: *mut c_void,
    session_out: *mut Session,
  ) -> OSStatus;
  fn VTSessionSetProperty(session: Session, key: CFStringRef, value: CFTypeRef) -> OSStatus;
  fn VTCompressionSessionPrepareToEncodeFrames(session: Session) -> OSStatus;
  fn VTCompressionSessionEncodeFrame(
    session: Session,
    image: *mut c_void,
    pts: CMTime,
    duration: CMTime,
    frame_properties: CFDictionaryRef,
    frame_refcon: *mut c_void,
    info_flags_out: *mut u32,
  ) -> OSStatus;
  fn VTCompressionSessionCompleteFrames(session: Session, until: CMTime) -> OSStatus;
  fn VTCompressionSessionInvalidate(session: Session);

  static kVTCompressionPropertyKey_RealTime: CFStringRef;
  static kVTCompressionPropertyKey_AverageBitRate: CFStringRef;
  static kVTCompressionPropertyKey_DataRateLimits: CFStringRef;
  static kVTCompressionPropertyKey_ExpectedFrameRate: CFStringRef;
  static kVTCompressionPropertyKey_MaxKeyFrameInterval: CFStringRef;
  static kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration: CFStringRef;
  static kVTCompressionPropertyKey_AllowFrameReordering: CFStringRef;
  static kVTCompressionPropertyKey_ProfileLevel: CFStringRef;
  static kVTProfileLevel_H264_High_AutoLevel: CFStringRef;
  static kVTProfileLevel_HEVC_Main_AutoLevel: CFStringRef;
  static kVTVideoEncoderSpecification_RequireHardwareAcceleratedVideoEncoder: CFStringRef;
  static kVTCompressionPropertyKey_ColorPrimaries: CFStringRef;
  static kVTCompressionPropertyKey_TransferFunction: CFStringRef;
  static kVTCompressionPropertyKey_YCbCrMatrix: CFStringRef;
}

#[link(name = "CoreVideo", kind = "framework")]
extern "C" {
  static kCVImageBufferColorPrimaries_ITU_R_709_2: CFStringRef;
  static kCVImageBufferTransferFunction_ITU_R_709_2: CFStringRef;
  static kCVImageBufferYCbCrMatrix_ITU_R_709_2: CFStringRef;
}

#[link(name = "CoreMedia", kind = "framework")]
extern "C" {
  fn CMSampleBufferGetDataBuffer(sample: SampleBuffer) -> *const c_void;
  fn CMSampleBufferGetFormatDescription(sample: SampleBuffer) -> *const c_void;
  fn CMSampleBufferGetSampleAttachmentsArray(
    sample: SampleBuffer,
    create_if_necessary: u8,
  ) -> *const c_void;
  fn CMBlockBufferGetDataPointer(
    buffer: *const c_void,
    offset: usize,
    length_at_offset: *mut usize,
    total_length: *mut usize,
    data: *mut *mut c_char,
  ) -> OSStatus;
  fn CMVideoFormatDescriptionGetH264ParameterSetAtIndex(
    description: *const c_void,
    index: usize,
    parameter_set: *mut *const u8,
    size: *mut usize,
    count: *mut usize,
    nal_header_length: *mut i32,
  ) -> OSStatus;
  fn CMVideoFormatDescriptionGetHEVCParameterSetAtIndex(
    description: *const c_void,
    index: usize,
    parameter_set: *mut *const u8,
    size: *mut usize,
    count: *mut usize,
    nal_header_length: *mut i32,
  ) -> OSStatus;

  static kCMSampleAttachmentKey_NotSync: CFStringRef;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
  fn CFArrayGetCount(array: *const c_void) -> isize;
  fn CFArrayGetValueAtIndex(array: *const c_void, index: isize) -> *const c_void;
  fn CFDictionaryContainsKey(dictionary: *const c_void, key: *const c_void) -> u8;
}

/// Where encoded frames go, and who hears about a failure.
struct Output {
  stdin: Arc<Mutex<Option<ChildStdin>>>,
  fail: FailHandler,
}

/// Shared with VideoToolbox's output callback, which runs on its own thread.
struct CallbackState {
  codec: Codec,
  output: Mutex<Option<Output>>,
  /// One access unit being assembled, reused so each frame doesn't allocate.
  scratch: Mutex<Vec<u8>>,
  /// Where encoded frames go when nothing is attached (the self-test).
  #[cfg(test)]
  sink: Mutex<Vec<u8>>,
  failed: AtomicBool,
  /// Frames VideoToolbox discarded (status error or rate-control drop).
  dropped: AtomicU64,
  frames_out: AtomicU64,
}

pub struct VtEncoder {
  session: Session,
  state: *mut CallbackState,
  fps: i32,
  /// Frames submitted so far, which is also the next presentation index.
  submitted: AtomicU64,
  /// Dropped frames already made up for.
  repaid: AtomicU64,
}

// The session is documented as safe to drive from any thread, and the callback
// state is only reached through its own locks and atomics.
unsafe impl Send for VtEncoder {}
unsafe impl Sync for VtEncoder {}

impl VtEncoder {
  /// Builds a hardware encoder for `width`×`height` at `quality`'s rate, or
  /// explains why this Mac can't (so the caller can fall back to FFmpeg).
  pub fn new(width: u32, height: u32, quality: StreamQuality) -> Result<Self, String> {
    let state = Box::into_raw(Box::new(CallbackState {
      codec: quality.codec,
      output: Mutex::new(None),
      scratch: Mutex::new(Vec::with_capacity(1 << 20)),
      #[cfg(test)]
      sink: Mutex::new(Vec::new()),
      failed: AtomicBool::new(false),
      dropped: AtomicU64::new(0),
      frames_out: AtomicU64::new(0),
    }));

    // The hardware encoder is required, not just preferred: VideoToolbox's
    // software fallback can't keep up at these sizes, and a clear failure here
    // lets the caller pick the FFmpeg path instead.
    let specification = unsafe {
      CFDictionary::from_CFType_pairs(&[(
        CFString::wrap_under_get_rule(
          kVTVideoEncoderSpecification_RequireHardwareAcceleratedVideoEncoder,
        ),
        CFBoolean::true_value(),
      )])
    };
    let mut session: Session = std::ptr::null_mut();
    let status = unsafe {
      VTCompressionSessionCreate(
        std::ptr::null(),
        width as i32,
        height as i32,
        match quality.codec {
          Codec::H264 => CODEC_H264,
          Codec::Hevc => CODEC_HEVC,
        },
        specification.as_concrete_TypeRef(),
        std::ptr::null(),
        std::ptr::null(),
        on_encoded,
        state.cast(),
        &mut session,
      )
    };
    if status != 0 || session.is_null() {
      drop(unsafe { Box::from_raw(state) });
      return Err(format!(
        "VideoToolbox can't create a {width}x{height} hardware H.264 encoder (error {status})."
      ));
    }

    let encoder = Self {
      session,
      state,
      fps: quality.fps as i32,
      submitted: AtomicU64::new(0),
      repaid: AtomicU64::new(0),
    };
    encoder.configure(quality)?;
    let status = unsafe { VTCompressionSessionPrepareToEncodeFrames(session) };
    if status != 0 {
      return Err(format!("VideoToolbox couldn't prepare the encoder (error {status})."));
    }
    Ok(encoder)
  }

  fn configure(&self, quality: StreamQuality) -> Result<(), String> {
    let bits_per_second = quality.video_kbps as i64 * 1000;
    // Peak: 1.25x the average over any one second. YouTube wants a steady
    // stream, and the cap keeps a burst on a scene change from outrunning the
    // upload.
    let peak_bytes = bits_per_second * 5 / 4 / 8;
    unsafe {
      self.set(kVTCompressionPropertyKey_RealTime, CFBoolean::true_value().as_CFTypeRef())?;
      let profile = match quality.codec {
        Codec::H264 => kVTProfileLevel_H264_High_AutoLevel,
        Codec::Hevc => kVTProfileLevel_HEVC_Main_AutoLevel,
      };
      self.set(kVTCompressionPropertyKey_ProfileLevel, profile as CFTypeRef)?;
      // Live video is never reordered, so presentation order is decode order.
      self.set(
        kVTCompressionPropertyKey_AllowFrameReordering,
        CFBoolean::false_value().as_CFTypeRef(),
      )?;
      self.set(
        kVTCompressionPropertyKey_AverageBitRate,
        CFNumber::from(bits_per_second).as_CFTypeRef(),
      )?;
      let limits = core_foundation::array::CFArray::from_CFTypes(&[
        CFNumber::from(peak_bytes),
        CFNumber::from(1i64),
      ]);
      self.set(kVTCompressionPropertyKey_DataRateLimits, limits.as_CFTypeRef())?;
      self.set(
        kVTCompressionPropertyKey_ExpectedFrameRate,
        CFNumber::from(quality.fps as i64).as_CFTypeRef(),
      )?;
      // A keyframe every two seconds, as YouTube asks.
      self.set(
        kVTCompressionPropertyKey_MaxKeyFrameInterval,
        CFNumber::from(quality.keyframe_interval() as i64).as_CFTypeRef(),
      )?;
      self.set(
        kVTCompressionPropertyKey_MaxKeyFrameIntervalDuration,
        CFNumber::from(2i64).as_CFTypeRef(),
      )?;
      // Declare BT.709 in the stream itself. Left to the capture surfaces'
      // attachments, VideoToolbox wrote HEVC streams tagged as an identity
      // (GBR) matrix with unknown primaries, which a player or YouTube's
      // transcoder that honours the tag would turn into wrong colours.
      self.set(
        kVTCompressionPropertyKey_ColorPrimaries,
        kCVImageBufferColorPrimaries_ITU_R_709_2 as CFTypeRef,
      )?;
      self.set(
        kVTCompressionPropertyKey_TransferFunction,
        kCVImageBufferTransferFunction_ITU_R_709_2 as CFTypeRef,
      )?;
      self.set(kVTCompressionPropertyKey_YCbCrMatrix, kCVImageBufferYCbCrMatrix_ITU_R_709_2 as CFTypeRef)?;
    }
    Ok(())
  }

  unsafe fn set(&self, key: CFStringRef, value: CFTypeRef) -> Result<(), String> {
    let status = VTSessionSetProperty(self.session, key, value);
    if status != 0 {
      let name = CFString::wrap_under_get_rule(key).to_string();
      return Err(format!("VideoToolbox rejected the {name} setting (error {status})."));
    }
    Ok(())
  }

  /// Points encoded frames at FFmpeg's stdin. A broken pipe is reported once
  /// through `fail`, since a stream with no one reading it is over.
  pub fn attach(&self, stdin: Arc<Mutex<Option<ChildStdin>>>, fail: FailHandler) {
    let state = unsafe { &*self.state };
    *state.output.lock().unwrap_or_else(|p| p.into_inner()) = Some(Output { stdin, fail });
  }

  /// Submits one picture as the next frame of the stream.
  ///
  /// FFmpeg times this video by counting frames, so every tick of the pacer
  /// has to come out as exactly one frame. When rate control drops a frame
  /// (a scene change that outruns the bitrate cap), the same picture is
  /// submitted again straight away: the repeat costs almost nothing, and
  /// video stays in step with the audio instead of falling behind by a frame
  /// per drop.
  pub fn encode(&self, surface: &CVPixelBuffer) -> Result<(), String> {
    // More than a few at once means the encoder is overloaded, not unlucky;
    // piling repeats on top would only make that worse.
    const MAX_REPEATS: u64 = 4;
    let dropped = unsafe { &*self.state }.dropped.load(Ordering::Relaxed);
    let owed = dropped.saturating_sub(self.repaid.load(Ordering::Relaxed));
    let repeats = owed.min(MAX_REPEATS);
    self.repaid.store(dropped, Ordering::Relaxed);
    for _ in 0..=repeats {
      self.submit(surface)?;
    }
    if unsafe { &*self.state }.failed.load(Ordering::Acquire) {
      return Err("The stream encoder stopped accepting video.".into());
    }
    Ok(())
  }

  fn submit(&self, surface: &CVPixelBuffer) -> Result<(), String> {
    let index = self.submitted.fetch_add(1, Ordering::Relaxed) as i64;
    let pts = CMTime { value: index, timescale: self.fps, flags: CM_TIME_VALID, epoch: 0 };
    let duration = CMTime { value: 1, timescale: self.fps, flags: CM_TIME_VALID, epoch: 0 };
    let mut info = 0u32;
    let status = unsafe {
      VTCompressionSessionEncodeFrame(
        self.session,
        surface.as_ptr(),
        pts,
        duration,
        std::ptr::null(),
        std::ptr::null_mut(),
        &mut info,
      )
    };
    if status != 0 {
      return Err(format!("The hardware encoder stopped accepting frames (error {status})."));
    }
    Ok(())
  }

  /// Frames the encoder has produced so far.
  #[cfg(test)]
  fn frames_out(&self) -> u64 {
    unsafe { &*self.state }.frames_out.load(Ordering::Relaxed)
  }

  #[cfg(test)]
  fn dropped(&self) -> u64 {
    unsafe { &*self.state }.dropped.load(Ordering::Relaxed)
  }

  #[cfg(test)]
  fn take_output(&self) -> Vec<u8> {
    std::mem::take(&mut *unsafe { &*self.state }.sink.lock().unwrap())
  }
}

impl Drop for VtEncoder {
  fn drop(&mut self) {
    unsafe {
      // Flush what's in flight, then tear the session down. The callback can't
      // fire again after Invalidate returns, so the state is freed after it.
      let invalid = CMTime { value: 0, timescale: 0, flags: 0, epoch: 0 };
      VTCompressionSessionCompleteFrames(self.session, invalid);
      VTCompressionSessionInvalidate(self.session);
      CFRelease(self.session as CFTypeRef);
      drop(Box::from_raw(self.state));
    }
  }
}

/// VideoToolbox calls this once per encoded frame, in order, on its own thread.
extern "C" fn on_encoded(
  refcon: *mut c_void,
  _frame_refcon: *mut c_void,
  status: OSStatus,
  info_flags: u32,
  sample: SampleBuffer,
) {
  let state = unsafe { &*(refcon as *const CallbackState) };
  if status != 0 || sample.is_null() || info_flags & INFO_FRAME_DROPPED != 0 {
    state.dropped.fetch_add(1, Ordering::Relaxed);
    return;
  }
  let mut scratch = state.scratch.lock().unwrap_or_else(|p| p.into_inner());
  scratch.clear();
  if unsafe { access_unit(sample, state.codec, &mut scratch) }.is_none() {
    return;
  }
  state.frames_out.fetch_add(1, Ordering::Relaxed);

  #[cfg(test)]
  state.sink.lock().unwrap().extend_from_slice(&scratch);

  let guard = state.output.lock().unwrap_or_else(|p| p.into_inner());
  let Some(output) = guard.as_ref() else { return };
  let mut slot = output.stdin.lock().unwrap_or_else(|p| p.into_inner());
  let Some(stdin) = slot.as_mut() else { return };
  if stdin.write_all(&scratch).is_err() {
    drop(slot);
    if !state.failed.swap(true, Ordering::AcqRel) {
      (output.fail)("The stream encoder stopped accepting video.".into());
    }
  }
}

/// Writes one frame as an Annex B access unit: a delimiter, the parameter sets
/// on keyframes (so a pusher that reconnects mid-stream can start decoding),
/// then the frame's NAL units with start codes in place of VideoToolbox's
/// length prefixes.
unsafe fn access_unit(sample: SampleBuffer, codec: Codec, out: &mut Vec<u8>) -> Option<()> {
  const START: [u8; 4] = [0, 0, 0, 1];
  out.extend_from_slice(&START);
  match codec {
    // access unit delimiter, any slice type
    Codec::H264 => out.extend_from_slice(&[0x09, 0xF0]),
    Codec::Hevc => out.extend_from_slice(&[0x46, 0x01, 0x50]),
  }
  let parameter_set = match codec {
    Codec::H264 => CMVideoFormatDescriptionGetH264ParameterSetAtIndex,
    Codec::Hevc => CMVideoFormatDescriptionGetHEVCParameterSetAtIndex,
  };

  let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, 0);
  let keyframe = attachments.is_null()
    || CFArrayGetCount(attachments) == 0
    || CFDictionaryContainsKey(
      CFArrayGetValueAtIndex(attachments, 0),
      kCMSampleAttachmentKey_NotSync as *const c_void,
    ) == 0;

  let description = CMSampleBufferGetFormatDescription(sample);
  let mut header_length = 4i32;
  if !description.is_null() {
    let mut count = 0usize;
    let mut set: *const u8 = std::ptr::null();
    let mut size = 0usize;
    if parameter_set(
      description,
      0,
      &mut set,
      &mut size,
      &mut count,
      &mut header_length,
    ) == 0
      && keyframe
    {
      for index in 0..count {
        if parameter_set(
          description,
          index,
          &mut set,
          &mut size,
          std::ptr::null_mut(),
          std::ptr::null_mut(),
        ) == 0
        {
          out.extend_from_slice(&START);
          out.extend_from_slice(std::slice::from_raw_parts(set, size));
        }
      }
    }
  }

  let block = CMSampleBufferGetDataBuffer(sample);
  if block.is_null() {
    return None;
  }
  let (mut contiguous, mut total) = (0usize, 0usize);
  let mut data: *mut c_char = std::ptr::null_mut();
  if CMBlockBufferGetDataPointer(block, 0, &mut contiguous, &mut total, &mut data) != 0
    || data.is_null()
    || contiguous < total
  {
    return None;
  }
  let bytes = std::slice::from_raw_parts(data as *const u8, total);
  let header = header_length.clamp(1, 4) as usize;
  let mut at = 0usize;
  while at + header <= bytes.len() {
    let length = bytes[at..at + header].iter().fold(0usize, |n, b| (n << 8) | *b as usize);
    at += header;
    if length == 0 || at + length > bytes.len() {
      break;
    }
    out.extend_from_slice(&START);
    out.extend_from_slice(&bytes[at..at + length]);
    at += length;
  }
  Some(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use screencapturekit::cm as apple_cf_surface;
  use std::time::{Duration, Instant};

  /// NV12 at 3840x2160 is what ScreenCaptureKit hands over.
  const NV12: u32 = u32::from_be_bytes(*b"420v");

  /// An IOSurface-backed NV12 buffer, like the ones ScreenCaptureKit delivers
  /// (a plain `CVPixelBuffer::create` would make VideoToolbox copy it first).
  fn synthetic_surface(width: usize, height: usize, shade: u8) -> CVPixelBuffer {
    use apple_cf_surface::{IOSurface, PlaneProperties};
    let bytes_per_row = (width + 63) & !63;
    let luma = bytes_per_row * height;
    let chroma = bytes_per_row * (height / 2);
    let planes = [
      PlaneProperties {
        width,
        height,
        bytes_per_row,
        bytes_per_element: 1,
        offset: 0,
        size: luma,
      },
      PlaneProperties {
        width: width / 2,
        height: height / 2,
        bytes_per_row,
        bytes_per_element: 2,
        offset: luma,
        size: chroma,
      },
    ];
    let surface = IOSurface::create_with_properties(
      width,
      height,
      NV12,
      1,
      bytes_per_row,
      luma + chroma,
      Some(&planes),
    )
    .expect("IOSurface");
    let buffer = CVPixelBuffer::create_with_io_surface(&surface).expect("surface");
    assert!(buffer.is_backed_by_io_surface());
    {
      let mut guard = buffer.lock_read_write().expect("lock");
      for plane in 0..2 {
        let rows = if plane == 0 { height } else { height / 2 };
        let stride = guard.bytes_per_row_of_plane(plane);
        let base = guard.base_address_of_plane_mut(plane).expect("plane");
        for row in 0..rows {
          // A moving gradient, so the encoder has real work to do.
          let line = unsafe { std::slice::from_raw_parts_mut(base.add(row * stride), stride) };
          for (x, byte) in line.iter_mut().enumerate() {
            *byte = shade.wrapping_add((x as u8).wrapping_mul(3)).wrapping_add(row as u8);
          }
        }
      }
    }
    buffer
  }

  /// Encodes ten seconds of 4K60 and reports whether the Mac kept up. Needs a
  /// real media engine, so it only runs on request:
  /// `cargo test --lib vt_encoder -- --ignored --nocapture`
  #[test]
  #[ignore]
  fn encodes_4k60_in_real_time() {
    let tier = std::env::var("VT_TIER").unwrap_or("2160p60".into());
    let quality = StreamQuality::by_id(Some(&tier));
    let (width, height) = (quality.width_for(16.0 / 9.0) as usize, quality.height as usize);
    let encoder = VtEncoder::new(width as u32, height as u32, quality).expect("hardware encoder");
    // Four distinct surfaces, cycled, so each frame differs from the last.
    // VT_STATIC=1 repeats one surface instead: a slide that isn't changing.
    let distinct = if std::env::var("VT_STATIC").is_ok() { 1 } else { 4 };
    let surfaces: Vec<_> = (0..distinct).map(|i| synthetic_surface(width, height, i * 40)).collect();

    let frames = 600u64;
    let started = Instant::now();
    let mut slowest = Duration::ZERO;
    for index in 0..frames {
      let begin = Instant::now();
      encoder.encode(&surfaces[(index % distinct as u64) as usize]).expect("encode");
      slowest = slowest.max(begin.elapsed());
    }
    drop_flush(&encoder);
    let elapsed = started.elapsed();
    let bytes = encoder.take_output();
    let fps = frames as f64 / elapsed.as_secs_f64();
    println!(
      "{tier}: {frames} frames in {:.2}s = {fps:.1} fps (need {}), slowest submit {:?}, \
       {} frames out, {} dropped, {:.1} Mbps average",
      elapsed.as_secs_f64(),
      quality.fps,
      slowest,
      encoder.frames_out(),
      encoder.dropped(),
      bytes.len() as f64 * 8.0 / (frames as f64 / quality.fps as f64) / 1e6,
    );
    std::fs::write(std::env::var("VT_TEST_OUT").unwrap_or("/tmp/vt-4k60.h264".into()), &bytes)
      .unwrap();
    // Every tick comes out as a frame; a few repeats for the very last drops
    // may still be owed when the test stops submitting.
    assert!(
      encoder.frames_out() + 5 >= frames,
      "{} frames out for {frames} submitted",
      encoder.frames_out()
    );
    assert!(
      fps >= quality.fps as f64,
      "encoder fell behind real time: {fps:.1} fps (need {})",
      quality.fps
    );
  }

  fn drop_flush(encoder: &VtEncoder) {
    let invalid = CMTime { value: 0, timescale: 0, flags: 0, epoch: 0 };
    unsafe { VTCompressionSessionCompleteFrames(encoder.session, invalid) };
  }

  #[test]
  #[ignore]
  fn annex_b_starts_with_parameter_sets_on_the_first_frame() {
    let encoder = VtEncoder::new(1280, 720, StreamQuality::by_id(None)).expect("encoder");
    let surface = synthetic_surface(1280, 720, 10);
    for _ in 0..10 {
      encoder.encode(&surface).expect("encode");
    }
    drop_flush(&encoder);
    let bytes = encoder.take_output();
    assert_eq!(&bytes[..6], &[0, 0, 0, 1, 0x09, 0xF0]);
    let types: Vec<u8> = bytes
      .windows(4)
      .enumerate()
      .filter(|(_, w)| *w == [0, 0, 0, 1])
      .map(|(i, _)| bytes[i + 4] & 0x1F)
      .take(5)
      .collect();
    // delimiter, SPS, PPS, then (after VideoToolbox's SEI) the IDR slice
    assert_eq!(types[..3], [9, 7, 8]);
    assert!(bytes.windows(5).any(|w| w[..4] == [0, 0, 0, 1] && w[4] & 0x1F == 5));
  }

  extern "C" {
    fn CVBufferCopyAttachment(
      buffer: *mut c_void,
      key: CFStringRef,
      mode: *mut u32,
    ) -> CFTypeRef;
    static kCVImageBufferYCbCrMatrixKey: CFStringRef;
    static kCVImageBufferColorPrimariesKey: CFStringRef;
    static kCVImageBufferTransferFunctionKey: CFStringRef;
  }

  /// Captures the main display for a moment the way both stream paths ask
  /// ScreenCaptureKit to (NV12, BT.709) and reports how the frames are tagged.
  /// Needs Screen Recording permission for the process running the test.
  /// `cargo test --lib screen_capture_colour_tags -- --ignored --nocapture`
  #[test]
  #[ignore]
  fn screen_capture_colour_tags() {
    use screencapturekit::cm::{CMSampleBufferSCExt, SCFrameStatus};
    use screencapturekit::prelude::*;
    use std::sync::mpsc;

    let display = SCShareableContent::get()
      .expect("Screen Recording permission")
      .displays()
      .into_iter()
      .next()
      .expect("a display");
    let filter = SCContentFilter::create().with_display(&display).with_excluding_windows(&[]).build();
    let configuration = SCStreamConfiguration::new()
      .with_width(1920)
      .with_height(1080)
      .with_pixel_format(PixelFormat::YCbCr_420v)
      .with_color_matrix("ITU_R_709_2");
    let (sender, receiver) = mpsc::channel::<String>();
    let mut stream = SCStream::new(&filter, &configuration);
    stream.add_output_handler(
      move |sample: CMSampleBuffer, kind: SCStreamOutputType| {
        if kind != SCStreamOutputType::Screen
          || matches!(sample.frame_status(), Some(SCFrameStatus::Idle | SCFrameStatus::Blank))
        {
          return;
        }
        let Some(buffer) = sample.image_buffer() else { return };
        let tag = |key: CFStringRef| unsafe {
          let value = CVBufferCopyAttachment(buffer.as_ptr(), key, std::ptr::null_mut());
          if value.is_null() {
            "none".to_string()
          } else {
            let text = CFString::wrap_under_create_rule(value as CFStringRef).to_string();
            text
          }
        };
        let described = unsafe {
          format!(
            "format {:#x}, {}x{}, matrix {}, primaries {}, transfer {}",
            buffer.pixel_format(),
            buffer.width(),
            buffer.height(),
            tag(kCVImageBufferYCbCrMatrixKey),
            tag(kCVImageBufferColorPrimariesKey),
            tag(kCVImageBufferTransferFunctionKey),
          )
        };
        let _ = sender.send(described);
      },
      SCStreamOutputType::Screen,
    );
    stream.start_capture().expect("start capture");
    let line = receiver.recv_timeout(Duration::from_secs(5)).expect("a frame within 5s");
    stream.stop_capture().ok();
    println!("ScreenCaptureKit frame: {line}");
  }
}
