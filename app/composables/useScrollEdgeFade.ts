import type { MaybeRefOrGetter, Ref } from "vue"

/**
 * Fade the edges of a horizontal scroll strip on whichever side still has
 * content past it, so a clipped toolbar reads as scrollable.
 *
 * Returns which edges should fade; `CowScrollFade` draws them as gradient
 * overlays. Not a CSS mask: a mask also hides everything painted outside the
 * strip, which swallowed the toolbar tooltips. Also turns a vertical mouse
 * wheel into horizontal scrolling of the strip.
 *
 * Dropdowns inside a strip must open with popper `strategy: 'fixed'` so they
 * escape its clipping. Lifting the strip's overflow instead spills every
 * clipped control out of it, and the browser scrolls the panel to follow.
 */
export default function useScrollEdgeFade(
  el: Ref<HTMLElement | null | undefined>,
  enabled: MaybeRefOrGetter<boolean> = true
) {
  const fadeStart = ref(false)
  const fadeEnd = ref(false)

  const update = () => {
    const node = el.value
    if (!node) {
      fadeStart.value = fadeEnd.value = false
      return
    }
    const maxScroll = node.scrollWidth - node.clientWidth
    // 1px of slack: fractional widths leave scrollLeft just shy of the end.
    fadeStart.value = maxScroll > 1 && node.scrollLeft > 1
    fadeEnd.value = maxScroll > 1 && node.scrollLeft < maxScroll - 1
  }

  // A dropdown opened from the strip is fixed-positioned on screen but still
  // sits inside the strip in the DOM, so its wheel events bubble up here. Leave
  // those (and anything else that scrolls on its own) alone, or scrolling the
  // font list slides the toolbar instead.
  const isFromOwnScroller = (target: EventTarget | null, strip: HTMLElement) => {
    let current = target instanceof Element ? target : null
    while (current && current !== strip) {
      const style = getComputedStyle(current)
      if (style.position === "fixed") return true
      if (
        /(auto|scroll)/.test(style.overflowY) &&
        current.scrollHeight > current.clientHeight
      ) {
        return true
      }
      current = current.parentElement
    }
    return false
  }

  // A mouse wheel only scrolls vertically, which a one-row strip can't use.
  // Turn it sideways while the strip has room to move that way, and leave it
  // to the page once the strip hits its end. Trackpads and shift+wheel already
  // send deltaX and pass straight through.
  const onWheel = (event: WheelEvent) => {
    const node = el.value
    if (!node || !toValue(enabled)) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    if (isFromOwnScroller(event.target, node)) return
    const maxScroll = node.scrollWidth - node.clientWidth
    if (maxScroll <= 1) return
    const canMove =
      event.deltaY > 0 ? node.scrollLeft < maxScroll - 1 : node.scrollLeft > 1
    if (!canMove) return
    event.preventDefault()
    node.scrollLeft += event.deltaY
  }

  // The strip's own box rarely changes when its contents do, so watch the
  // children too and re-attach as controls come and go between slide types.
  let resizeObserver: ResizeObserver | undefined
  let mutationObserver: MutationObserver | undefined

  const observeChildren = (node: HTMLElement) => {
    if (!resizeObserver) return
    resizeObserver.disconnect()
    resizeObserver.observe(node)
    Array.from(node.children).forEach((child) => resizeObserver!.observe(child))
  }

  const detach = (node?: HTMLElement | null) => {
    node?.removeEventListener("scroll", update)
    node?.removeEventListener("wheel", onWheel)
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
  }

  watch(
    el,
    (node, previous) => {
      detach(previous)
      if (!node) {
        update()
        return
      }
      node.addEventListener("scroll", update, { passive: true })
      node.addEventListener("wheel", onWheel, { passive: false })
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver ??= new ResizeObserver(update)
        observeChildren(node)
      }
      if (typeof MutationObserver !== "undefined") {
        // Created once and reused for every strip `el` points at, so it reads
        // the current strip rather than the one it was first created for.
        mutationObserver ??= new MutationObserver(() => {
          if (el.value) observeChildren(el.value)
          update()
        })
        mutationObserver.observe(node, { childList: true })
      }
      nextTick(update)
    },
    { immediate: true, flush: "post" }
  )

  onBeforeUnmount(() => detach(el.value))

  const start = computed(() => toValue(enabled) && fadeStart.value)
  const end = computed(() => toValue(enabled) && fadeEnd.value)

  return { start, end, update }
}
