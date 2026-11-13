//! Local screen/audio → YouTube streaming, OBS-style: one FFmpeg process
//! captures + encodes on this machine and pushes RTMP straight to the platform,
//! so no server-side transcoding is needed. This module is the *shared*
//! orchestration — process lifecycle, encoder settings, RTMP push, status — and
//! is identical on every OS. The only per-OS piece is native capture *input*.
//!
//! Sources: `"native-window"` captures the live output window itself by its
//! window handle (macOS and Windows, see `window_capture`) plus an audio input —
//! no picker;
//! `"screen"` captures the display (+ audio) natively; `"browser"` takes a
//! recorded feed pushed from the webview (the live window's content captured
//! through the OS picker, see `stream_feed`), the fallback where native window
//! capture isn't available; any other value
//! streams a synthetic test pattern (color bars + tone), kept for quick
//! debugging of the FFmpeg spawn → encode → RTMP → YouTube → stop pipeline.
//!
//! Window and browser feeds run as two FFmpeg processes, the same split the streaming
//! server uses: an *encoder* reads frames or the page's recording on stdin and emits
//! MPEG-TS, and a *pusher* copies that TS to YouTube. Only the pusher talks to
//! the network, so a dropped connection restarts just the pusher while the
//! encoder (and the page's recording) keeps running — TS can be joined mid-way.

use std::io::{Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::JoinHandle;
use std::time::Duration;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter, State};

mod keep_awake;
mod quality;
mod stats;
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod window_capture;

pub use quality::StreamQuality;
use quality::{Codec, AUDIO_KBPS};
pub use stats::Counters;

/// YouTube's primary RTMP ingest. The stream key is appended as the last path
/// segment, e.g. rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx-xxxx-xxxx.
const YOUTUBE_INGEST_BASE: &str = "rtmp://a.rtmp.youtube.com/live2";

/// Event name the frontend listens on for live status changes.
const STATUS_EVENT: &str = "stream://status";

/// YouTube's RTMP ingest host and port, for the pre-flight reachability check.
const YOUTUBE_INGEST_HOST: &str = "a.rtmp.youtube.com:1935";

/// How often the supervisor polls the FFmpeg child for exit / a stop request.
const MONITOR_POLL: Duration = Duration::from_millis(500);

/// Backoff schedule for reconnecting after an unexpected FFmpeg exit (network
/// blip, YouTube hiccup). Exhausting it gives up and reports an error.
const RECONNECT_BACKOFF: [Duration; 4] = [
  Duration::from_secs(2),
  Duration::from_secs(5),
  Duration::from_secs(10),
  Duration::from_secs(15),
];

/// Keep reconnecting for a good while — an outage can last a minute or two, and
/// we want to recover whenever the network returns rather than give up early.
/// After this many consecutive failures (~3 min at the capped backoff) we
/// surface an error so a genuinely broken key/config doesn't retry forever.
const MAX_RECONNECT_ATTEMPTS: usize = 15;

/// How long a process must stay up to be considered healthy — after which the
/// reconnect budget resets, so a blip an hour into a service isn't counted
/// against the same budget as an immediate bad-key crash loop.
const HEALTHY_AFTER: Duration = Duration::from_secs(30);

#[derive(Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StreamPhase {
  Idle,
  Live,
  Reconnecting,
  Error,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamStatus {
  pub phase: StreamPhase,
  pub error: Option<String>,
}

impl Default for StreamStatus {
  fn default() -> Self {
    Self { phase: StreamPhase::Idle, error: None }
  }
}

/// A selectable capture input (currently audio). `index` is FFmpeg's
/// avfoundation device index; `name` is what the operator sees.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
  pub index: String,
  pub name: String,
}

#[derive(Clone)]
pub struct StreamBridge {
  inner: Arc<Inner>,
}

struct Inner {
  app: AppHandle,
  /// Serializes start/stop so two operations can't interleave.
  operation: Mutex<()>,
  session: Mutex<Option<Session>>,
  status: Mutex<StreamStatus>,
  /// The pre-flight audio meter's FFmpeg process, while it runs.
  meter: Mutex<Option<Child>>,
}

struct Session {
  /// The current FFmpeg process — `None` between reconnect attempts. Shared with
  /// the supervisor (try_wait) and stop (kill) under one lock.
  child: Arc<Mutex<Option<Child>>>,
  /// Set before we kill the child, so the supervisor knows the exit was intended
  /// (a stop, not a crash) and neither reconnects nor reports an error.
  stopping: Arc<AtomicBool>,
  /// The reconnect supervisor thread.
  supervisor: Option<JoinHandle<()>>,
  /// Window/browser-feed sessions only: the encoder process and its stdin,
  /// which the window capture or `stream_feed` writes into.
  feed: Option<Feed>,
}

struct Feed {
  encoder: Child,
  input: Arc<Mutex<Option<ChildStdin>>>,
  forwarder: Option<JoinHandle<()>>,
  /// Stops whatever produces the input (the native window capture).
  stop_source: Option<Box<dyn FnOnce() + Send>>,
  /// Live numbers for the operator, and the thread that reports them.
  counters: Arc<Counters>,
  reporter: Option<JoinHandle<()>>,
  /// Keeps macOS from napping the app (and the Mac from sleeping) while live.
  _awake: Option<keep_awake::KeepAwake>,
}

/// How a (re)spawn of the supervised process is done. Shared so reconnects run
/// exactly the same command as the first attempt.
type Spawner = Arc<dyn Fn() -> std::io::Result<Child> + Send + Sync>;

impl StreamBridge {
  pub fn new(app: AppHandle) -> Self {
    Self {
      inner: Arc::new(Inner {
        app,
        operation: Mutex::new(()),
        session: Mutex::new(None),
        status: Mutex::new(StreamStatus::default()),
        meter: Mutex::new(None),
      }),
    }
  }

  pub fn status(&self) -> StreamStatus {
    self.inner.status.lock().unwrap_or_else(|p| p.into_inner()).clone()
  }

  /// Records a new status and pushes it to the frontend in one place, so the UI
  /// and the stored state never drift apart.
  fn set_status(&self, phase: StreamPhase, error: Option<String>) -> StreamStatus {
    let status = StreamStatus { phase, error };
    *self.inner.status.lock().unwrap_or_else(|p| p.into_inner()) = status.clone();
    let _ = self.inner.app.emit(STATUS_EVENT, status.clone());
    status
  }

