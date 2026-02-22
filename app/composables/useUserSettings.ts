import type { AppSettings } from "~/types"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { useDebounceFn } from "@vueuse/core"

// Track the timestamp of the last local settings change across composable instances
// so that fetchUserSettings can skip overwriting in-flight user edits
let lastLocalSaveTimestamp = 0

export const useUserSettings = () => {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Save settings immediately to the local store (no network call).
   * Call this on every settings change for instant local persistence.
   */
  const saveSettingsLocally = (settings: AppSettings) => {
    lastLocalSaveTimestamp = Date.now()
    appStore.setAppSettings(settings)
  }

  /**
   * Fetch user settings from the backend.
   * Skipped if a local save happened within the last 5 seconds to avoid
   * overwriting in-progress user edits with stale server data.
   */
  const fetchUserSettings = async (force = false): Promise<AppSettings | null> => {
    // Don't overwrite settings that were just edited locally
    const timeSinceLastSave = Date.now() - lastLocalSaveTimestamp
    if (!force && timeSinceLastSave < 5000) {
      console.log('⏭️ Skipping settings fetch — recent local save detected')
      return null
    }

    try {
      loading.value = true
      error.value = null

      // Use unique key with timestamp to prevent caching
      const { data, error: fetchError } = await useAPIFetch('/app-config/user-settings', {
        method: 'GET',
        key: `fetch-user-settings-${Date.now()}`,
      })

      if (fetchError.value) {
        console.error('Error fetching user settings:', fetchError.value)
        error.value = fetchError.value?.message || 'Failed to fetch settings'
        return null
      }

      if (data.value) {
        const userSettings = data.value as any

        // Map backend settings to frontend AppSettings format
        const mappedSettings: Partial<AppSettings> = {
          defaultFont: userSettings.defaultFont,
          defaultBibleVersion: userSettings.defaultBibleVersion,
          // Deep merge defaultBackground to preserve all nested properties
          defaultBackground: {
            default: {
              ...appStore.currentState.settings.defaultBackground?.default,
              ...userSettings.defaultBackground?.default,
            },
            hymn: {
              ...appStore.currentState.settings.defaultBackground?.hymn,
              ...userSettings.defaultBackground?.hymn,
            },
            bible: {
              ...appStore.currentState.settings.defaultBackground?.bible,
              ...userSettings.defaultBackground?.bible,
            },
            text: {
              ...appStore.currentState.settings.defaultBackground?.text,
              ...userSettings.defaultBackground?.text,
            },
          },
          // Deep merge slideStyles to preserve all properties
          slideStyles: {
            ...appStore.currentState.settings.slideStyles,
            ...userSettings.slideStyles,
          },
          bibleVersions: userSettings.bibleVersions || appStore.currentState.settings.bibleVersions,
          animations: userSettings.animations,
          footnotes: userSettings.footnotes,
          songAndHymnLabelsVisibility: userSettings.songAndHymnLabelsVisibility,
          liveWindowFullscreen: userSettings.liveWindowFullscreen,
          transitionInterval: userSettings.transitionInterval,
          alertLimit: userSettings.alertLimit,
        }

        // Merge with current settings to preserve app version and other non-saved fields
        const mergedSettings: AppSettings = {
          ...appStore.currentState.settings,
          ...mappedSettings,
        }

        // Update app store with fetched settings
        appStore.setAppSettings(mergedSettings)

        console.log('✅ User settings loaded successfully')
        return mergedSettings
      }

      return null
    } catch (err: any) {
      console.error('Error fetching user settings:', err)
      error.value = err.message || 'Failed to fetch settings'
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Save user settings to the backend (online only).
   * Always reads the latest settings from the store to avoid stale captures.
   */
  const saveUserSettings = async (settings?: AppSettings): Promise<boolean> => {
    try {
      loading.value = true
      error.value = null

      const settingsToSave = settings || appStore.currentState.settings

      console.log('💾 Saving user settings online:', {
        textBold: settingsToSave.slideStyles.textBold,
        lettercase: settingsToSave.slideStyles.lettercase,
        textOutlined: settingsToSave.slideStyles.textOutlined,
      })

      // Extract only the fields that should be saved to the backend
      const backendSettings = {
        defaultFont: settingsToSave.defaultFont,
        defaultBibleVersion: settingsToSave.defaultBibleVersion,
        defaultBackground: settingsToSave.defaultBackground,
        slideStyles: settingsToSave.slideStyles,
        bibleVersions: settingsToSave.bibleVersions,
        animations: settingsToSave.animations,
        footnotes: settingsToSave.footnotes,
        songAndHymnLabelsVisibility: settingsToSave.songAndHymnLabelsVisibility,
        liveWindowFullscreen: settingsToSave.liveWindowFullscreen,
        transitionInterval: settingsToSave.transitionInterval,
        alertLimit: settingsToSave.alertLimit,
      }

      // Use unique key with timestamp to prevent caching
      const timestamp = Date.now()

      // Check if settings already exist by trying to fetch first
      const existingSettings = await useAPIFetch('/app-config/user-settings', {
        method: 'GET',
        key: `check-user-settings-${timestamp}`,
      })

      let response
      if (existingSettings.data.value) {
        // Update existing settings
        response = await useAPIFetch('/app-config/user-settings', {
          method: 'PUT',
          body: backendSettings,
          key: `update-user-settings-${timestamp}`,
        })
      } else {
        // Create new settings
        response = await useAPIFetch('/app-config/user-settings', {
          method: 'POST',
          body: backendSettings,
          key: `create-user-settings-${timestamp}`,
        })
      }

      if (response.error.value) {
        throw new Error(response.error.value?.message || 'Failed to save settings')
      }

      console.log('✅ User settings saved online successfully')

      return true
    } catch (err: any) {
      console.error('Error saving user settings:', err)
      error.value = err.message || 'Failed to save settings'

      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to save settings',
        description: error.value || undefined,
        color: 'red',
        timeout: 5000,
      })

      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Debounced online save — fires 3 seconds after the last call.
   * Always captures the latest store state at call time (no stale closure).
   */
  const debouncedSaveSettings = useDebounceFn(() => {
    saveUserSettings()
  }, 3000)

  return {
    loading,
    error,
    fetchUserSettings,
    saveUserSettings,
    saveSettingsLocally,
    debouncedSaveSettings,
  }
}
