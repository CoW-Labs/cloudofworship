//! Audio mixer for the live window stream (macOS).
//!
//! The stream used to take one audio input device straight into FFmpeg, so
//! anything the app itself played (a video slide, a song track) never reached
//! the broadcast. The mixer fixes that by owning the audio instead:
//!
//! * the **microphone** (the chosen input device) is read by a small FFmpeg
//!   process that writes raw 48 kHz stereo floats;
//! * the **app audio** is captured with ScreenCaptureKit, filtered to this app
//!   only, so nothing else on the computer (notifications, music) leaks in;
//! * a mixer thread adds the two with their own gain and mute, ten
//!   milliseconds at a time, and writes the result to the encoder over a
//!   loopback socket as one steady stream.
//!
//! Because the mixer always writes a steady stream (silence when both sources
//! are quiet), the encoder always has an audio track, which YouTube needs to
//! show data and sound from the first second.
//!
//! Performance: the mixer thread wakes 100 times a second and adds 960
//! floats per source, which is well under 0.1% of one core. The levels event
//! is only sent while the mixer panel is open.

use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::process::{Child, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use screencapturekit::cm::CMSampleBufferExt;
use screencapturekit::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::MixerSettings;

pub const MIC: usize = 0;
pub const APP: usize = 1;

/// Event the panel listens on while it is open.
const LEVELS_EVENT: &str = "stream://mixer-levels";

const SAMPLE_RATE: u32 = 48_000;
/// One mixer step is 10 ms of audio.
const TICK_FRAMES: usize = 480;
const TICK: Duration = Duration::from_millis(10);
/// A source starts playing once it has this much queued, so bursty delivery
/// (capture callbacks come in 10 to 20 ms lumps) doesn't leave gaps.
const PRIME_FRAMES: usize = 2_400;
/// A source that runs ahead of the clock is trimmed back to the primed amount
/// past this, so latency can never grow without bound.
const MAX_QUEUE_FRAMES: usize = 9_600;
/// How many ticks pass between level readings (80 ms).
const LEVEL_EVERY_TICKS: u64 = 8;
const SILENCE_DB: f32 = -90.0;
const MAX_GAIN: f32 = 2.0;
/// A stall up to this long is caught up on; a longer one restarts the clock.
const MAX_CATCH_UP: Duration = Duration::from_secs(5);
/// The encoder connects within a second; give up well after that.
const ACCEPT_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Levels {
  /// dB peak since the last reading, `None` when the source isn't running.
  mic: Option<f32>,
  app: Option<f32>,
  master: f32,
}

/// Whether the app's own audio is being captured, and if not, why.
#[derive(Clone)]
pub enum AppAudio {
  Capturing,
  Unavailable(String),
}

struct Source {
  gain: AtomicU32,
  muted: AtomicBool,
  /// Largest absolute sample since the last reading, as `f32` bits (positive
  /// floats order the same as their bits, so `fetch_max` works).
  peak: AtomicU32,
  /// True while something is feeding this source.
  present: AtomicBool,
  /// Interleaved stereo samples waiting to be mixed.
  queue: Mutex<VecDeque<f32>>,
}

impl Source {
  fn new(gain: f32, muted: bool) -> Self {
    Self {
      gain: AtomicU32::new(gain.clamp(0.0, MAX_GAIN).to_bits()),
      muted: AtomicBool::new(muted),
      peak: AtomicU32::new(0),
      present: AtomicBool::new(false),
      queue: Mutex::new(VecDeque::new()),
    }
  }

  fn gain(&self) -> f32 {
    f32::from_bits(self.gain.load(Ordering::Relaxed))
  }

  fn target(&self) -> f32 {
    if self.muted.load(Ordering::Relaxed) { 0.0 } else { self.gain() }
  }
}

pub struct Mixer {
  sources: [Source; 2],
  levels_on: AtomicBool,
  stop: AtomicBool,
  port: u16,
  app_audio: Mutex<AppAudio>,
  /// Audio buffers received from the app capture, for the "is anything
  /// arriving" check a few seconds in.
  app_packets: AtomicU64,
  threads: Mutex<Vec<JoinHandle<()>>>,
  mic_child: Mutex<Option<Child>>,
  app_capture: Mutex<Option<SCStream>>,
}

/// What the panel shows for one source.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceState {
  pub present: bool,
  pub gain: f32,
  pub muted: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MixerState {
  pub active: bool,
  pub mic: SourceState,
  pub app: SourceState,
  /// Why app audio isn't being captured, in plain words.
  pub app_reason: Option<String>,
}

impl MixerState {
  pub fn inactive() -> Self {
    let off = SourceState { present: false, gain: 1.0, muted: false };
    Self { active: false, mic: off.clone(), app: off, app_reason: None }
  }
}

impl Mixer {
  /// Starts the mixer thread, the microphone reader (when a device is chosen)
  /// and the app audio capture. The encoder connects to [`Mixer::port`].
  pub fn start(
    app: AppHandle,
    mic_device: Option<String>,
    settings: MixerSettings,
  ) -> Result<Arc<Self>, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
      .map_err(|e| format!("Could not set up the audio mixer ({e})."))?;
    let port = listener.local_addr().map_err(|e| format!("Could not set up the audio mixer ({e})."))?.port();

    let mixer = Arc::new(Self {
      sources: [
        Source::new(settings.mic_gain, settings.mic_muted),
        Source::new(settings.app_gain, settings.app_muted),
      ],
      levels_on: AtomicBool::new(false),
      stop: AtomicBool::new(false),
      port,
      app_audio: Mutex::new(AppAudio::Unavailable("Not started.".into())),
      app_packets: AtomicU64::new(0),
      threads: Mutex::new(Vec::new()),
      mic_child: Mutex::new(None),
      app_capture: Mutex::new(None),
    });

    let mut threads = Vec::new();
    {
      let mixer = mixer.clone();
      if let Ok(handle) = std::thread::Builder::new()
        .name("cow-audio-mixer".into())
        .spawn(move || run_mixer(mixer, app, listener))
      {
        threads.push(handle);
      }
    }
    if let Some(device) = mic_device {
      mixer.sources[MIC].present.store(true, Ordering::Relaxed);
      let mixer = mixer.clone();
      if let Ok(handle) = std::thread::Builder::new()
        .name("cow-audio-mic".into())
        .spawn(move || run_mic(mixer, device))
      {
        threads.push(handle);
      }
    }
    *mixer.threads.lock().unwrap_or_else(|p| p.into_inner()) = threads;

    match start_app_capture(&mixer) {
      Ok(stream) => {
        *mixer.app_capture.lock().unwrap_or_else(|p| p.into_inner()) = Some(stream);
        mixer.sources[APP].present.store(true, Ordering::Relaxed);
        *mixer.app_audio.lock().unwrap_or_else(|p| p.into_inner()) = AppAudio::Capturing;
        log::info!("audio mixer: capturing this app's audio");
      }
      Err(reason) => {
        log::warn!("audio mixer: app audio unavailable ({reason})");
        *mixer.app_audio.lock().unwrap_or_else(|p| p.into_inner()) = AppAudio::Unavailable(reason);
      }
    }
    Ok(mixer)
  }

  /// The loopback port the encoder reads the mixed audio from.
  pub fn port(&self) -> u16 {
    self.port
  }

  pub fn set(&self, source: &str, gain: Option<f32>, muted: Option<bool>) -> Result<(), String> {
    let index = match source {
      "mic" => MIC,
      "app" => APP,
      other => return Err(format!("Unknown audio source “{other}”.")),
    };
    let source = &self.sources[index];
    if let Some(gain) = gain {
      source.gain.store(gain.clamp(0.0, MAX_GAIN).to_bits(), Ordering::Relaxed);
    }
    if let Some(muted) = muted {
      source.muted.store(muted, Ordering::Relaxed);
    }
    Ok(())
  }

  pub fn set_levels(&self, on: bool) {
    self.levels_on.store(on, Ordering::Relaxed);
  }

  pub fn state(&self) -> MixerState {
    let describe = |index: usize| {
      let source = &self.sources[index];
      SourceState {
        present: source.present.load(Ordering::Relaxed),
        gain: source.gain(),
        muted: source.muted.load(Ordering::Relaxed),
      }
    };
    let app_reason = match &*self.app_audio.lock().unwrap_or_else(|p| p.into_inner()) {
      AppAudio::Capturing => None,
      AppAudio::Unavailable(reason) => Some(reason.clone()),
    };
    MixerState { active: true, mic: describe(MIC), app: describe(APP), app_reason }
  }

  fn push(&self, index: usize, samples: &[f32]) {
    let mut queue = self.sources[index].queue.lock().unwrap_or_else(|p| p.into_inner());
    queue.extend(samples.iter().copied());
    // Nothing is draining yet (the encoder hasn't connected): keep it bounded.
    let cap = MAX_QUEUE_FRAMES * 2 * 2;
    if queue.len() > cap {
      let excess = queue.len() - cap;
      queue.drain(..excess);
    }
  }

  /// Stops everything and waits for the threads. Safe to call twice.
  pub fn stop(&self) {
    self.stop.store(true, Ordering::Release);
    if let Some(mut child) = self.mic_child.lock().unwrap_or_else(|p| p.into_inner()).take() {
      let _ = child.kill();
      let _ = child.wait();
    }
    if let Some(stream) = self.app_capture.lock().unwrap_or_else(|p| p.into_inner()).take() {
      let _ = stream.stop_capture();
    }
    let threads = std::mem::take(&mut *self.threads.lock().unwrap_or_else(|p| p.into_inner()));
    for thread in threads {
      let _ = thread.join();
    }
  }
}