  pub fn start_blocking(
    &self,
    stream_key: String,
    source: String,
    audio_device: Option<String>,
    quality: Option<String>,
  ) -> Result<StreamStatus, String> {
    let _op = self.inner.operation.lock().unwrap_or_else(|p| p.into_inner());
    // The broadcast takes over the audio input from the pre-flight meter.
    self.stop_audio_meter();

    let key = stream_key.trim();
    if key.is_empty() {
      return Err("A YouTube stream key is required.".into());
    }

    let url = format!("{YOUTUBE_INGEST_BASE}/{key}");

    // Only the native window feed can deliver more than the default; the other
    // sources are capped by what they capture.
    let default = quality::DEFAULT;
    if source == "browser" {
      self.start_feed_locked(url, browser_encoder_args(default), default)?;
      return Ok(self.set_status(StreamPhase::Live, None));
    }
    if source == "native-window" {
      let quality = StreamQuality::by_id(quality.as_deref());
      return self.start_window_feed_locked(url, audio_device.as_deref(), quality);
    }

    // Resolve the whole FFmpeg command once (before tearing down any running
    // stream, so a bad source/permission doesn't kill a live one) and reuse it
    // across reconnects, so a network blip re-runs the identical pipeline.
    let mut args = input_args(&source, audio_device.as_deref())?;
    args.extend(encode_args(default, false, true));
    // -rw_timeout makes FFmpeg give up on a stalled network write (~8s) instead
    // of blocking indefinitely, so a dropped connection is detected promptly and
    // the supervisor can reconnect — rather than sitting on a false "live".
    args.extend([
      "-rw_timeout".to_string(),
      "8000000".to_string(),
      "-f".to_string(),
      "flv".to_string(),
      url,
    ]);

    // Idempotent restart: tear down any process still running from before.
    self.stop_locked();

    // Spawn the first process here (not in the supervisor) so a startup failure
    // surfaces as an error to the caller instead of racing the "live" status.
    let spawner: Spawner = Arc::new(move || spawn_ffmpeg(&args));
    let first = spawner()
      .map_err(|e| format!("Could not start FFmpeg ({e}). Is it installed and on PATH?"))?;
    let stopping = Arc::new(AtomicBool::new(false));
    let child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(Some(first)));
    let supervisor = self.spawn_supervisor(spawner, child.clone(), stopping.clone(), None);

    self
      .inner
      .session
      .lock()
      .unwrap_or_else(|p| p.into_inner())
      .replace(Session {
        child,
        stopping,
        supervisor,
        feed: None,
      });

