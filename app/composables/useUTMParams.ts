/**
 * Composable for extracting and managing UTM parameters
 * UTM params are stored in localStorage to persist across page navigation
 */
export const useUTMParams = () => {
  const UTM_STORAGE_KEY = 'cow_utm_params'
  const UTM_EXPIRY_KEY = 'cow_utm_expiry'
  const UTM_EXPIRY_DAYS = 30 // UTM params expire after 30 days

  /**
   * Extract UTM parameters from URL query string
   */
  const extractUTMParams = (route?: any) => {
    const currentRoute = route || useRoute()
    const query = currentRoute.query

    const utmParams: {
      utm_source?: string
      utm_medium?: string
      utm_campaign?: string
      utm_term?: string
      utm_content?: string
    } = {}

    if (query.utm_source) utmParams.utm_source = query.utm_source as string
    if (query.utm_medium) utmParams.utm_medium = query.utm_medium as string
    if (query.utm_campaign) utmParams.utm_campaign = query.utm_campaign as string
    if (query.utm_term) utmParams.utm_term = query.utm_term as string
    if (query.utm_content) utmParams.utm_content = query.utm_content as string

    return Object.keys(utmParams).length > 0 ? utmParams : null
  }

  /**
   * Store UTM parameters in localStorage with expiry
   */
  const storeUTMParams = (utmParams: Record<string, string>) => {
    if (typeof window === 'undefined') return

    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + UTM_EXPIRY_DAYS)

    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmParams))
    localStorage.setItem(UTM_EXPIRY_KEY, expiryDate.toISOString())
  }

  /**
   * Get stored UTM parameters from localStorage
   * Returns null if expired or not found
   */
  const getStoredUTMParams = () => {
    if (typeof window === 'undefined') return null

    const storedParams = localStorage.getItem(UTM_STORAGE_KEY)
    const expiryDate = localStorage.getItem(UTM_EXPIRY_KEY)

    if (!storedParams || !expiryDate) return null

    // Check if expired
    if (new Date() > new Date(expiryDate)) {
      clearUTMParams()
      return null
    }

    try {
      return JSON.parse(storedParams)
    } catch {
      return null
    }
  }

  /**
   * Clear UTM parameters from localStorage
   */
  const clearUTMParams = () => {
    if (typeof window === 'undefined') return

    localStorage.removeItem(UTM_STORAGE_KEY)
    localStorage.removeItem(UTM_EXPIRY_KEY)
  }

  /**
   * Get UTM parameters from URL or localStorage
   * Priority: URL params > stored params
   */
  const getUTMParams = (route?: any) => {
    // First check URL
    const urlParams = extractUTMParams(route)
    if (urlParams) {
      // Store new params from URL
      storeUTMParams(urlParams)
      return urlParams
    }

    // Fallback to stored params
    return getStoredUTMParams()
  }

  /**
   * Initialize UTM tracking - call this on app mount or page load
   * Automatically extracts and stores UTM params from URL
   */
  const initUTMTracking = (route?: any) => {
    const urlParams = extractUTMParams(route)
    if (urlParams) {
      storeUTMParams(urlParams)
    }
  }

  return {
    extractUTMParams,
    storeUTMParams,
    getStoredUTMParams,
    getUTMParams,
    clearUTMParams,
    initUTMTracking,
  }
}
