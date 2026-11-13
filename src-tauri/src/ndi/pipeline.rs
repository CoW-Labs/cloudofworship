use std::sync::{
  atomic::{AtomicBool, Ordering},
  Condvar, Mutex,
};
use std::time::{Duration, Instant};

use super::status::{NdiErrorCode, NdiErrorInfo};

/// How the pixels of a captured frame are laid out.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FrameFormat {
  /// Packed 8-bit B, G, R, A; `stride` bytes per row. (Windows capture only;
  /// macOS sends NV12.)
  #[cfg_attr(target_os = "macos", allow(dead_code))]
  Bgra,
  /// 4:2:0: a full-size luma plane, then one interleaved Cb/Cr plane at half
  /// the height, both `stride` bytes per row and back to back in one buffer,
  /// which is the layout the NDI SDK expects.
  Nv12,
}

impl FrameFormat {
  /// Bytes a frame of this size needs.
  pub fn len(self, height: usize, stride: usize) -> Option<usize> {
    match self {
      Self::Bgra => stride.checked_mul(height),
      Self::Nv12 => stride.checked_mul(height)?.checked_add(stride.checked_mul(height / 2)?),
    }
  }
}

#[derive(Debug)]
pub struct CapturedFrame {
  #[allow(dead_code)]
  pub sequence: u64,
  pub width: u32,
  pub height: u32,
  pub stride: usize,
  pub format: FrameFormat,
  pub pixels: Vec<u8>,
  pub captured_at: Instant,
}

#[derive(Default)]
struct MailboxState {
  latest: Option<CapturedFrame>,
  spare_buffers: Vec<Vec<u8>>,
  next_sequence: u64,
  closed: bool,
}

#[derive(Default)]
pub struct FrameMailbox {
  state: Mutex<MailboxState>,
  changed: Condvar,
}

impl FrameMailbox {
  /// Publishes a packed BGRA frame.
  #[cfg_attr(target_os = "macos", allow(dead_code))]
  pub fn publish(&self, width: u32, height: u32, stride: usize, pixels: &[u8]) {
    let Some(required) = FrameFormat::Bgra.len(height as usize, stride) else {
      return;
    };
    if width == 0 || height == 0 || stride < width as usize * 4 || pixels.len() < required {
      return;
    }
    self.store(width, height, stride, FrameFormat::Bgra, |owned| {
      owned.extend_from_slice(&pixels[..required]);
    });
  }

  /// Publishes an NV12 frame from its two planes, which come with whatever row
  /// padding the capture had. They are packed here into one buffer with rows
  /// exactly `width` bytes, so the sender can hand it over as it is.
  pub fn publish_nv12(
    &self,
    width: u32,
    height: u32,
    luma: &[u8],
    luma_stride: usize,
    chroma: &[u8],
    chroma_stride: usize,
  ) {
    let (w, h) = (width as usize, height as usize);
    // 4:2:0 needs even dimensions.
    if w == 0 || h == 0 || w % 2 != 0 || h % 2 != 0 {
      return;
    }
    let (Some(luma_needed), Some(chroma_needed)) = (
      luma_stride.checked_mul(h),
      chroma_stride.checked_mul(h / 2),
    ) else {
      return;
    };
    if luma_stride < w || chroma_stride < w || luma.len() < luma_needed || chroma.len() < chroma_needed
    {
      return;
    }
    self.store(width, height, w, FrameFormat::Nv12, |owned| {
      for row in 0..h {
        owned.extend_from_slice(&luma[row * luma_stride..row * luma_stride + w]);
      }
      for row in 0..h / 2 {
        owned.extend_from_slice(&chroma[row * chroma_stride..row * chroma_stride + w]);
      }
    });
  }

  fn store(
    &self,
    width: u32,
    height: u32,
    stride: usize,
    format: FrameFormat,
    fill: impl FnOnce(&mut Vec<u8>),
  ) {
    let mut state = self
      .state
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    if state.closed {
      return;
    }
    state.next_sequence = state.next_sequence.wrapping_add(1);
    let sequence = state.next_sequence;
    let mut owned = state
      .latest
      .take()
      .map(|frame| frame.pixels)
      .or_else(|| state.spare_buffers.pop())
      .unwrap_or_default();
    owned.clear();
    fill(&mut owned);
    state.latest = Some(CapturedFrame {
      sequence,
      width,
      height,
      stride,
      format,
      pixels: owned,
      captured_at: Instant::now(),
    });
    self.changed.notify_one();
  }

  pub fn wait_first(
    &self,
    timeout: Duration,
    stop: &AtomicBool,
  ) -> Result<CapturedFrame, NdiErrorInfo> {
    let deadline = Instant::now() + timeout;
    let mut state = self
      .state
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    loop {
      if let Some(frame) = state.latest.take() {
        return Ok(frame);
      }
      if state.closed || stop.load(Ordering::Acquire) {
        return Err(NdiErrorInfo::new(
          NdiErrorCode::CaptureStopped,
          "NDI capture stopped before its first frame arrived.",
          true,
        ));
      }
      let now = Instant::now();
      if now >= deadline {
        return Err(
          NdiErrorInfo::new(
            NdiErrorCode::FirstFrameTimeout,
            "The live output did not produce a frame within five seconds.",
            true,
          )
          .hint("Make sure the live output window is visible and not minimized."),
        );
      }
      let wait = deadline.saturating_duration_since(now);
      let (next, _) = self
        .changed
        .wait_timeout(state, wait)
        .unwrap_or_else(|poisoned| poisoned.into_inner());
      state = next;
    }
  }

