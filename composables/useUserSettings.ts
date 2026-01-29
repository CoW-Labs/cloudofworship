import type { AppSettings } from "~/types"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { useDebounceFn } from "@vueuse/core"

export const useUserSettings = () => {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Fetch user settings from the backend
   */
  const fetchUserSettings = async (): Promise<AppSettings | null> => {
    try {
      loading.value = true
      error.value = null

      const { data, error: fetchError } = await useAPIFetch('/app-config/user-settings', {
        method: 'GET',
        key: 'fetch-user-settings',
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
          defaultBackground: userSettings.defaultBackground,
          slideStyles: userSettings.slideStyles,
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
   * Save user settings to the backend
   */
  const saveUserSettings = async (settings?: AppSettings): Promise<boolean> => {
    try {
      loading.value = true
      error.value = null

      const settingsToSave = settings || appStore.currentState.settings

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

      // Check if settings already exist by trying to fetch first
      const existingSettings = await useAPIFetch('/app-config/user-settings', {
        method: 'GET',
        key: 'check-user-settings',
      })

      let response
      if (existingSettings.data.value) {
        // Update existing settings
        response = await useAPIFetch('/app-config/user-settings', {
          method: 'PUT',
          body: backendSettings,
          key: 'update-user-settings',
        })
      } else {
        // Create new settings
        response = await useAPIFetch('/app-config/user-settings', {
          method: 'POST',
          body: backendSettings,
          key: 'create-user-settings',
        })
      }

      if (response.error.value) {
        throw new Error(response.error.value?.message || 'Failed to save settings')
      }

      console.log('✅ User settings saved successfully')

      toast.add({
        icon: 'i-bx-check-circle',
        title: 'Settings saved',
        description: 'Your preferences have been saved successfully',
        color: 'green',
        timeout: 3000,
      })

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
   * Auto-save settings with debounce
   */
  const debouncedSaveSettings = useDebounceFn((settings?: AppSettings) => {
    saveUserSettings(settings)
  }, 2000)

  return {
    loading,
    error,
    fetchUserSettings,
    saveUserSettings,
    debouncedSaveSettings,
  }
}
