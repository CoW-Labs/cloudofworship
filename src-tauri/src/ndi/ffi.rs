use std::ffi::{c_char, c_float, c_int, c_void};

pub type NdiSendInstance = *mut c_void;

#[repr(C)]
pub struct NdiSendCreate {
  pub p_ndi_name: *const c_char,
  pub p_groups: *const c_char,
  pub clock_video: bool,
  pub clock_audio: bool,
}

#[repr(C)]
pub struct NdiVideoFrameV2 {
  pub xres: c_int,
  pub yres: c_int,
  pub four_cc: c_int,
  pub frame_rate_n: c_int,
  pub frame_rate_d: c_int,
  pub picture_aspect_ratio: c_float,
  pub frame_format_type: c_int,
  pub timecode: i64,
  pub p_data: *mut u8,
  pub line_stride_in_bytes: c_int,
  pub p_metadata: *const c_char,
  pub timestamp: i64,
}

pub const FOURCC_BGRA: c_int = 0x4152_4742;
pub const FRAME_FORMAT_PROGRESSIVE: c_int = 1;
pub const TIMECODE_SYNTHESIZE: i64 = i64::MAX;

pub type InitializeFn = unsafe extern "C" fn() -> bool;
pub type DestroyFn = unsafe extern "C" fn();
pub type VersionFn = unsafe extern "C" fn() -> *const c_char;
pub type IsSupportedCpuFn = unsafe extern "C" fn() -> bool;
pub type SendCreateFn = unsafe extern "C" fn(*const NdiSendCreate) -> NdiSendInstance;
pub type SendDestroyFn = unsafe extern "C" fn(NdiSendInstance);
pub type SendVideoV2Fn = unsafe extern "C" fn(NdiSendInstance, *const NdiVideoFrameV2);
pub type SendConnectionsFn = unsafe extern "C" fn(NdiSendInstance, u32) -> c_int;

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  #[cfg(target_pointer_width = "64")]
  fn ndi_struct_layout_matches_the_64_bit_c_abi() {
    assert_eq!(std::mem::size_of::<NdiSendCreate>(), 24);
    assert_eq!(std::mem::align_of::<NdiSendCreate>(), 8);
    assert_eq!(std::mem::offset_of!(NdiSendCreate, clock_video), 16);
    assert_eq!(std::mem::size_of::<NdiVideoFrameV2>(), 72);
    assert_eq!(std::mem::align_of::<NdiVideoFrameV2>(), 8);
    assert_eq!(std::mem::offset_of!(NdiVideoFrameV2, timecode), 32);
    assert_eq!(std::mem::offset_of!(NdiVideoFrameV2, p_data), 40);
    assert_eq!(std::mem::offset_of!(NdiVideoFrameV2, line_stride_in_bytes), 48);
    assert_eq!(std::mem::offset_of!(NdiVideoFrameV2, p_metadata), 56);
    assert_eq!(std::mem::offset_of!(NdiVideoFrameV2, timestamp), 64);
    assert_eq!(FOURCC_BGRA.to_le_bytes(), *b"BGRA");
  }

  #[test]
  fn resolved_symbol_types_match_the_flat_ndi_abi() {
    unsafe extern "C" fn initialize() -> bool {
      true
    }
    unsafe extern "C" fn destroy() {}
    unsafe extern "C" fn version() -> *const c_char {
      std::ptr::null()
    }
    unsafe extern "C" fn cpu() -> bool {
      true
    }
    unsafe extern "C" fn create(_: *const NdiSendCreate) -> NdiSendInstance {
      std::ptr::null_mut()
    }
    unsafe extern "C" fn destroy_sender(_: NdiSendInstance) {}
    unsafe extern "C" fn send(_: NdiSendInstance, _: *const NdiVideoFrameV2) {}
    unsafe extern "C" fn connections(_: NdiSendInstance, _: u32) -> c_int {
      0
    }

    let _: InitializeFn = initialize;
    let _: DestroyFn = destroy;
    let _: VersionFn = version;
    let _: IsSupportedCpuFn = cpu;
    let _: SendCreateFn = create;
    let _: SendDestroyFn = destroy_sender;
    let _: SendVideoV2Fn = send;
    let _: SendConnectionsFn = connections;
  }
}
