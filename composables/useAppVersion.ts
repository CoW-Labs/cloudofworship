/**
 * Composable for getting the current app version
 * This should be kept in sync with the version in app.vue
 */
export default function useAppVersion() {
  const APP_VERSION = "v0.41.0-beta"

  return {
    appVersion: APP_VERSION,
  }
}
