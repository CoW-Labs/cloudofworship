/**
 * Sends touch devices to the mobile operator route.
 *
 * The console at `/` is three resizable panels with keyboard shortcuts and
 * drag-to-reorder; on a phone it is unusable rather than merely cramped, so a
 * phone that lands on `/` is redirected to `/mobile`.
 *
 * The check deliberately pairs a narrow viewport with a coarse pointer. Width
 * alone would hijack a desktop window that happens to be dragged narrow — where
 * the operator has a mouse, a keyboard, and the option to just widen it again.
 *
 * `?desktop=1` opts out for a session, so a tablet user who wants the full
 * console (or anyone debugging the desktop layout on a touch screen) is never
 * stuck. The reverse trip is not automatic: someone who navigated to `/` on
 * purpose stays there.
 */
export default defineNuxtRouteMiddleware((to) => {
  // SSR is disabled, but middleware still runs during prerender for the routes
  // in nitro.prerender — `window` does not exist there.
  if (!import.meta.client) return
  if (to.path !== "/") return
  if (to.query.desktop) return

  const isNarrow = window.matchMedia("(max-width: 767px)").matches
  const isCoarse = window.matchMedia("(pointer: coarse)").matches
  if (!isNarrow || !isCoarse) return

  return navigateTo({ path: "/mobile", query: to.query })
})