fn to_db(linear: f32) -> f32 {
  if linear <= 0.000_03 { SILENCE_DB } else { (20.0 * linear.log10()).max(SILENCE_DB) }
}

/// Keeps a loud sum from clipping hard: linear up to 0.9, then a smooth bend
/// towards full scale.
fn soft_limit(x: f32) -> f32 {
  let a = x.abs();
  if a <= 0.9 {
    x
  } else {
    x.signum() * (0.9 + 0.1 * ((a - 0.9) / 0.1).tanh())
  }
}

/// Writes one slice. `Ok(false)` means nothing was written because the encoder
/// is backed up, so the slice can be skipped cleanly. Once a slice has started
/// it is finished (or the connection is dropped), because a torn slice would
/// shift every sample after it and turn the audio into noise.
fn write_slice(stream: &mut TcpStream, bytes: &[u8], stop: &AtomicBool) -> std::io::Result<bool> {
  use std::io::ErrorKind::{Interrupted, TimedOut, WouldBlock};
  let mut written = 0;
  let started = Instant::now();
  while written < bytes.len() {
    match stream.write(&bytes[written..]) {
      Ok(0) => return Err(std::io::ErrorKind::WriteZero.into()),
      Ok(n) => written += n,
      Err(e) if e.kind() == Interrupted => {}
      Err(e) if matches!(e.kind(), TimedOut | WouldBlock) => {
        if written == 0 {
          return Ok(false);
        }
        if stop.load(Ordering::Acquire) || started.elapsed() > Duration::from_secs(5) {
          return Err(e);
        }
      }
      Err(e) => return Err(e),
    }
  }
  Ok(true)
}