    Ok(self.set_status(StreamPhase::Live, None))
  }

  /// Captures the live window natively and feeds its frames, with the chosen
  /// audio input, through the encoder + pusher pair. Caller holds the
  /// operation lock.
  #[cfg(any(target_os = "macos", target_os = "windows"))]
  fn start_window_feed_locked(
    &self,
    url: String,
    audio: Option<&str>,
    quality: StreamQuality,
  ) -> Result<StreamStatus, String> {
    // Find the window and audio device before touching a running stream.
    let target = window_capture::locate(&self.inner.app, quality)?;
    let audio = resolve_audio_device(audio)?;
    self.start_feed_locked(url, window_encoder_args(&target, quality, audio), quality)?;

    let (input, stopping, counters) = {
      let session = self.inner.session.lock().unwrap_or_else(|p| p.into_inner());
      let session = session.as_ref().expect("start_feed_locked stores a session");
      let feed = session.feed.as_ref().expect("start_feed_locked stores a feed");
      (feed.input.clone(), session.stopping.clone(), feed.counters.clone())
    };
    let fail: window_capture::FailHandler = {
      let bridge = self.clone();
      Arc::new(move |message| {
        if stopping.swap(true, Ordering::AcqRel) {
          return;
        }
        // Tear the whole session down (encoder, pusher, capture) from a fresh
        // thread — the caller may be the capture's own pacer, which stop joins.
        let bridge = bridge.clone();
        std::thread::spawn(move || {
          let _op = bridge.inner.operation.lock().unwrap_or_else(|p| p.into_inner());
          bridge.stop_locked();
          bridge.set_status(StreamPhase::Error, Some(message));
        });
      })
    };
    let capture = match window_capture::start(target, quality, input, fail, counters) {
      Ok(capture) => capture,
      Err(error) => {
        self.stop_locked();
        return Err(error);
      }
    };
    if let Some(feed) = self
      .inner
      .session
      .lock()
      .unwrap_or_else(|p| p.into_inner())
      .as_mut()
      .and_then(|s| s.feed.as_mut())
    {
      feed.stop_source = Some(Box::new(move || capture.stop()));
    }
    Ok(self.set_status(StreamPhase::Live, None))
  }

  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  fn start_window_feed_locked(
    &self,
    _url: String,
    _audio: Option<&str>,
    _quality: StreamQuality,
  ) -> Result<StreamStatus, String> {
    Err("Native live window capture isn't available on this OS yet.".into())
  }

  /// Starts the encoder + pusher pair; the caller then writes the encoder's
  /// input (window frames or the page's recording). Caller holds the operation
  /// lock.
  fn start_feed_locked(
    &self,
    url: String,
    encoder_args: Vec<String>,
    quality: StreamQuality,
  ) -> Result<(), String> {
    self.stop_locked();

    let mut encoder = ffmpeg_command()
      .args(encoder_args)
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .map_err(|e| format!("Could not start FFmpeg ({e}). Is it installed and on PATH?"))?;
    let input = Arc::new(Mutex::new(encoder.stdin.take()));
    let mut encoded = encoder.stdout.take().expect("encoder stdout is piped");
    let counters = Arc::new(Counters::default());
    {
      let counters = counters.clone();
      let stderr = encoder.stderr.take().expect("encoder stderr is piped");
      stats::read_levels(stderr, move |db| counters.set_audio_level(db));
    }

    // The pusher's stdin lives in a slot the spawner refills on every
    // (re)connect; the forwarder writes whatever pusher is current.
    let pusher_input: Arc<Mutex<Option<ChildStdin>>> = Arc::new(Mutex::new(None));
    let spawner: Spawner = {
      let pusher_input = pusher_input.clone();
      let args = pusher_args(&url);
      Arc::new(move || {
        let mut child = ffmpeg_command()
          .args(&args)
          .stdin(Stdio::piped())
          .stdout(Stdio::null())
          .stderr(Stdio::inherit())
          .spawn()?;
        *pusher_input.lock().unwrap_or_else(|p| p.into_inner()) = child.stdin.take();
        Ok(child)
      })
    };

    let first = match spawner() {
      Ok(child) => child,
      Err(e) => {
        let _ = encoder.kill();
        let _ = encoder.wait();
        return Err(format!("Could not start FFmpeg ({e})."));
      }
    };
    let stopping = Arc::new(AtomicBool::new(false));
    let child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(Some(first)));

    // Encoder → pusher. A failed write means the pusher died (network); drop
    // its stdin and keep draining the encoder until the supervisor brings up a
    // replacement. Encoder EOF while not stopping means the feed itself broke.
    let forwarder = {
      let bridge = self.clone();
      let stopping = stopping.clone();
      let counters = counters.clone();
      std::thread::Builder::new()
        .name("cow-stream-forwarder".into())
        .spawn(move || {
          let mut buffer = vec![0u8; 64 * 1024];
          loop {
            let read = match encoded.read(&mut buffer) {
              Ok(0) | Err(_) => break,
              Ok(n) => n,
            };
            let mut slot = pusher_input.lock().unwrap_or_else(|p| p.into_inner());
            if let Some(stdin) = slot.as_mut() {
              let writing = std::time::Instant::now();
              if stdin.write_all(&buffer[..read]).is_ok() {
                counters.sent_bytes.fetch_add(read as u64, Ordering::Relaxed);
                if writing.elapsed() > Duration::from_millis(100) {
                  counters.upload_stalls.fetch_add(1, Ordering::Relaxed);
                }
              } else {
                *slot = None;
              }
            }
          }
          if !stopping.swap(true, Ordering::AcqRel) {
            bridge.set_status(
              StreamPhase::Error,
              Some("The live window feed stopped. Go live again to restart the stream.".into()),
            );
          }
        })
        .ok()
    };

    let supervisor =
      self.spawn_supervisor(spawner, child.clone(), stopping.clone(), Some(counters.clone()));
    let reporter = stats::spawn_reporter(
      self.inner.app.clone(),
      counters.clone(),
      stopping.clone(),
      quality.total_kbps(),
    );
    self
      .inner
      .session
      .lock()
      .unwrap_or_else(|p| p.into_inner())
      .replace(Session {
        child,
        stopping,
        supervisor,
        feed: Some(Feed {
          encoder,
          input,
          forwarder,
          stop_source: None,
          counters,
          reporter,
          _awake: keep_awake::KeepAwake::begin("Streaming the live output to YouTube"),
        }),
      });
    Ok(())
  }

  /// Writes one chunk of the page's recording into the encoder. Chunks must
  /// arrive in order; the frontend serializes its calls.
  pub fn feed_blocking(&self, bytes: &[u8]) -> Result<(), String> {
    let input = {
      let session = self.inner.session.lock().unwrap_or_else(|p| p.into_inner());
      match session.as_ref().and_then(|s| s.feed.as_ref()) {
        Some(feed) => feed.input.clone(),
        None => return Err("No live window stream is running.".into()),
      }
    };
    let mut slot = input.lock().unwrap_or_else(|p| p.into_inner());
    let stdin = slot.as_mut().ok_or("The stream encoder has stopped.")?;
    stdin
      .write_all(bytes)
      .map_err(|e| format!("The stream encoder stopped accepting video ({e})."))
  }

  pub fn stop_blocking(&self) -> StreamStatus {
    let _op = self.inner.operation.lock().unwrap_or_else(|p| p.into_inner());
    self.stop_locked();
    self.set_status(StreamPhase::Idle, None)
  }

  /// Supervises FFmpeg for the life of a session: (re)spawns it, waits for it to
  /// exit, and — unless the exit was a user stop — reconnects with backoff, so a
  /// network blip mid-service doesn't end the broadcast. The retry budget resets
  /// once a process has stayed up past HEALTHY_AFTER.
  fn spawn_supervisor(
    &self,
    spawner: Spawner,
    child: Arc<Mutex<Option<Child>>>,
    stopping: Arc<AtomicBool>,
    counters: Option<Arc<Counters>>,
  ) -> Option<JoinHandle<()>> {
    let bridge = self.clone();
    std::thread::Builder::new()
      .name("cow-stream-supervisor".into())
      .spawn(move || {
        let mut attempt = 0usize;
        loop {
          let started = std::time::Instant::now();
          // The first process is already running (spawned in start_blocking);
          // only (re)spawn when the slot is empty, i.e. on a reconnect.
          {
            let mut slot = child.lock().unwrap_or_else(|p| p.into_inner());
            if slot.is_none() {
              match spawner() {
                Ok(process) => *slot = Some(process),
                Err(e) => {
                  drop(slot);
                  bridge.set_status(
                    StreamPhase::Error,
                    Some(format!("Could not restart FFmpeg ({e}).")),
                  );
                  return;
                }
              }
              drop(slot);
              if let Some(counters) = &counters {
                counters.reconnects.fetch_add(1, Ordering::Relaxed);
              }
              bridge.set_status(StreamPhase::Live, None);
            }
          }

          // Wait for this process to exit, polling so a stop can interrupt.
          loop {
            let mut slot = child.lock().unwrap_or_else(|p| p.into_inner());
            if stopping.load(Ordering::Acquire) {
              // A stop may have raced ahead of us storing the child; make sure
              // our process is killed either way.
              if let Some(process) = slot.as_mut() {
                let _ = process.kill();
                let _ = process.wait();
              }
              *slot = None;
              return;
            }
            match slot.as_mut().map(|p| p.try_wait()) {
              Some(Ok(None)) => {} // still running
              _ => {
                *slot = None;
                break;
              }
            }
            drop(slot);
            std::thread::sleep(MONITOR_POLL);
          }

          // Unexpected exit → reconnect with backoff, unless the budget is spent.
          if started.elapsed() > HEALTHY_AFTER {
            attempt = 0;
          }
          if attempt >= MAX_RECONNECT_ATTEMPTS {
            bridge.set_status(
              StreamPhase::Error,
              Some(
                "Streaming stopped and couldn't reconnect. Check your network and \
                 stream key, then try again."
                  .to_string(),
              ),
            );
            return;
          }
          // Cap the backoff at the last (longest) delay and keep retrying.
          let delay = RECONNECT_BACKOFF[attempt.min(RECONNECT_BACKOFF.len() - 1)];
          attempt += 1;
          bridge.set_status(
            StreamPhase::Reconnecting,
            Some(format!("Connection lost — reconnecting (attempt {attempt})…")),
          );

          // Interruptible backoff sleep.
          let mut waited = Duration::ZERO;
          while waited < delay {
            if stopping.load(Ordering::Acquire) {
              return;
            }
            std::thread::sleep(MONITOR_POLL);
            waited += MONITOR_POLL;
          }
        }
      })
      .ok()
  }

  /// Kills the FFmpeg process and joins the supervisor. Caller must hold the
  /// operation lock (both start and stop go through here).
  fn stop_locked(&self) {
    let session = self
      .inner
      .session
      .lock()
      .unwrap_or_else(|p| p.into_inner())
      .take();
    let Some(mut session) = session else {
      return;
    };
    session.stopping.store(true, Ordering::Release);
    {
      let mut slot = session.child.lock().unwrap_or_else(|p| p.into_inner());
      if let Some(process) = slot.as_mut() {
        let _ = process.kill();
        let _ = process.wait();
      }
      *slot = None;
    }
    if let Some(supervisor) = session.supervisor.take() {
      let _ = supervisor.join();
    }
    if let Some(mut feed) = session.feed.take() {
      // Kill the encoder first: that fails any write blocked on its stdin, so
      // the capture can stop. Its stdout then hits EOF and the forwarder exits.
      let _ = feed.encoder.kill();
      let _ = feed.encoder.wait();
      if let Some(stop_source) = feed.stop_source.take() {
        stop_source();
      }
      feed.input.lock().unwrap_or_else(|p| p.into_inner()).take();
      if let Some(forwarder) = feed.forwarder.take() {
        let _ = forwarder.join();
      }
      if let Some(reporter) = feed.reporter.take() {
        let _ = reporter.join();
      }
    }
  }

  /// Starts the pre-flight audio meter on the chosen input: FFmpeg measures
  /// its loudness ~10 times a second and each reading is emitted on
  /// `stream://audio-level`. Returns false when no audio input is selected.
  pub fn start_audio_meter(&self, audio: Option<&str>) -> Result<bool, String> {
    self.stop_audio_meter();
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
      let Some(device) = resolve_audio_device(audio)? else {
        return Ok(false);
      };
      let mut args = ["-hide_banner", "-loglevel", "error"].map(String::from).to_vec();
      args.extend(audio_input_args(&device));
      args.extend(["-af".to_string(), stats::LEVEL_FILTERS.to_string()]);
      // Stop by itself after 10 minutes, so a meter can't outlive an app that
      // was killed without closing its window (it would hold the input).
      args.extend(["-t", "600", "-f", "null", "-"].map(String::from));
      let mut child = ffmpeg_command()
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start the audio meter ({e})."))?;
      let app = self.inner.app.clone();
      let stderr = child.stderr.take().expect("meter stderr is piped");
      stats::read_levels(stderr, move |db| stats::emit_level(&app, db));
      *self.inner.meter.lock().unwrap_or_else(|p| p.into_inner()) = Some(child);
      Ok(true)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
      let _ = audio;
      Ok(false)
    }
  }

  pub fn stop_audio_meter(&self) {
    if let Some(mut child) = self.inner.meter.lock().unwrap_or_else(|p| p.into_inner()).take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

/// Locates the FFmpeg binary. The app bundles an LGPL FFmpeg as a sidecar
/// (`bundle.externalBin`, fetched by scripts/fetch-ffmpeg.mjs), which Tauri
/// places next to the app's executable — in dev builds too. If it's missing
/// (e.g. a plain `cargo run`), fall back to a system install.
fn ffmpeg_path() -> String {
  let sidecar = if cfg!(target_os = "windows") { "ffmpeg.exe" } else { "ffmpeg" };
  if let Some(bundled) = std::env::current_exe()
    .ok()
    .and_then(|exe| exe.parent().map(|dir| dir.join(sidecar)))
    .filter(|path| path.is_file())
  {
    return bundled.to_string_lossy().into_owned();
  }
  #[cfg(not(target_os = "windows"))]
  let candidates = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"];
  #[cfg(target_os = "windows")]
  let candidates = [r"C:\ffmpeg\bin\ffmpeg.exe", r"C:\Program Files\ffmpeg\bin\ffmpeg.exe"];
  for candidate in candidates {
    if std::path::Path::new(candidate).exists() {
      return candidate.to_string();
    }
  }
  "ffmpeg".to_string()
}

/// An FFmpeg command. On Windows it runs without flashing a console window.
fn ffmpeg_command() -> Command {
  #[allow(unused_mut)]
  let mut command = Command::new(ffmpeg_path());
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
  }
  command
}

