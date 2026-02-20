import { useAuthStore } from "~/store/auth"

/**
 * Composable to handle authentication token storage
 * Uses Vuex (Pinia) for Tauri desktop app
 * Uses cookies for browser environment
 */
export const useAuthToken = () => {
  const { isTauri } = useTauri()
  const authStore = useAuthStore()
  const runtimeConfig = useRuntimeConfig()
  const isDevEnvironment = runtimeConfig.public.BASE_URL?.includes("localhost")

  const thirtyDaysAhead = new Date()
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)

  // Cookie instance (only used in browser)
  const tokenCookie = useCookie("token", {
    secure: !isDevEnvironment,
    sameSite: true,
    expires: thirtyDaysAhead,
  })

  /**
   * Get the current token value
   * Returns from Pinia store if Tauri, otherwise from cookie
   */
  const getToken = (): string | null | undefined => {
    if (isTauri) {
      return authStore.token
    }
    return tokenCookie.value
  }

  /**
   * Set the token value
   * Stores in Pinia if Tauri, otherwise in cookie
   */
  const setToken = (token: string | null | undefined) => {
    if (isTauri) {
      authStore.setToken(token || null)
    } else {
      tokenCookie.value = token
    }
  }

  /**
   * Clear the token
   */
  const clearToken = () => {
    if (isTauri) {
      authStore.setToken(null)
    } else {
      tokenCookie.value = undefined
    }
  }

  return {
    token: computed({
      get: () => getToken(),
      set: (value) => setToken(value),
    }),
    getToken,
    setToken,
    clearToken,
    isTauri,
  }
}