fn run_mixer(mixer: Arc<Mixer>, app: AppHandle, listener: TcpListener) {
  let _ = listener.set_nonblocking(true);
  let deadline = Instant::now() + ACCEPT_TIMEOUT;
  let mut stream: TcpStream = loop {
    match listener.accept() {
      Ok((stream, _)) => break stream,
      Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
        if mixer.stop.load(Ordering::Acquire) || Instant::now() > deadline {
          log::warn!("audio mixer: the encoder never connected");
          return;
        }
        std::thread::sleep(Duration::from_millis(20));
      }
      Err(_) => return,
    }
  };
  let _ = stream.set_nonblocking(false);
  let _ = stream.set_nodelay(true);
  let _ = stream.set_write_timeout(Some(Duration::from_millis(250)));
  log::info!("audio mixer: encoder connected, {SAMPLE_RATE} Hz stereo");

  let mut current = [mixer.sources[MIC].target(), mixer.sources[APP].target()];
  let mut primed = [false; 2];
  let mut out = vec![0f32; TICK_FRAMES * 2];
  let mut chunk = vec![0f32; TICK_FRAMES * 2];
  let mut bytes = Vec::with_capacity(TICK_FRAMES * 2 * 4);
  let mut next = Instant::now();
  let mut ticks: u64 = 0;
  let mut master_peak: f32 = 0.0;
  let mut warned_silent_app = false;
  let mut skipped_writes: u64 = 0;

  while !mixer.stop.load(Ordering::Acquire) {
    next += TICK;
    let now = Instant::now();
    if next > now {
      std::thread::sleep(next - now);
    } else if now - next > MAX_CATCH_UP {
      // The computer slept or froze for seconds: there is nothing sensible to
      // catch up on, so start the clock again from here.
      log::warn!("audio mixer: the computer paused the mixer for {:?}", now - next);
      next = now;
    }
    // Shorter stalls are made up by running the next ticks back to back (the
    // loop sleeps only while it is ahead). The encoder times audio by the
    // samples it has received, and the video pacer already catches up this
    // way, so skipping time here would leave the sound behind the picture for
    // the rest of the stream.

    out.iter_mut().for_each(|s| *s = 0.0);
    for index in 0..2 {
      let source = &mixer.sources[index];
      let have = {
        let mut queue = source.queue.lock().unwrap_or_else(|p| p.into_inner());
        let frames = queue.len() / 2;
        if !primed[index] && frames >= PRIME_FRAMES {
          primed[index] = true;
        }
        if primed[index] && frames > MAX_QUEUE_FRAMES {
          let drop = (frames - PRIME_FRAMES) * 2;
          queue.drain(..drop);
        }
        if primed[index] && queue.len() / 2 >= TICK_FRAMES {
          for (slot, sample) in chunk.iter_mut().zip(queue.drain(..TICK_FRAMES * 2)) {
            *slot = sample;
          }
          true
        } else {
          // Ran dry: wait for it to build up again rather than stutter.
          primed[index] = false;
          false
        }
      };
      let target = source.target();
      let from = current[index];
      current[index] = target;
      if !have {
        continue;
      }
      let mut peak = 0f32;
      for frame in 0..TICK_FRAMES {
        // Ramp the gain across the step so a slider drag never clicks.
        let gain = from + (target - from) * ((frame + 1) as f32 / TICK_FRAMES as f32);
        let left = chunk[frame * 2] * gain;
        let right = chunk[frame * 2 + 1] * gain;
        out[frame * 2] += left;
        out[frame * 2 + 1] += right;
        peak = peak.max(left.abs()).max(right.abs());
      }
      source.peak.fetch_max(peak.to_bits(), Ordering::Relaxed);
    }

    bytes.clear();
    for sample in &out {
      let limited = soft_limit(*sample);
      master_peak = master_peak.max(limited.abs());
      bytes.extend_from_slice(&limited.to_le_bytes());
    }
    match write_slice(&mut stream, &bytes, &mixer.stop) {
      Ok(true) => {}
      Ok(false) => {
        // The encoder is backed up (a slow upload holds it for a moment). The
        // slice never started, so skipping it keeps the stream aligned. Giving
        // up here would silence the rest of the stream even after the upload
        // recovers.
        skipped_writes += 1;
        if skipped_writes == 1 || skipped_writes % 100 == 0 {
          log::warn!("audio mixer: the encoder is behind; dropped {skipped_writes} slices so far");
        }
        continue;
      }
      Err(error) => {
        log::warn!("audio mixer: the encoder closed the audio connection ({error})");
        break;
      }
    }

    ticks += 1;
    if ticks % LEVEL_EVERY_TICKS == 0 {
      let mic = f32::from_bits(mixer.sources[MIC].peak.swap(0, Ordering::Relaxed));
      let app_peak = f32::from_bits(mixer.sources[APP].peak.swap(0, Ordering::Relaxed));
      let master = master_peak;
      master_peak = 0.0;
      if mixer.levels_on.load(Ordering::Relaxed) {
        let reading = |index: usize, peak: f32| {
          mixer.sources[index].present.load(Ordering::Relaxed).then(|| to_db(peak))
        };
        let _ = app.emit(
          LEVELS_EVENT,
          Levels { mic: reading(MIC, mic), app: reading(APP, app_peak), master: to_db(master) },
        );
      }
    }
    // Five seconds in: say so if the app capture never delivered anything,
    // so a permissions or attribution problem shows up in the log.
    if ticks == 500 && !warned_silent_app {
      warned_silent_app = true;
      let capturing = matches!(
        &*mixer.app_audio.lock().unwrap_or_else(|p| p.into_inner()),
        AppAudio::Capturing
      );
      if capturing && mixer.app_packets.load(Ordering::Relaxed) == 0 {
        log::warn!("audio mixer: app audio capture started but no audio has arrived");
      }
    }
  }
}