/// Spawns FFmpeg with output silenced except stderr, which is inherited to the
/// dev console (`-loglevel warning` keeps the key-bearing URL banner out of it).
fn spawn_ffmpeg(args: &[String]) -> std::io::Result<Child> {
  ffmpeg_command()
    .args(args)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::inherit())
    .spawn()
}

/// Builds the FFmpeg *input* arguments for the chosen source. This is where the
/// only real per-OS difference lives (screen capture); everything downstream
/// (encode, mux, RTMP push) is shared. `"screen"` captures the display; anything
/// else falls back to the synthetic test pattern (kept for quick debugging).
fn input_args(source: &str, audio: Option<&str>) -> Result<Vec<String>, String> {
  let mut args = ["-hide_banner", "-loglevel", "warning"].map(String::from).to_vec();
  match source {
    "screen" => args.extend(screen_input_args(audio)?),
    _ => args.extend(test_pattern_input_args()),
  }
  Ok(args)
}

/// Synthetic test pattern + tone. `-re` paces each synthetic source at real time
/// (a real capture is already real-time, so this is test-only).
fn test_pattern_input_args() -> Vec<String> {
  [
    "-re", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
    "-re", "-f", "lavfi", "-i", "sine=frequency=500:sample_rate=44100",
  ]
  .map(String::from)
  .to_vec()
}

