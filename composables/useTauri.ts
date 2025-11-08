/**
 * Composable to detect and interact with Tauri desktop environment
 * Use this to conditionally run desktop-specific features
 */
export const useTauri = () => {
  const isTauri = ref(false)

  onMounted(() => {
    // Check if running in Tauri environment
    if (typeof window !== 'undefined') {
      // @ts-ignore
      isTauri.value = '__TAURI__' in window || '__TAURI_INTERNALS__' in window
    }
  })

  return {
    isTauri: readonly(isTauri),
    isWeb: computed(() => !isTauri.value)
  }
}

/**
 * Get Tauri API modules dynamically
 * This prevents errors when running in browser
 */
export const getTauriAPI = async () => {
  const { isTauri } = useTauri()

  if (!isTauri.value) {
    console.warn('Tauri API is not available in web environment')
    return null
  }

  try {
    const tauri = await import('@tauri-apps/api')
    return tauri
  } catch (error) {
    console.error('Failed to load Tauri API:', error)
    return null
  }
}