/// Reads the microphone through its own FFmpeg process and feeds the mixer,
/// restarting it if the device drops out.
fn run_mic(mixer: Arc<Mixer>, device: String) {
  let mut failures = 0;
  while !mixer.stop.load(Ordering::Acquire) {
    let started = Instant::now();
    let mut args = ["-hide_banner", "-loglevel", "error"].map(String::from).to_vec();
    args.extend(super::audio_input_args(&device));
    args.extend(["-ac", "2", "-ar", "48000", "-f", "f32le", "pipe:1"].map(String::from));
    let mut child = match super::ffmpeg_command()
      .args(args)
      .stdin(Stdio::null())
      .stdout(Stdio::piped())
      .stderr(Stdio::null())
      .spawn()
    {
      Ok(child) => child,
      Err(e) => {
        log::warn!("audio mixer: could not start the microphone reader ({e})");
        break;
      }
    };
    let Some(mut stdout) = child.stdout.take() else { break };
    *mixer.mic_child.lock().unwrap_or_else(|p| p.into_inner()) = Some(child);
    if mixer.stop.load(Ordering::Acquire) {
      break;
    }

    let mut buffer = vec![0u8; 8192];
    let mut carry: Vec<u8> = Vec::new();
    let mut samples: Vec<f32> = Vec::with_capacity(2048);
    loop {
      let read = match stdout.read(&mut buffer) {
        Ok(0) | Err(_) => break,
        Ok(n) => n,
      };
      carry.extend_from_slice(&buffer[..read]);
      // Whole stereo frames only (8 bytes), so channels never swap.
      let usable = carry.len() / 8 * 8;
      samples.clear();
      samples.extend(carry[..usable].chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])));
      carry.drain(..usable);
      mixer.push(MIC, &samples);
    }

    if let Some(mut child) = mixer.mic_child.lock().unwrap_or_else(|p| p.into_inner()).take() {
      let _ = child.kill();
      let _ = child.wait();
    }
    if mixer.stop.load(Ordering::Acquire) {
      break;
    }
    failures = if started.elapsed() > Duration::from_secs(10) { 1 } else { failures + 1 };
    if failures >= 5 {
      log::warn!("audio mixer: the microphone keeps dropping out; giving up on it");
      mixer.sources[MIC].present.store(false, Ordering::Relaxed);
      break;
    }
    log::warn!("audio mixer: the microphone input ended; restarting it");
    std::thread::sleep(Duration::from_secs(1));
  }
}