/// macOS screen + audio capture via FFmpeg's avfoundation input. Device indices
/// are machine-specific, so we enumerate them and select the screen plus the
/// chosen audio input: `Some("none")`/`Some("")` → no audio; `Some(index)` → that
/// device; `None` → the first available input (default).
#[cfg(target_os = "macos")]
fn screen_input_args(audio: Option<&str>) -> Result<Vec<String>, String> {
  let (screen, audio_devices) = avfoundation_devices()?;
  let screen = screen.ok_or_else(|| {
    "No screen-capture device was found. Grant this app Screen Recording access in \
     System Settings → Privacy & Security → Screen Recording, then try again."
      .to_string()
  })?;
  let audio_index = pick_audio(audio, &audio_devices);
  // avfoundation device spec is "video:audio"; drop the ":audio" half for
  // video-only.
  let device = match audio_index {
    Some(a) => format!("{screen}:{a}"),
    None => screen,
  };
  let mut args = ["-f", "avfoundation", "-capture_cursor", "1", "-framerate", "30"]
    .map(String::from)
    .to_vec();
  args.push("-i".to_string());
  args.push(device);
  Ok(args)
}

/// The operator's audio choice as a device id (avfoundation index on macOS,
/// DirectShow name on Windows): `Some("none")`/`Some("")` → no audio;
/// `Some(id)` → that device; `None` → the first available input.
#[cfg_attr(not(any(target_os = "macos", target_os = "windows")), allow(dead_code))]
fn pick_audio(audio: Option<&str>, devices: &[AudioDevice]) -> Option<String> {
  match audio {
    Some("none") | Some("") => None,
    Some(index) => Some(index.to_string()),
    None => devices.first().map(|d| d.index.clone()),
  }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn resolve_audio_device(audio: Option<&str>) -> Result<Option<String>, String> {
  if matches!(audio, Some("none") | Some("")) {
    return Ok(None);
  }
  Ok(pick_audio(audio, &list_audio_devices()?))
}

/// The audio inputs the operator can choose from.
fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
  #[cfg(target_os = "macos")]
  {
    avfoundation_devices().map(|(_screen, audio)| audio)
  }
  #[cfg(target_os = "windows")]
  {
    dshow_audio_devices()
  }
  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  {
    Ok(Vec::new())
  }
}

/// FFmpeg input arguments for one audio device.
#[cfg(any(target_os = "macos", target_os = "windows"))]
fn audio_input_args(device: &str) -> Vec<String> {
  #[cfg(target_os = "macos")]
  let input = ["-f".to_string(), "avfoundation".to_string(), "-i".to_string(), format!(":{device}")];
  #[cfg(target_os = "windows")]
  let input = ["-f".to_string(), "dshow".to_string(), "-i".to_string(), format!("audio={device}")];
  let mut args = ["-use_wallclock_as_timestamps", "1", "-thread_queue_size", "1024"]
    .map(String::from)
    .to_vec();
  args.extend(input);
  args
}

/// Enumerates DirectShow audio inputs. FFmpeg prints them to stderr, one per
/// line as `"Device name" (audio)`; the name doubles as the device id.
#[cfg(target_os = "windows")]
fn dshow_audio_devices() -> Result<Vec<AudioDevice>, String> {
  let output = ffmpeg_command()
    .args(["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"])
    .output()
    .map_err(|e| format!("Could not list audio devices via FFmpeg ({e})."))?;
  Ok(parse_dshow_audio(&String::from_utf8_lossy(&output.stderr)))
}

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn parse_dshow_audio(text: &str) -> Vec<AudioDevice> {
  text
    .lines()
    .filter(|line| line.trim_end().ends_with("(audio)"))
    .filter_map(|line| {
      let start = line.find('"')? + 1;
      let end = start + line[start..].find('"')?;
      let name = line[start..end].to_string();
      Some(AudioDevice { index: name.clone(), name })
    })
    .collect()
}

#[cfg(not(target_os = "macos"))]
fn screen_input_args(_audio: Option<&str>) -> Result<Vec<String>, String> {
  Err("Screen capture isn't wired up for this OS yet (that's milestone M3).".into())
}

