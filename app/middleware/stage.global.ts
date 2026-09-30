/**
 * Gates the stage display behind Teams, the same way `mobile.global.ts` gates
 * `/mobile`. The Quick Action that opens the stage window is already gated, so
 * this only catches someone opening `/stage` by its address.
 *
 * Same fail-safe as the mobile gate: `getCurrentPlan` reads "free" until the
 * church loads, so the redirect waits until the plan is knowable, and
 * `/stage` re-checks when it resolves.
 */
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  if (to.path !== "/stage" && to.path !== "/stage-upgrade") return

  const { isTeamsPlan, isPlanKnown, isPaywallEnabled } = useSubscription()

  if (
    to.path === "/stage" &&
    isPlanKnown.value &&
    isPaywallEnabled.value &&
    !isTeamsPlan.value
  ) {
    return navigateTo("/stage-upgrade")
  }

  // A church that is on Teams has no reason to sit on the upgrade wall.
  if (to.path === "/stage-upgrade" && isPlanKnown.value && isTeamsPlan.value) {
    return navigateTo("/stage")
  }
})
