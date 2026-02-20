/**
 * Composable for handling auto-updates in Tauri desktop app
 * Checks for updates and prompts users to install them
 */
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export default function useAutoUpdate() {
  const { isTauri } = useTauri()

  /**
   * Check for updates and prompt user if available
   * Should be called on app startup or periodically
   */
  const checkForUpdates = async (silent = false) => {
    if (!isTauri) {
      return
    }

    try {
      console.log('Checking for updates...')
      const update = await check()

      if (update !== null) {
        console.log(`Update available: ${update.version}, current: ${update.currentVersion}`)

        // Show notification or dialog (you can customize this)
        const shouldUpdate = confirm(
          `A new version (${update.version}) is available. Current version is ${update.currentVersion}.\n\n` +
          `Would you like to download and install it now? The app will restart after the update.`
        )

        if (shouldUpdate) {
          console.log('Downloading and installing update...')

          // Download and install the update
          let downloaded = 0
          let contentLength = 0

          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 0
                console.log(`Started downloading ${contentLength} bytes`)
                break
              case 'Progress':
                downloaded += event.data.chunkLength
                const progress = contentLength > 0
                  ? Math.round((downloaded / contentLength) * 100)
                  : 0
                break
              case 'Finished':
                console.log('Download finished')
                break
            }
          })

          console.log('Update installed! Restarting...')
          // Restart the application to apply the update
          await relaunch()
        } else {
          console.log('User declined update')
        }
      } else if (!silent) {
        console.log('No updates available')
        alert('You are already running the latest version!')
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      if (!silent) {
        alert('Failed to check for updates. Please try again later.')
      }
    }
  }

  /**
   * Check for updates silently on app startup
   * Only shows dialog if update is available
   */
  const checkForUpdatesOnStartup = async () => {
    if (!isTauri) return

    // Wait a bit after startup before checking
    setTimeout(() => {
      checkForUpdates(true)
    }, 5000) // Wait 5 seconds after app starts
  }

  return {
    checkForUpdates,
    checkForUpdatesOnStartup
  }
}
