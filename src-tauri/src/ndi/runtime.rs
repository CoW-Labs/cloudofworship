use std::ffi::CStr;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use libloading::Library;

use super::ffi::{
  DestroyFn, InitializeFn, IsSupportedCpuFn, SendConnectionsFn, SendCreateFn, SendDestroyFn,
  SendVideoV2Fn, VersionFn,
};
use super::status::{NdiErrorCode, NdiErrorInfo};

pub struct NdiFunctions {
  #[allow(dead_code)]
  pub destroy: DestroyFn,
  pub send_create: SendCreateFn,
  pub send_destroy: SendDestroyFn,
  pub send_video_v2: SendVideoV2Fn,
  pub send_connections: SendConnectionsFn,
}

pub struct NdiRuntime {
  #[allow(dead_code)]
  library: Library,
  pub functions: NdiFunctions,
  pub path: PathBuf,
  pub version: String,
}

static RUNTIME: OnceLock<NdiRuntime> = OnceLock::new();

pub fn load() -> Result<&'static NdiRuntime, NdiErrorInfo> {
  cache_success(&RUNTIME, load_uncached)
}

fn cache_success<T, E>(
  cache: &OnceLock<T>,
  loader: impl FnOnce() -> Result<T, E>,
) -> Result<&T, E> {
  if let Some(value) = cache.get() {
    return Ok(value);
  }
  let value = loader()?;
  let _ = cache.set(value);
  Ok(cache.get().expect("a successful runtime load must be cached"))
}

fn load_uncached() -> Result<NdiRuntime, NdiErrorInfo> {
  let candidates = runtime_candidates();
  let existing: Vec<_> = candidates.into_iter().filter(|path| path.is_file()).collect();
  if existing.is_empty() {
    return Err(
      NdiErrorInfo::new(
        NdiErrorCode::RuntimeNotInstalled,
        "The NDI runtime is not installed or could not be found.",
        true,
      )
      .hint("Install NDI Tools or the NDI runtime, then press Retry.")
      .help_url("https://ndi.video/tools/"),
    );
  }

  let mut load_errors = Vec::new();
  for path in existing {
    match unsafe { load_from_path(&path) } {
      Ok(runtime) => return Ok(runtime),
      Err(error) if error.code == NdiErrorCode::RuntimeMissingSymbol => return Err(error),
      Err(error) => load_errors.push(format!("{}: {}", path.display(), error.message)),
    }
  }

  Err(
    NdiErrorInfo::new(
      NdiErrorCode::RuntimeLoadFailed,
      "The installed NDI runtime could not be loaded.",
      true,
    )
    .hint(load_errors.join("; "))
    .help_url("https://ndi.video/tools/"),
  )
}

unsafe fn load_from_path(path: &Path) -> Result<NdiRuntime, NdiErrorInfo> {
  let library = unsafe { Library::new(path) }.map_err(|error| {
    NdiErrorInfo::new(
      NdiErrorCode::RuntimeLoadFailed,
      format!("Failed to load {}: {error}", path.display()),
      true,
    )
  })?;

  let initialize: InitializeFn = unsafe { required_symbol(&library, b"NDIlib_initialize\0", path)? };
  let destroy: DestroyFn = unsafe { required_symbol(&library, b"NDIlib_destroy\0", path)? };
  let version_fn: VersionFn = unsafe { required_symbol(&library, b"NDIlib_version\0", path)? };
  let is_supported_cpu: IsSupportedCpuFn =
    unsafe { required_symbol(&library, b"NDIlib_is_supported_CPU\0", path)? };
  let send_create: SendCreateFn =
    unsafe { required_symbol(&library, b"NDIlib_send_create\0", path)? };
  let send_destroy: SendDestroyFn =
    unsafe { required_symbol(&library, b"NDIlib_send_destroy\0", path)? };
  let send_video_v2: SendVideoV2Fn =
    unsafe { required_symbol(&library, b"NDIlib_send_send_video_v2\0", path)? };
  let send_connections: SendConnectionsFn =
    unsafe { required_symbol(&library, b"NDIlib_send_get_no_connections\0", path)? };

  if !unsafe { is_supported_cpu() } {
    return Err(NdiErrorInfo::new(
      NdiErrorCode::UnsupportedCpu,
      "This computer's CPU is not supported by the installed NDI runtime.",
      false,
    ));
  }
  if !unsafe { initialize() } {
    return Err(NdiErrorInfo::new(
      NdiErrorCode::RuntimeLoadFailed,
      "The NDI runtime failed to initialize.",
      true,
    ));
  }

  let version_ptr = unsafe { version_fn() };
  let version = if version_ptr.is_null() {
    "Unknown NDI runtime".to_string()
  } else {
    unsafe { CStr::from_ptr(version_ptr) }
      .to_string_lossy()
      .into_owned()
  };

  Ok(NdiRuntime {
    library,
    functions: NdiFunctions {
      destroy,
      send_create,
      send_destroy,
      send_video_v2,
      send_connections,
    },
    path: path.to_path_buf(),
    version,
  })
}