/// ScreenCaptureKit audio for this app only. The picture side is the smallest
/// the API allows at one frame a second: it is only here to carry the audio.
fn start_app_capture(mixer: &Arc<Mixer>) -> Result<SCStream, String> {
  let content = SCShareableContent::create()
    .with_on_screen_windows_only(false)
    .get()
    .map_err(|e| {
      format!(
        "macOS refused to list the apps ({e}). Allow Cloud of Worship in System Settings, \
         Privacy & Security, Screen & System Audio Recording."
      )
    })?;
  let display = content.displays().into_iter().next().ok_or("No display was found.")?;
  let pid = std::process::id() as i32;
  let apps = content.applications();
  let this_app = apps
    .iter()
    .find(|a| a.process_id() == pid)
    .ok_or("macOS did not list Cloud of Worship as a running app.")?;
  let filter = SCContentFilter::create()
    .with_display(&display)
    .with_including_applications(&[this_app], &[])
    .try_build()
    .map_err(|e| format!("Could not set up app audio capture ({e})."))?;
  let configuration = SCStreamConfiguration::new()
    .with_width(2)
    .with_height(2)
    .with_minimum_frame_interval(&CMTime::new(1, 1))
    .with_captures_audio(true)
    .with_sample_rate(SAMPLE_RATE as i32)
    .with_channel_count(2);

  let mut stream = SCStream::new(&filter, &configuration);
  let target = mixer.clone();
  let audio_handler = stream.add_output_handler(
    move |sample: CMSampleBuffer, kind: SCStreamOutputType| {
      if kind != SCStreamOutputType::Audio {
        return;
      }
      target.app_packets.fetch_add(1, Ordering::Relaxed);
      let Some(list) = sample.audio_buffer_list() else { return };
      let float = |data: &[u8]| -> Vec<f32> {
        data.chunks_exact(4).map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]])).collect()
      };
      let mut interleaved: Vec<f32>;
      if list.num_buffers() >= 2 {
        // One buffer per channel (the usual shape): weave left and right.
        let (Some(left), Some(right)) = (list.buffer(0), list.buffer(1)) else { return };
        let (left, right) = (float(left.data()), float(right.data()));
        let frames = left.len().min(right.len());
        interleaved = Vec::with_capacity(frames * 2);
        for i in 0..frames {
          interleaved.push(left[i]);
          interleaved.push(right[i]);
        }
      } else if let Some(buffer) = list.get(0) {
        let data = float(buffer.data());
        if buffer.number_channels >= 2 {
          interleaved = data;
        } else {
          interleaved = Vec::with_capacity(data.len() * 2);
          for sample in data {
            interleaved.push(sample);
            interleaved.push(sample);
          }
        }
      } else {
        return;
      }
      target.push(APP, &interleaved);
    },
    SCStreamOutputType::Audio,
  );
  if audio_handler.is_none() {
    return Err("macOS rejected the app audio capture.".into());
  }
  // The stream also produces tiny pictures; give them somewhere to go so the
  // system doesn't log a dropped frame for each one.
  let _ = stream.add_output_handler(|_: CMSampleBuffer, _: SCStreamOutputType| {}, SCStreamOutputType::Screen);
  stream
    .start_capture()
    .map_err(|e| format!("Could not start app audio capture ({e})."))?;
  Ok(stream)
}
