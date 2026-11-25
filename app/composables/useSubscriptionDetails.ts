import { useAuthStore } from "~/store/auth"

// One request at a time across the whole app, however many callers ask.
let inFlight: Promise<void> | null = null

/**
 * Keeps `authStore.subscriptionDetails` fresh in the background.
 *
 * The expiry banner reads that cache, and until now only the Subscription
 * settings panel filled it, so a church that never opened the panel never saw
 * the banner. Nothing awaits this: it is fire-and-forget, skips itself when
 * offline or when there is nothing to show, and swallows its own errors, so a
 * slow or failing `/billing/details` can never hold up the workspace.
 */
export const useSubscriptionDetails = () => {
  const authStore = useAuthStore()

  const refreshSubscriptionDetails = (): Promise<void> => {
    if (inFlight) return inFlight
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return Promise.resolve()
    }
    if (!authStore.user?.churchId) return Promise.resolve()

    // Free churches with no cached details have no banner to show. A cached
    // copy still refreshes, so a lapse or an upgrade reaches the banner.
    if (
      authStore.church?.subscriptionPlan !== "teams" &&
      !authStore.subscriptionDetails
    ) {
      return Promise.resolve()
    }

    inFlight = (async () => {
      try {
        const { data, error } = await useAPIFetch("/billing/details")
        if (error.value) return
        const details = (data.value as any)?.data
        if (details) authStore.setSubscriptionDetails(details)
      } catch (err) {
        console.warn("Unable to refresh subscription details:", err)
      } finally {
        inFlight = null
      }
    })()

    return inFlight
  }

  return { refreshSubscriptionDetails }
}
