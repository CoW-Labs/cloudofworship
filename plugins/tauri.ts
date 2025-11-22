/**
 * Tauri plugin for Nuxt
 * Provides Tauri-specific functionality and prevents errors in web environment
 */
export default defineNuxtPlugin(() => {
  const isTauri = ref(false)

  if (typeof window !== 'undefined') {
    // @ts-ignore
    isTauri.value = '__TAURI__' in window || '__TAURI_INTERNALS__' in window
  }

  return {
    provide: {
      tauri: {
        enabled: isTauri.value,

        /**
         * Safely invoke a Tauri command
         * Falls back gracefully when not in Tauri environment
         */
        async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
          if (!isTauri.value) {
            console.warn(`Tauri command '${command}' skipped - not in Tauri environment`)
            return null
          }

          try {
            const { invoke } = await import('@tauri-apps/api/core')
            return await invoke<T>(command, args)
          } catch (error) {
            console.error(`Failed to invoke Tauri command '${command}':`, error)
            return null
          }
        },

        /**
         * Get the window API
         */
        async getWindow() {
          if (!isTauri.value) return null

          try {
            const windowModule = await import('@tauri-apps/api/window')
            return windowModule.getCurrentWindow()
          } catch (error) {
            console.error('Failed to get Tauri window:', error)
            return null
          }
        },

        /**
         * Get the event API for listening to Tauri events
         */
        async getEvent() {
          if (!isTauri.value) return null

          try {
            return await import('@tauri-apps/api/event')
          } catch (error) {
            console.error('Failed to get Tauri event:', error)
            return null
          }
        }
      }
    }
  }
})