  pub fn replace_with_latest(&self, current: &mut CapturedFrame) -> bool {
    let mut state = self
      .state
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    let Some(latest) = state.latest.take() else {
      return false;
    };
    let previous = std::mem::replace(current, latest);
    // The sender must retain one frame for static-slide repetition. Once a new
    // frame replaces it, return the old allocation to capture for reuse.
    state.spare_buffers.push(previous.pixels);
    true
  }

  pub fn close(&self) {
    let mut state = self
      .state
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    state.closed = true;
    self.changed.notify_all();
  }
}

pub fn fit_within(width: u32, height: u32, max_width: u32, max_height: u32) -> (u32, u32) {
  if width == 0 || height == 0 || max_width < 2 || max_height < 2 {
    return (0, 0);
  }
  let scale = f64::min(
    1.0,
    f64::min(max_width as f64 / width as f64, max_height as f64 / height as f64),
  );
  let fitted_width = ((width as f64 * scale).floor() as u32).max(2) & !1;
  let fitted_height = ((height as f64 * scale).floor() as u32).max(2) & !1;
  (fitted_width.min(max_width & !1), fitted_height.min(max_height & !1))
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::AtomicBool;

  #[test]
  fn mailbox_keeps_only_the_latest_frame() {
    let mailbox = FrameMailbox::default();
    mailbox.publish(2, 2, 8, &[1; 16]);
    mailbox.publish(2, 2, 8, &[2; 16]);
    let frame = mailbox
      .wait_first(Duration::from_millis(1), &AtomicBool::new(false))
      .unwrap();
    assert_eq!(frame.sequence, 2);
    assert_eq!(frame.pixels, vec![2; 16]);
  }

  #[test]
  fn close_wakes_a_waiting_sender() {
    let mailbox = FrameMailbox::default();
    mailbox.close();
    let result = mailbox.wait_first(Duration::from_secs(1), &AtomicBool::new(false));
    assert_eq!(result.unwrap_err().code, NdiErrorCode::CaptureStopped);
  }

  #[test]
  fn first_frame_wait_has_a_bounded_timeout() {
    let mailbox = FrameMailbox::default();
    let started = Instant::now();
    let result = mailbox.wait_first(Duration::from_millis(5), &AtomicBool::new(false));
    assert_eq!(result.unwrap_err().code, NdiErrorCode::FirstFrameTimeout);
    assert!(started.elapsed() < Duration::from_secs(1));
  }

  #[test]
  fn an_existing_frame_is_retained_until_capture_publishes_an_update() {
    let mailbox = FrameMailbox::default();
    mailbox.publish(2, 2, 8, &[1; 16]);
    let mut current = mailbox
      .wait_first(Duration::from_millis(1), &AtomicBool::new(false))
      .unwrap();
    assert!(!mailbox.replace_with_latest(&mut current));
    assert_eq!(current.sequence, 1);
    assert_eq!(current.pixels, vec![1; 16]);

    mailbox.publish(2, 2, 8, &[2; 16]);
    assert!(mailbox.replace_with_latest(&mut current));
    assert_eq!(current.sequence, 2);
    assert_eq!(current.pixels, vec![2; 16]);
    assert_eq!(
      mailbox
        .state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .spare_buffers
        .len(),
      1
    );
  }

  #[test]
  fn nv12_frames_are_packed_to_the_frame_width() {
    let mailbox = FrameMailbox::default();
    // 4x2 picture; rows carry 2 bytes of padding (stride 6).
    let luma = [1, 1, 1, 1, 9, 9, 2, 2, 2, 2, 9, 9];
    let chroma = [7, 8, 7, 8, 9, 9];
    mailbox.publish_nv12(4, 2, &luma, 6, &chroma, 6);
    let frame = mailbox
      .wait_first(Duration::from_millis(1), &AtomicBool::new(false))
      .unwrap();
    assert_eq!(frame.format, FrameFormat::Nv12);
    assert_eq!(frame.stride, 4);
    assert_eq!(frame.pixels, [1, 1, 1, 1, 2, 2, 2, 2, 7, 8, 7, 8]);
    assert_eq!(FrameFormat::Nv12.len(2, 4), Some(12));
  }

  #[test]
  fn nv12_with_odd_dimensions_or_short_planes_is_refused() {
    let mailbox = FrameMailbox::default();
    mailbox.publish_nv12(3, 2, &[0; 12], 6, &[0; 6], 6);
    mailbox.publish_nv12(4, 2, &[0; 4], 4, &[0; 4], 4);
    let result = mailbox.wait_first(Duration::from_millis(5), &AtomicBool::new(false));
    assert_eq!(result.unwrap_err().code, NdiErrorCode::FirstFrameTimeout);
  }

  #[test]
  fn dimensions_fit_inside_1080p_and_remain_even() {
    assert_eq!(fit_within(3840, 2160, 1920, 1080), (1920, 1080));
    assert_eq!(fit_within(2160, 3840, 1920, 1080), (606, 1080));
    assert_eq!(fit_within(1919, 1079, 1920, 1080), (1918, 1078));
    assert_eq!(fit_within(1280, 720, 1920, 1080), (1280, 720));
  }
}