unsafe fn required_symbol<T: Copy>(
  library: &Library,
  name: &[u8],
  path: &Path,
) -> Result<T, NdiErrorInfo> {
  unsafe { library.get::<T>(name) }.map(|symbol| *symbol).map_err(|error| {
    let printable = String::from_utf8_lossy(name)
      .trim_end_matches('\0')
      .to_string();
    NdiErrorInfo::new(
      NdiErrorCode::RuntimeMissingSymbol,
      format!(
        "The NDI runtime at {} does not export {printable}: {error}",
        path.display()
      ),
      true,
    )
    .hint("Update or reinstall the NDI runtime.")
    .help_url("https://ndi.video/tools/")
  })
}

fn runtime_candidates() -> Vec<PathBuf> {
  let v6 = std::env::var_os("NDI_RUNTIME_DIR_V6").map(PathBuf::from);
  let v5 = std::env::var_os("NDI_RUNTIME_DIR_V5").map(PathBuf::from);
  candidates_for(v6, v5)
}

fn candidates_for(v6: Option<PathBuf>, v5: Option<PathBuf>) -> Vec<PathBuf> {
  let library_name = platform_library_name();
  let mut candidates = Vec::new();
  if let Some(directory) = v6 {
    candidates.push(directory.join(library_name));
  }
  if let Some(directory) = v5 {
    candidates.push(directory.join(library_name));
  }

  #[cfg(target_os = "macos")]
  {
    candidates.extend([
      PathBuf::from("/usr/local/lib/libndi.dylib"),
      PathBuf::from("/opt/homebrew/lib/libndi.dylib"),
      PathBuf::from("/Library/NDI SDK for Apple/lib/macOS/libndi.dylib"),
    ]);
  }

  #[cfg(target_os = "windows")]
  if let Some(program_files) = std::env::var_os("ProgramFiles").map(PathBuf::from) {
    candidates.extend([
      program_files.join(r"NDI\NDI 6 Runtime\v6\Processing.NDI.Lib.x64.dll"),
      program_files.join(r"NDI\NDI 6 Tools\Runtime\Processing.NDI.Lib.x64.dll"),
      program_files.join(r"NDI\NDI 5 Runtime\v5\Processing.NDI.Lib.x64.dll"),
      program_files.join(r"NDI\NDI 5 Tools\Runtime\Processing.NDI.Lib.x64.dll"),
    ]);
  }

  candidates.dedup();
  candidates
}

const fn platform_library_name() -> &'static str {
  #[cfg(target_os = "macos")]
  {
    "libndi.dylib"
  }
  #[cfg(target_os = "windows")]
  {
    "Processing.NDI.Lib.x64.dll"
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn environment_candidates_keep_v6_before_v5() {
    let candidates = candidates_for(Some(PathBuf::from("v6")), Some(PathBuf::from("v5")));
    assert_eq!(candidates[0], PathBuf::from("v6").join(platform_library_name()));
    assert_eq!(candidates[1], PathBuf::from("v5").join(platform_library_name()));
  }

  #[test]
  fn the_process_global_destroy_function_is_resolved_but_not_called_per_session() {
    let _field: fn(&NdiFunctions) -> DestroyFn = |functions| functions.destroy;
  }

  #[test]
  fn failed_loads_are_retried_and_successes_are_cached() {
    let cache = OnceLock::new();
    let mut calls = 0;
    let first = cache_success(&cache, || {
      calls += 1;
      Err::<u32, _>("not installed")
    });
    assert_eq!(first, Err("not installed"));
    assert!(cache.get().is_none());

    let second = cache_success(&cache, || {
      calls += 1;
      Ok::<_, &str>(42)
    });
    assert_eq!(second, Ok(&42));
    let third = cache_success(&cache, || {
      calls += 1;
      Ok::<_, &str>(99)
    });
    assert_eq!(third, Ok(&42));
    assert_eq!(calls, 2);
  }
}