/// Enumerates avfoundation devices: the screen-capture video index (if present)
/// and every audio input. FFmpeg prints these to stderr and exits non-zero by
/// design, so we ignore the status and parse the output.
#[cfg(target_os = "macos")]
fn avfoundation_devices() -> Result<(Option<String>, Vec<AudioDevice>), String> {
  let output = ffmpeg_command()
    .args(["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""])
    .output()
    .map_err(|e| format!("Could not list capture devices via FFmpeg ({e})."))?;
  let text = String::from_utf8_lossy(&output.stderr);

  let mut screen: Option<String> = None;
  let mut audio: Vec<AudioDevice> = Vec::new();
  let mut in_audio_section = false;
  for line in text.lines() {
    if line.contains("AVFoundation video devices") {
      in_audio_section = false;
      continue;
    }
    if line.contains("AVFoundation audio devices") {
      in_audio_section = true;
      continue;
    }
    let Some((index, name)) = parse_device_line(line) else {
      continue;
    };
    if in_audio_section {
      audio.push(AudioDevice { index, name });
    } else if screen.is_none() && name.contains("Capture screen") {
      screen = Some(index);
    }
  }
  Ok((screen, audio))
}

/// Parses an avfoundation listing line such as
/// `[AVFoundation indev @ 0x..] [1] Capture screen 0` into (index, name): the
/// bracketed number after the `@ 0x..` prefix, and the text following it.
#[cfg(target_os = "macos")]
fn parse_device_line(line: &str) -> Option<(String, String)> {
  let (_, after_prefix) = line.split_once("] [")?; // "1] Capture screen 0"
  let (index, name) = after_prefix.split_once("] ")?; // "1", "Capture screen 0"
  let index = index.trim();
  if index.is_empty() || !index.chars().all(|c| c.is_ascii_digit()) {
    return None;
  }
  Some((index.to_string(), name.trim().to_string()))
}

/// Shared encode + mux settings for the YouTube RTMP output, on the machine's
/// hardware encoder. `rescale` scales to the tier's height (`-2` keeps the width
/// even and the aspect intact); `constant_fps` re-times irregular input (the
/// browser feed) to the tier's steady frame rate.
fn encode_args(quality: StreamQuality, constant_fps: bool, rescale: bool) -> Vec<String> {
  // The native window feed already arrives at the tier's size, so scaling it
  // again would only cost time; the browser feed's size is whatever the page
  // recorded.
  let mut filters = Vec::new();
  if constant_fps {
    filters.push(format!("fps={}", quality.fps));
  }
  if rescale {
    filters.push(format!("scale=-2:{}", quality.height));
  }
  let mut args = Vec::new();
  if !filters.is_empty() {
    args.extend(["-vf".to_string(), filters.join(",")]);
  }
  args.extend(video_encoder_args(quality.codec).iter().cloned());
  args.extend([
    "-b:v".to_string(),
    format!("{}k", quality.video_kbps),
    "-maxrate".to_string(),
    format!("{}k", quality.video_kbps),
    "-bufsize".to_string(),
    format!("{}k", quality.video_kbps * 2),
    // A keyframe every 2 seconds, as YouTube asks.
    "-g".to_string(),
    quality.keyframe_interval().to_string(),
  ]);
  args.extend(audio_encode_args());
  args
}

/// AAC audio at YouTube's recommended rate, shared by every encoder path.
fn audio_encode_args() -> Vec<String> {
  ["-c:a".to_string(), "aac".to_string(), "-b:a".to_string(), format!("{AUDIO_KBPS}k")]
    .into_iter()
    .chain(["-ar".to_string(), "44100".to_string()])
    .collect()
}

/// Hardware encoders in order of preference, per codec, with their settings.
/// The bundled FFmpeg is an LGPL build without libx264, so on Windows the first
/// one that works on this machine wins: the GPU's own encoder (NVIDIA, Intel,
/// AMD), then Windows' Media Foundation encoder. Every candidate takes NV12,
/// which is what the capture produces, so no colour conversion happens between
/// the GPU's video processor and the encoder. libx264 stays last for H.264 only,
/// for a system FFmpeg that happens to include it. macOS always has VideoToolbox.
#[cfg(not(target_os = "macos"))]
const H264_ENCODERS: &[&[&str]] = &[
  &["-c:v", "h264_nvenc", "-preset", "p4", "-tune", "ll", "-rc", "cbr", "-pix_fmt", "nv12"],
  &["-c:v", "h264_qsv", "-preset", "veryfast", "-pix_fmt", "nv12"],
  &["-c:v", "h264_amf", "-usage", "lowlatency", "-rc", "cbr", "-pix_fmt", "nv12"],
  &["-c:v", "h264_mf", "-rate_control", "cbr", "-scenario", "live_streaming", "-pix_fmt", "nv12"],
  &["-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency", "-pix_fmt", "yuv420p"],
];

/// HEVC for the 4K tier: about a third less bitrate than H.264 for the same
/// picture, and the only way most hardware encoders reach 4K60. There is no
/// software fallback; 4K60 in software isn't realistic.
#[cfg(not(target_os = "macos"))]
const HEVC_ENCODERS: &[&[&str]] = &[
  &["-c:v", "hevc_nvenc", "-preset", "p4", "-tune", "ll", "-rc", "cbr", "-pix_fmt", "nv12"],
  &["-c:v", "hevc_qsv", "-preset", "veryfast", "-pix_fmt", "nv12"],
  &["-c:v", "hevc_amf", "-usage", "lowlatency", "-rc", "cbr", "-pix_fmt", "nv12"],
  &["-c:v", "hevc_mf", "-rate_control", "cbr", "-scenario", "live_streaming", "-pix_fmt", "nv12"],
];

/// The video encoder arguments for this machine and codec, chosen once per run.
/// Empty when the machine has no working encoder for the codec (HEVC only).
fn video_encoder_args(codec: Codec) -> &'static [String] {
  static H264: OnceLock<Vec<String>> = OnceLock::new();
  static HEVC: OnceLock<Vec<String>> = OnceLock::new();
  let cell = match codec {
    Codec::H264 => &H264,
    Codec::Hevc => &HEVC,
  };
  cell.get_or_init(|| {
    #[cfg(target_os = "macos")]
    {
      let name = if codec == Codec::Hevc { "hevc_videotoolbox" } else { "h264_videotoolbox" };
      ["-c:v", name, "-pix_fmt", "yuv420p"].map(String::from).to_vec()
    }
    #[cfg(not(target_os = "macos"))]
    {
      let candidates = if codec == Codec::Hevc { HEVC_ENCODERS } else { H264_ENCODERS };
      let chosen = candidates.iter().find(|candidate| encoder_works(candidate)).or_else(|| {
        // H.264 always has a last resort (Media Foundation exists on every
        // Windows 10+ PC); HEVC without an encoder is reported as unavailable.
        (codec == Codec::H264).then(|| &H264_ENCODERS[H264_ENCODERS.len() - 2])
      });
      match chosen {
        Some(chosen) => {
          log::info!("stream {codec:?} encoder: {}", chosen[1]);
          chosen.iter().map(|arg| arg.to_string()).collect()
        }
        None => {
          log::warn!("stream: no working {codec:?} encoder on this computer");
          Vec::new()
        }
      }
    }
  })
}

/// Encodes a few blank frames to see whether an encoder is usable here (the
/// GPU encoders exist in every build but need the matching hardware).
#[cfg(not(target_os = "macos"))]
fn encoder_works(args: &[&str]) -> bool {
  ffmpeg_command()
    .args(["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=640x360:r=30"])
    .args(["-frames:v", "10"])
    .args(args)
    .args(["-f", "null", "-"])
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .status()
    .is_ok_and(|status| status.success())
}

/// Encoder for the browser feed: reads the page's MediaRecorder output (WebM or
/// fragmented MP4, autodetected) from stdin, re-times it to a constant 30fps
/// (recorder timestamps are irregular, YouTube wants steady frames), encodes
/// with a 2-second keyframe interval and writes MPEG-TS to stdout for the
/// pusher. `aresample=async` papers over small audio clock drift.
fn browser_encoder_args(quality: StreamQuality) -> Vec<String> {
  let mut args = [
    "-hide_banner", "-loglevel", "warning",
    "-fflags", "+genpts+discardcorrupt",
    "-i", "pipe:0",
    "-map", "0:v:0", "-map", "0:a:0?",
    "-af", "aresample=async=1000",
  ]
  .map(String::from)
  .to_vec();
  args.extend(encode_args(quality, true, true));
  args.extend(
    ["-bsf:v", "dump_extra=freq=keyframe", "-flush_packets", "1", "-f", "mpegts", "pipe:1"]
      .map(String::from),
  );
  args
}

/// Encoder for the native window feed.
///
/// Two shapes, chosen by how the window was captured:
///
/// * **Raw pipe**: the pacer writes raw frames to stdin and FFmpeg
///   encodes them (Windows, where the GPU has already scaled and converted
///   them to NV12; and macOS when the in-process encoder is unavailable).
/// * **Hardware encoded**: the app has already encoded H.264 on the GPU (macOS
///   VideoToolbox, fed straight from the capture's surfaces), so FFmpeg only
///   muxes it with the audio. Nothing but a few MB/s of compressed video
///   crosses the pipe, which is what makes 4K60 possible.
///
/// Either way video is timed by its position in the pacer's steady schedule,
/// not by when FFmpeg reads it. FFmpeg pauses reading any input that's more
/// than 0.1s ahead of the others; with read-time stamps every paused frame
/// came out even further ahead, which locked video at ~3fps. Audio keeps
/// wall-clock stamps (device clocks are unrelated to ours); FFmpeg starts both
/// inputs at zero, and `aresample=async` absorbs small drift.
#[cfg(any(target_os = "macos", target_os = "windows"))]
fn window_encoder_args(
  target: &window_capture::Target,
  quality: StreamQuality,
  audio: Option<String>,
) -> Vec<String> {
  let mut args = ["-hide_banner", "-loglevel", "warning", "-thread_queue_size", "64"]
    .map(String::from)
    .to_vec();
  if target.hardware_encoded() {
    // Raw H.264 carries no timestamps, so FFmpeg numbers the frames at the
    // pacer's rate. Probing is kept short: the stream opens with its
    // parameter sets, and a long probe would delay the first output.
    let demuxer = match quality.codec {
      Codec::H264 => "h264",
      Codec::Hevc => "hevc",
    };
    // No `-fflags nobuffer` here: it makes FFmpeg discard what it read while
    // probing, which at the start of a stream is its first ~2 seconds of video.
    args.extend(
      ["-probesize", "262144", "-analyzeduration", "0", "-f", demuxer].map(String::from),
    );
    args.extend(["-framerate".to_string(), quality.fps.to_string()]);
  } else {
    // Windows' GPU hands over NV12 at the final size; the macOS fallback
    // pipes BGRA, also at the final size.
    let raw_format = if cfg!(target_os = "windows") { "nv12" } else { "bgra" };
    args.extend(["-f", "rawvideo", "-pix_fmt", raw_format].map(String::from));
    args.extend([
      "-s".to_string(),
      format!("{}x{}", target.width, target.height),
      "-framerate".to_string(),
      quality.fps.to_string(),
    ]);
  }
  args.extend(["-i".to_string(), "pipe:0".to_string()]);
  if let Some(device) = &audio {
    args.extend(audio_input_args(device));
  }
  args.extend(["-map", "0:v:0"].map(String::from));
  if audio.is_some() {
    // Also measures loudness for the live audio meter (see stats.rs).
    args.extend([
      "-map".to_string(),
      "1:a:0".to_string(),
      "-af".to_string(),
      format!("aresample=async=1000,{}", stats::LEVEL_FILTERS),
    ]);
  }
  if target.hardware_encoded() {
    args.extend(["-c:v", "copy"].map(String::from));
    args.extend(audio_encode_args());
  } else {
    args.extend(encode_args(quality, true, false));
    // The GPU converted to BT.709 studio range; say so, or players may assume
    // BT.601 for an untagged stream and shift the colours.
    #[cfg(target_os = "windows")]
    args.extend(
      ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv"]
        .map(String::from),
    );
  }
  // A raw stream has no timestamps, and FFmpeg can't work out the rate of one
  // from a short probe, so each frame is stamped from its position instead.
  let video_filters = if target.hardware_encoded() {
    format!("setts=ts=N/({}*TB),dump_extra=freq=keyframe", quality.fps)
  } else {
    "dump_extra=freq=keyframe".to_string()
  };
  args.extend(["-bsf:v".to_string(), video_filters]);
  args.extend(["-flush_packets", "1", "-f", "mpegts", "pipe:1"].map(String::from));
  args
}

/// Pusher: copies the encoder's MPEG-TS to YouTube without re-encoding. This is
/// the only process that touches the network, so it's the one the supervisor
/// restarts on a connection drop.
fn pusher_args(url: &str) -> Vec<String> {
  let mut args = [
    "-hide_banner", "-loglevel", "warning",
    "-f", "mpegts", "-i", "pipe:0",
    "-c", "copy",
    "-rw_timeout", "8000000",
    "-f", "flv",
  ]
  .map(String::from)
  .to_vec();
  args.push(url.to_string());
  args
}

/// Receives one recorded chunk from the page as a raw (binary) IPC body.
#[tauri::command]
pub async fn stream_feed(
  state: State<'_, StreamBridge>,
  request: Request<'_>,
) -> Result<(), String> {
  let bytes = match request.body() {
    InvokeBody::Raw(bytes) => bytes.clone(),
    InvokeBody::Json(_) => return Err("stream_feed expects binary data.".into()),
  };
  let bridge = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || bridge.feed_blocking(&bytes))
    .await
    .map_err(|e| format!("The stream feed task failed: {e}"))?
}

