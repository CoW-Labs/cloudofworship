use std::ffi::CString;
use std::sync::{
  atomic::{AtomicBool, Ordering},
  mpsc::SyncSender,
  Arc,
};
use std::time::{Duration, Instant};

use super::ffi::{
  NdiSendCreate, NdiSendInstance, NdiVideoFrameV2, FOURCC_BGRA, FRAME_FORMAT_PROGRESSIVE,
  TIMECODE_SYNTHESIZE,
};
use super::pipeline::{CapturedFrame, FrameMailbox};
use super::runtime::NdiRuntime;
use super::status::{NdiErrorCode, NdiErrorInfo, NdiPhase, StatusSink, FRAME_RATE, SOURCE_NAME};

struct NdiSender {
  runtime: &'static NdiRuntime,
  instance: NdiSendInstance,
  _source_name: CString,
}

impl NdiSender {
  fn new(runtime: &'static NdiRuntime) -> Result<Self, NdiErrorInfo> {
    let (source_name, create) = sender_configuration()?;
    let instance = unsafe { (runtime.functions.send_create)(&create) };
    if instance.is_null() {
      return Err(NdiErrorInfo::new(
        NdiErrorCode::SenderCreateFailed,
        "The NDI runtime could not create the Cow Live Center source.",
        true,
      ));
    }
    Ok(Self {
      runtime,
      instance,
      _source_name: source_name,
    })
  }

  fn send(&self, frame: &mut CapturedFrame) -> Result<(), NdiErrorInfo> {
    let width = i32::try_from(frame.width)
      .map_err(|_| NdiErrorInfo::internal("The captured frame width exceeds the NDI limit."))?;
    let height = i32::try_from(frame.height)
      .map_err(|_| NdiErrorInfo::internal("The captured frame height exceeds the NDI limit."))?;
    let stride = i32::try_from(frame.stride)
      .map_err(|_| NdiErrorInfo::internal("The captured frame stride exceeds the NDI limit."))?;
    let required = frame
      .stride
      .checked_mul(frame.height as usize)
      .ok_or_else(|| NdiErrorInfo::internal("The captured frame size overflowed."))?;
    if frame.pixels.len() < required {
      return Err(NdiErrorInfo::internal(
        "The captured frame buffer is smaller than its stride and height.",
      ));
    }

    let ndi_frame = NdiVideoFrameV2 {
      xres: width,
      yres: height,
      four_cc: FOURCC_BGRA,
      frame_rate_n: FRAME_RATE as i32,
      frame_rate_d: 1,
      picture_aspect_ratio: 0.0,
      frame_format_type: FRAME_FORMAT_PROGRESSIVE,
      timecode: TIMECODE_SYNTHESIZE,
      p_data: frame.pixels.as_mut_ptr(),
      line_stride_in_bytes: stride,
      p_metadata: std::ptr::null(),
      timestamp: 0,
    };
    unsafe { (self.runtime.functions.send_video_v2)(self.instance, &ndi_frame) };
    Ok(())
  }

  fn connection_count(&self) -> u32 {
    let count = unsafe { (self.runtime.functions.send_connections)(self.instance, 0) };
    count.max(0) as u32
  }
}

fn sender_configuration() -> Result<(CString, NdiSendCreate), NdiErrorInfo> {
  let source_name = CString::new(SOURCE_NAME)
    .map_err(|error| NdiErrorInfo::internal(format!("The NDI source name is invalid: {error}")))?;
  let create = NdiSendCreate {
    p_ndi_name: source_name.as_ptr(),
    p_groups: std::ptr::null(),
    clock_video: true,
    clock_audio: false,
  };
  Ok((source_name, create))
}

impl Drop for NdiSender {
  fn drop(&mut self) {
    unsafe { (self.runtime.functions.send_destroy)(self.instance) };
  }
}

pub fn run_sender(
  runtime: &'static NdiRuntime,
  mailbox: Arc<FrameMailbox>,
  stop: Arc<AtomicBool>,
  status: StatusSink,
  ready: SyncSender<Result<(), NdiErrorInfo>>,
) {
  let result = run_sender_inner(runtime, &mailbox, &stop, &status, &ready);
  if let Err(error) = result {
    let _ = ready.try_send(Err(error.clone()));
    if !stop.load(Ordering::Acquire) {
      status.fail(error);
      stop.store(true, Ordering::Release);
      mailbox.close();
    }
  }
}

fn run_sender_inner(
  runtime: &'static NdiRuntime,
  mailbox: &FrameMailbox,
  stop: &AtomicBool,
  status: &StatusSink,
  ready: &SyncSender<Result<(), NdiErrorInfo>>,
) -> Result<(), NdiErrorInfo> {
  let sender = NdiSender::new(runtime)?;
  let mut current = mailbox.wait_first(Duration::from_secs(5), stop)?;
  sender.send(&mut current)?;
  let mut frames_sent = 1_u64;
  status.update(|value| {
    value.width = Some(current.width);
    value.height = Some(current.height);
    value.frames_sent = frames_sent;
    value.last_frame_age_ms = Some(0);
  });
  let _ = ready.send(Ok(()));

  let mut last_status = Instant::now();
  while !stop.load(Ordering::Acquire) {
    // No capture update means a static/minimized window. Re-send the current
    // owned frame and let clock_video pace it at 30 fps.
    mailbox.replace_with_latest(&mut current);
    sender.send(&mut current)?;
    frames_sent = frames_sent.saturating_add(1);

    if last_status.elapsed() >= Duration::from_secs(1) {
      let age = current.captured_at.elapsed();
      let age_ms = u64::try_from(age.as_millis()).unwrap_or(u64::MAX);
      let connections = sender.connection_count();
      status.update(|value| {
        if value.phase != NdiPhase::Error {
          value.phase = NdiPhase::Broadcasting;
        }
        value.width = Some(current.width);
        value.height = Some(current.height);
        value.frames_sent = frames_sent;
        value.connection_count = connections;
        value.last_frame_age_ms = Some(age_ms);
        value.stalled = age >= Duration::from_secs(2);
      });
      last_status = Instant::now();
    }
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::ffi::CStr;

  #[test]
  fn source_name_storage_outlives_the_ffi_configuration() {
    let (source_name, configuration) = sender_configuration().unwrap();
    assert_eq!(
      unsafe { CStr::from_ptr(configuration.p_ndi_name) },
      source_name.as_c_str()
    );
    assert_eq!(source_name.to_str().unwrap(), SOURCE_NAME);
    assert!(configuration.clock_video);
    assert!(!configuration.clock_audio);
  }
}
