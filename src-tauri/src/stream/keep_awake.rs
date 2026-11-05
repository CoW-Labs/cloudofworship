//! Keeps macOS from napping the app while it streams. When Cloud of Worship
//! isn't the front app (the operator is in a browser, or on another desktop),
//! App Nap throttles its timers, and the pacer that feeds the encoder 30
//! frames a second runs on exactly those timers. Streaming apps declare a
//! latency-critical, user-initiated activity for as long as they're live; this
//! also stops the Mac and its display from sleeping mid-service.
//!
//! Elsewhere this is a no-op.

/// Held for as long as the stream runs; dropping it ends the activity.
pub struct KeepAwake {
  #[cfg(target_os = "macos")]
  token: usize,
}

#[cfg(target_os = "macos")]
mod platform {
  use std::ffi::CString;

  use objc2::runtime::AnyObject;
  use objc2::{class, msg_send};

  use super::KeepAwake;

  // NSActivityOptions (Foundation/NSProcessInfo.h).
  const USER_INITIATED: u64 = 0x00FF_FFFF | IDLE_SYSTEM_SLEEP_DISABLED;
  const IDLE_SYSTEM_SLEEP_DISABLED: u64 = 1 << 20;
  const IDLE_DISPLAY_SLEEP_DISABLED: u64 = 1 << 40;
  const LATENCY_CRITICAL: u64 = 0xFF_0000_0000;

  pub fn begin(reason: &str) -> Option<KeepAwake> {
    let reason = CString::new(reason).ok()?;
    unsafe {
      let info: *mut AnyObject = msg_send![class!(NSProcessInfo), processInfo];
      let text: *mut AnyObject =
        msg_send![class!(NSString), stringWithUTF8String: reason.as_ptr()];
      if info.is_null() || text.is_null() {
        return None;
      }
      let options = USER_INITIATED | IDLE_DISPLAY_SLEEP_DISABLED | LATENCY_CRITICAL;
      let token: *mut AnyObject =
        msg_send![info, beginActivityWithOptions: options, reason: text];
      if token.is_null() {
        return None;
      }
      // The token comes back autoreleased; keep it until the stream ends.
      let _: *mut AnyObject = msg_send![token, retain];
      Some(KeepAwake { token: token as usize })
    }
  }

  pub fn end(token: usize) {
    unsafe {
      let token = token as *mut AnyObject;
      let info: *mut AnyObject = msg_send![class!(NSProcessInfo), processInfo];
      let _: () = msg_send![info, endActivity: token];
      let _: () = msg_send![token, release];
    }
  }
}

impl KeepAwake {
  pub fn begin(reason: &str) -> Option<Self> {
    #[cfg(target_os = "macos")]
    {
      platform::begin(reason)
    }
    #[cfg(not(target_os = "macos"))]
    {
      let _ = reason;
      Some(Self {})
    }
  }
}

impl Drop for KeepAwake {
  fn drop(&mut self) {
    #[cfg(target_os = "macos")]
    platform::end(self.token);
  }
}