#[tauri::command]
pub async fn stream_start(
  state: State<'_, StreamBridge>,
  stream_key: String,
  source: String,
  audio_device: Option<String>,
  quality: Option<String>,
) -> Result<StreamStatus, String> {
  let bridge = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || {
    bridge.start_blocking(stream_key, source, audio_device, quality)
  })
  .await
  .map_err(|e| format!("The stream start task failed: {e}"))?
}

/// Lists the audio input devices the operator can pick from for the broadcast
/// (e.g. a USB mixer/soundboard vs the built-in mic).
#[tauri::command]
pub async fn stream_audio_devices() -> Result<Vec<AudioDevice>, String> {
  tauri::async_runtime::spawn_blocking(list_audio_devices)
  .await
  .map_err(|e| format!("Listing audio devices failed: {e}"))?
}

#[tauri::command]
pub async fn stream_stop(state: State<'_, StreamBridge>) -> Result<StreamStatus, String> {
  let bridge = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || bridge.stop_blocking())
    .await
    .map_err(|e| format!("The stream stop task failed: {e}"))
}

#[tauri::command]
pub fn stream_status(state: State<'_, StreamBridge>) -> StreamStatus {
  state.status()
}

#[tauri::command]
pub async fn stream_audio_meter_start(
  state: State<'_, StreamBridge>,
  audio_device: Option<String>,
) -> Result<bool, String> {
  let bridge = state.inner().clone();
  tauri::async_runtime::spawn_blocking(move || bridge.start_audio_meter(audio_device.as_deref()))
    .await
    .map_err(|e| format!("The audio meter task failed: {e}"))?
}

