/**
 * Single source of truth for the app version.
 * The release workflow rewrites APP_VERSION here and mirrors it into
 * src-tauri/tauri.conf.json, so nothing else should hardcode a version.
 */
export default function useAppVersion() {
  const APP_VERSION = "v0.57.0-beta"

  return {
    appVersion: APP_VERSION,
  }
}
