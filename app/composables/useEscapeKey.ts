/**
 * Shared Escape-key layer stack.
 *
 * Overlays that should dismiss on Escape (modals, popovers, floating menus,
 * inline editor panels, the Quick Actions pane) register a handler here instead
 * of each adding its own `keydown` listener. A single press then only dismisses
 * the top-most layer: handlers run from the highest priority down — most
 * recently registered first within the same priority — and the first one that
 * reports it handled the press (returns `true`) stops the rest.
 *
 * Handlers must return `true` ONLY when they actually dismissed something,
 * otherwise the press falls through to the layer beneath, which is exactly what
 * lets the Quick Actions pane act as the last-resort "go back" target.
 *
 * Nuxt UI's `UModal` closes itself on Escape through Headless UI, so plain
 * modals need nothing here — this is for overlays that opt out of that
 * (`prevent-close`) or that aren't built on Headless UI at all.
 */
type EscapeHandler = () => boolean | void

interface EscapeLayer {
  handler: EscapeHandler
  priority: number
  order: number
}

// Higher wins. Anything layered on top of something else should sit above it —
// popovers/menus are teleported above modals, so they outrank them.
export const escapePriority = {
  /** Back-navigation inside the Quick Actions pane — the last-resort target. */
  pane: 0,
  /** Inline panels docked inside a pane (e.g. the slide editor overlays). */
  panel: 10,
  /** Dialogs that cover the app. */
  modal: 20,
  /** Popovers and floating menus anchored to a trigger. */
  popover: 30,
} as const

const layers: EscapeLayer[] = []
let registrationCount = 0
let isListening = false

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key !== "Escape" || event.defaultPrevented) return

  // Sorted on a copy so a handler that unregisters itself (the common case —
  // closing an overlay unmounts it) can't disturb the walk in progress.
  const ordered = [...layers].sort(
    (a, b) => b.priority - a.priority || b.order - a.order
  )

  for (const layer of ordered) {
    if (layer.handler() !== true) continue
    // Headless UI's dialog listens on `window` and bails on an already-handled
    // press, so marking it handled here is what stops a popover's Escape from
    // also closing the modal it sits on top of.
    event.preventDefault()
    return
  }
}

const startListening = () => {
  if (isListening || typeof document === "undefined") return
  isListening = true
  document.addEventListener("keydown", onKeyDown)
}

const stopListening = () => {
  if (!isListening || layers.length > 0 || typeof document === "undefined") return
  isListening = false
  document.removeEventListener("keydown", onKeyDown)
}

/**
 * Registers `handler` for as long as the calling component is alive (or until
 * the returned function is called). Return `true` from the handler when it
 * dismissed something so the press stops there.
 */
export default function useEscapeKey(
  handler: EscapeHandler,
  options?: { priority?: number }
) {
  const layer: EscapeLayer = {
    handler,
    priority: options?.priority ?? escapePriority.panel,
    order: ++registrationCount,
  }

  const unregister = () => {
    const index = layers.indexOf(layer)
    if (index === -1) return
    layers.splice(index, 1)
    stopListening()
  }

  layers.push(layer)
  startListening()

  if (getCurrentInstance()) onUnmounted(unregister)

  return unregister
}