#[tauri::command]
pub fn stream_audio_meter_stop(state: State<'_, StreamBridge>) {
  state.stop_audio_meter();
}

/// One quality tier as the pre-flight check shows it.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TierInfo {
  #[serde(flatten)]
  pub tier: StreamQuality,
  /// False when this machine can't produce the tier yet, with `reason` saying
  /// why in plain words. The picker shows it greyed out rather than hiding it.
  pub available: bool,
  pub reason: Option<String>,
}

/// What the broadcast will be, for the pre-flight check.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamPlan {
  pub quality: String,
  pub height: u32,
  pub fps: u32,
  pub video_kbps: u32,
  pub audio_kbps: u32,
  /// The H.264 encoder this machine will use, in plain words.
  pub encoder: String,
  pub hardware_encoder: bool,
  /// Every tier, in order, with whether this machine can run it.
  pub tiers: Vec<TierInfo>,
  /// The live window's height in pixels, so the picker can warn that a tier
  /// taller than it is only an upscale. `None` when the window isn't open.
  pub source_height: Option<u32>,
}

/// Whether this machine can produce `tier`, and if not, why.
///
/// Every tier is offered wherever an encoder exists; whether a given computer
/// can *sustain* 4K60 depends on its graphics card, which the status bar's
/// delayed-frame count shows live.
fn tier_support(tier: &StreamQuality) -> (bool, Option<String>) {
  #[cfg(not(target_os = "macos"))]
  if video_encoder_args(tier.codec).is_empty() {
    return (
      false,
      Some("This computer's graphics card can't encode HEVC video, which this quality needs.".into()),
    );
  }
  let _ = tier;
  (true, None)
}

#[tauri::command]
pub async fn stream_plan(
  app: AppHandle,
  quality: Option<String>,
) -> Result<StreamPlan, String> {
  tauri::async_runtime::spawn_blocking(move || {
    let quality = StreamQuality::by_id(quality.as_deref());
    // On Windows this probes the encoders once (a few seconds), so the real
    // start is faster afterwards.
    let codec = video_encoder_args(quality.codec).get(1).cloned().unwrap_or_default();
    let hevc = quality.codec == Codec::Hevc;
    let (encoder, hardware_encoder) = match codec.as_str() {
      "h264_videotoolbox" | "hevc_videotoolbox" if hevc => ("Apple hardware encoder (HEVC)", true),
      "h264_videotoolbox" | "hevc_videotoolbox" => ("Apple hardware encoder", true),
      "h264_nvenc" | "hevc_nvenc" if hevc => ("NVIDIA hardware encoder (HEVC)", true),
      "h264_nvenc" | "hevc_nvenc" => ("NVIDIA hardware encoder", true),
      "h264_qsv" | "hevc_qsv" if hevc => ("Intel hardware encoder (HEVC)", true),
      "h264_qsv" | "hevc_qsv" => ("Intel hardware encoder", true),
      "h264_amf" | "hevc_amf" if hevc => ("AMD hardware encoder (HEVC)", true),
      "h264_amf" | "hevc_amf" => ("AMD hardware encoder", true),
      "h264_mf" | "hevc_mf" if hevc => ("Windows built-in encoder (HEVC)", true),
      "h264_mf" | "hevc_mf" => ("Windows built-in encoder", true),
      "" => ("No video encoder for this quality", false),
      _ => ("Software encoder (uses more CPU)", false),
    };
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    let source_height = window_capture::source_height(&app);
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let source_height = {
      let _ = &app;
      None
    };
    StreamPlan {
      quality: quality.id.to_string(),
      height: quality.height,
      fps: quality.fps,
      video_kbps: quality.video_kbps,
      audio_kbps: AUDIO_KBPS,
      encoder: encoder.to_string(),
      hardware_encoder,
      tiers: quality::TIERS
        .iter()
        .map(|tier| {
          let (available, reason) = tier_support(tier);
          TierInfo { tier: *tier, available, reason }
        })
        .collect(),
      source_height,
    }
  })
  .await
  .map_err(|e| format!("Checking the encoder failed: {e}"))
}

/// Opens (and closes) a connection to YouTube's ingest server and returns how
/// long it took in milliseconds. It doesn't send the stream key, so nothing
/// starts on YouTube.
#[tauri::command]
pub async fn stream_check_youtube() -> Result<u32, String> {
  tauri::async_runtime::spawn_blocking(|| {
    use std::net::{TcpStream, ToSocketAddrs};
    let unreachable =
      |detail: String| format!("Couldn't reach YouTube's streaming server ({detail}).");
    let address = YOUTUBE_INGEST_HOST
      .to_socket_addrs()
      .map_err(|e| unreachable(e.to_string()))?
      .next()
      .ok_or_else(|| unreachable("no address".into()))?;
    let started = std::time::Instant::now();
    TcpStream::connect_timeout(&address, Duration::from_secs(5))
      .map_err(|e| unreachable(e.to_string()))?;
    Ok(started.elapsed().as_millis() as u32)
  })
  .await
  .map_err(|e| format!("The YouTube check failed: {e}"))?
}

#[cfg(test)]
mod tests {
  use super::parse_dshow_audio;

  #[test]
  fn parses_dshow_audio_devices() {
    let listing = r#"[dshow @ 000001] "Integrated Camera" (video)
[dshow @ 000001]   Alternative name "@device_pnp_\\?\usb"
[dshow @ 000001] "Microphone (Realtek(R) Audio)" (audio)
[dshow @ 000001] "Line In (Behringer UMC204HD)" (audio)
"#;
    let names: Vec<_> = parse_dshow_audio(listing).into_iter().map(|d| d.name).collect();
    assert_eq!(names, ["Microphone (Realtek(R) Audio)", "Line In (Behringer UMC204HD)"]);
  }
}
