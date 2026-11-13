//! Loopback benchmark for the real NDI runtime on this machine.
//!
//! The NDI SDK only compresses frames when a receiver is connected, so timing
//! `send` alone would measure nothing. This sends synthetic frames through the
//! app's own sender while a receiver in the same process pulls them, and
//! reports whether the sender held its frame rate and how much CPU the whole
//! thing used. It needs the NDI runtime installed, so it only runs on request:
//! `cargo test --lib ndi::bench -- --ignored --nocapture --test-threads=1`

use std::ffi::{c_char, c_int, c_void, CStr, CString};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use super::ffi::NdiVideoFrameV2;
use super::pipeline::{CapturedFrame, FrameFormat};
use super::runtime;
use super::sender::NdiSender;

#[repr(C)]
struct FindCreate {
  show_local_sources: bool,
  groups: *const c_char,
  extra_ips: *const c_char,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Source {
  name: *const c_char,
  url: *const c_char,
}

#[repr(C)]
struct RecvCreate {
  source: Source,
  color_format: c_int,
  bandwidth: c_int,
  allow_video_fields: bool,
  recv_name: *const c_char,
}

type FindCreateFn = unsafe extern "C" fn(*const FindCreate) -> *mut c_void;
type FindDestroyFn = unsafe extern "C" fn(*mut c_void);
type FindWaitFn = unsafe extern "C" fn(*mut c_void, u32) -> bool;
type FindSourcesFn = unsafe extern "C" fn(*mut c_void, *mut u32) -> *const Source;
type RecvCreateFn = unsafe extern "C" fn(*const RecvCreate) -> *mut c_void;
type RecvDestroyFn = unsafe extern "C" fn(*mut c_void);
type RecvCaptureFn = unsafe extern "C" fn(
  *mut c_void,
  *mut NdiVideoFrameV2,
  *mut c_void,
  *mut c_void,
  u32,
) -> c_int;
type RecvFreeVideoFn = unsafe extern "C" fn(*mut c_void, *const NdiVideoFrameV2);

#[repr(C)]
struct Timeval {
  sec: i64,
  usec: i32,
  _pad: i32,
}

#[repr(C)]
struct Rusage {
  utime: Timeval,
  stime: Timeval,
  rest: [i64; 14],
}

extern "C" {
  fn getrusage(who: c_int, usage: *mut Rusage) -> c_int;
}

fn cpu_seconds() -> f64 {
  let mut usage: Rusage = unsafe { std::mem::zeroed() };
  unsafe { getrusage(0, &mut usage) };
  let to_s = |t: &Timeval| t.sec as f64 + t.usec as f64 / 1e6;
  to_s(&usage.utime) + to_s(&usage.stime)
}

/// A gradient that shifts each frame. Pure random noise isn't used: it stalls
/// the SDK at any size (it is gigabits per second of incompressible data) and
/// says nothing about slides or video.
fn frame(format: FrameFormat, width: u32, height: u32, shade: u8) -> CapturedFrame {
  let (w, h) = (width as usize, height as usize);
  let (stride, len) = match format {
    FrameFormat::Bgra => (w * 4, w * 4 * h),
    FrameFormat::Nv12 => (w, w * h * 3 / 2),
  };
  let mut pixels = vec![0u8; len];
  for (i, byte) in pixels.iter_mut().enumerate() {
    *byte = shade.wrapping_add(((i % stride) / 4) as u8).wrapping_add((i / stride) as u8);
  }
  CapturedFrame {
    sequence: 0,
    width,
    height,
    stride,
    format,
    pixels,
    captured_at: Instant::now(),
  }
}

fn run(format: FrameFormat, width: u32, height: u32, fps: u32, seconds: u32) {
  let runtime = runtime::load().expect("NDI runtime");
  let library = runtime.library();
  let find_create: FindCreateFn = unsafe { *library.get(b"NDIlib_find_create_v2\0").unwrap() };
  let find_destroy: FindDestroyFn = unsafe { *library.get(b"NDIlib_find_destroy\0").unwrap() };
  let find_wait: FindWaitFn = unsafe { *library.get(b"NDIlib_find_wait_for_sources\0").unwrap() };
  let find_sources: FindSourcesFn =
    unsafe { *library.get(b"NDIlib_find_get_current_sources\0").unwrap() };
  let recv_create: RecvCreateFn = unsafe { *library.get(b"NDIlib_recv_create_v3\0").unwrap() };
  let recv_destroy: RecvDestroyFn = unsafe { *library.get(b"NDIlib_recv_destroy\0").unwrap() };
  let recv_capture: RecvCaptureFn = unsafe { *library.get(b"NDIlib_recv_capture_v2\0").unwrap() };
  let recv_free: RecvFreeVideoFn = unsafe { *library.get(b"NDIlib_recv_free_video_v2\0").unwrap() };

  let sender = NdiSender::new(runtime).expect("sender");

  // Find our own source, then receive from it.
  let finder = unsafe {
    find_create(&FindCreate { show_local_sources: true, groups: std::ptr::null(), extra_ips: std::ptr::null() })
  };
  let mut source_name: Option<CString> = None;
  let deadline = Instant::now() + Duration::from_secs(15);
  while source_name.is_none() && Instant::now() < deadline {
    unsafe { find_wait(finder, 1000) };
    let mut count = 0u32;
    let sources = unsafe { find_sources(finder, &mut count) };
    for i in 0..count as usize {
      let name = unsafe { CStr::from_ptr((*sources.add(i)).name) };
      if name.to_string_lossy().contains("CoW Live Output") {
        source_name = Some(name.to_owned());
      }
    }
  }
  let source_name = source_name.expect("the sender's own source was never discovered");
  let receiver_name = CString::new("bench receiver").unwrap();
  let receiver = unsafe {
    recv_create(&RecvCreate {
      source: Source { name: source_name.as_ptr(), url: std::ptr::null() },
      color_format: 1, // UYVY, BGRA when there is alpha
      bandwidth: 100,  // highest
      allow_video_fields: false,
      recv_name: receiver_name.as_ptr(),
    })
  };
  assert!(!receiver.is_null(), "receiver could not be created");

  let received = Arc::new(AtomicU64::new(0));
  let stop = Arc::new(AtomicBool::new(false));
  let receiver_ptr = receiver as usize;
  let (received_in, stop_in) = (received.clone(), stop.clone());
  let receiving = std::thread::spawn(move || {
    let receiver = receiver_ptr as *mut c_void;
    while !stop_in.load(Ordering::Relaxed) {
      let mut video: NdiVideoFrameV2 = unsafe { std::mem::zeroed() };
      let kind = unsafe {
        recv_capture(receiver, &mut video, std::ptr::null_mut(), std::ptr::null_mut(), 100)
      };
      if kind == 1 {
        received_in.fetch_add(1, Ordering::Relaxed);
        unsafe { recv_free(receiver, &video) };
      }
    }
  });

  let mut frames: Vec<_> = (0..4).map(|i| frame(format, width, height, i * 40)).collect();

  // Warm up until the receiver is connected, so compression is really running.
  let warm = Instant::now();
  while sender.connection_count() == 0 && warm.elapsed() < Duration::from_secs(10) {
    sender.send(&mut frames[0], fps).unwrap();
  }
  assert!(sender.connection_count() > 0, "the receiver never connected");
  for i in 0..fps * 2 {
    sender.send(&mut frames[(i % 4) as usize], fps).unwrap();
  }

  let total = fps * seconds;
  let received_before = received.load(Ordering::Relaxed);
  let cpu_before = cpu_seconds();
  let started = Instant::now();
  let mut slowest = Duration::ZERO;
  let mut late = 0u32;
  let budget = Duration::from_secs_f64(1.0 / fps as f64);
  for i in 0..total {
    let begin = Instant::now();
    sender.send(&mut frames[(i % 4) as usize], fps).unwrap();
    let took = begin.elapsed();
    slowest = slowest.max(took);
    if took > budget * 3 / 2 {
      late += 1;
    }
  }
  let elapsed = started.elapsed().as_secs_f64();
  let cpu = cpu_seconds() - cpu_before;
  let received_frames = received.load(Ordering::Relaxed) - received_before;

  stop.store(true, Ordering::Relaxed);
  receiving.join().unwrap();
  unsafe {
    recv_destroy(receiver);
    find_destroy(finder);
  }
  drop(sender);

  println!(
    "{width}x{height} {fps} fps {:?}: sent {total} frames in {elapsed:.2}s = {:.1} fps (need {fps}), \
     {late} late sends, slowest {:?}; receiver got {:.1} fps; CPU {:.0}% of one core \
     (sender and loopback receiver together)",
    format,
    total as f64 / elapsed,
    slowest,
    received_frames as f64 / elapsed,
    cpu / elapsed * 100.0,
  );
}

#[test]
#[ignore]
fn ndi_1080p30_bgra_the_old_path() {
  run(FrameFormat::Bgra, 1920, 1080, 30, 8);
}

#[test]
#[ignore]
fn ndi_1080p30_nv12() {
  run(FrameFormat::Nv12, 1920, 1080, 30, 8);
}

#[test]
#[ignore]
fn ndi_1080p60_nv12() {
  run(FrameFormat::Nv12, 1920, 1080, 60, 8);
}

#[test]
#[ignore]
fn ndi_2160p30_nv12() {
  run(FrameFormat::Nv12, 3840, 2160, 30, 8);
}

#[test]
#[ignore]
fn ndi_2160p60_nv12() {
  run(FrameFormat::Nv12, 3840, 2160, 60, 8);
}
