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

  const oneHundredEightyDaysAhead = new Date()
  oneHundredEightyDaysAhead.setDate(oneHundredEightyDaysAhead.getDate() + 180)

  // Cookie instance (only used in browser)
  const tokenCookie = useCookie("token", {
    secure: !isDevEnvironment,
    sameSite: true,
    expires: oneHundredEightyDaysAhead,
  })

  /**
   * Get the current token value
   * Returns from Pinia store if Tauri, otherwise from cookie
   */
  const getToken = (): string | null | undefined => {
    if (isTauri) {
      return authStore.token
    }
    return tokenCookie.value || authStore.token
  }

  /**
   * Set the token value
   * Stores in Pinia if Tauri, otherwise in cookie
   */
  const setToken = (token: string | null | undefined) => {
    authStore.setToken(token || null)

    if (isTauri) {
      return
    }

    tokenCookie.value = token
  }

  /**
   * Clear the token
   */
  const clearToken = () => {
    authStore.setToken(null)

    if (isTauri) {
      return
    }

    tokenCookie.value = undefined
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
