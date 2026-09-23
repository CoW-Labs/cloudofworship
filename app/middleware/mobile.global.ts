/**
 * Routes touch devices to the mobile operator app, and gates it behind Teams.
 *
 * The console at `/` is three resizable panels with keyboard shortcuts and
 * drag-to-reorder; on a phone it is unusable rather than merely cramped, so a
 * phone that lands on `/` is sent to `/mobile`, or, when the church is not on
 * Teams, to `/mobile-upgrade`, which explains the limitation and opens the
 * usual upgrade flow.
 *
 * The device check deliberately pairs a narrow viewport with a coarse pointer.
 * Width alone would hijack a desktop window that happens to be dragged narrow,
 * where the operator has a mouse, a keyboard, and the option to just widen it.
 *
 * `?desktop=1` opts out for a session, so a tablet user who wants the full
 * console (or anyone debugging the desktop layout on a touch screen) is never
 * stuck. The reverse trip is not automatic: someone who navigated to `/` on
 * purpose stays there.
 */
export default defineNuxtRouteMiddleware((to) => {
  // SSR is disabled, but middleware still runs during prerender for the routes
  // in nitro.prerender, where `window` does not exist.
  if (!import.meta.client) return
  if (to.query.desktop) return

  const isMobileDevice =
    window.matchMedia("(max-width: 767px)").matches &&
    window.matchMedia("(pointer: coarse)").matches

  // `getCurrentPlan` fails safe to "free" when the church is not loaded, which
  // is the right default for granting features but the wrong one for a hard
  // redirect. It would wall a Teams church out of its own app on a cold start
  // before the church lands. So the gate only fires once the plan is knowable,
  // and `/mobile` re-checks when it resolves.
  const { isTeamsPlan, isPlanKnown, isPaywallEnabled } = useSubscription()

  // Matches every other paid gate in the app (see ScheduleModal, QuickActions):
  // gating only applies while the paywall switch is on, so it stays usable as a
  // kill switch without locking anyone out of the mobile app. That switch comes
  // from our own API and defaults to on, so an offline phone keeps the gate.
  const gateOnTeams =
    isPlanKnown.value && isPaywallEnabled.value && !isTeamsPlan.value

  if (to.path === "/mobile" && gateOnTeams) {
    return navigateTo("/mobile-upgrade")
  }

  // A church that is on Teams has no reason to sit on the upgrade wall.
  if (to.path === "/mobile-upgrade" && isPlanKnown.value && isTeamsPlan.value) {
    return navigateTo("/mobile")
  }

  if (to.path === "/" && isMobileDevice) {
    return navigateTo({
      path: gateOnTeams ? "/mobile-upgrade" : "/mobile",
      query: to.query,
    })
  }
})
