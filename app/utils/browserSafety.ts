const expectedMediaErrorNames = new Set([
  "AbortError",
  "NotAllowedError",
  "NotSupportedError",
])

const isEmptyMediaSource = (el: HTMLMediaElement) => {
  const hasSrc = Boolean(el.currentSrc || el.src)
  const hasSourceChild = Array.from(el.querySelectorAll("source")).some(
    (source) => Boolean(source.src)
  )
  return !hasSrc && !hasSourceChild
}

export const isExpectedMediaError = (error: unknown) => {
  const name = (error as DOMException | undefined)?.name
  return Boolean(name && expectedMediaErrorNames.has(name))
}

export const safePlayMedia = async (el: HTMLMediaElement | null | undefined) => {
  if (!el || isEmptyMediaSource(el)) return false

  try {
    await el.play()
    return true
  } catch (error) {
    if (!isExpectedMediaError(error)) {
      console.warn("Media play failed:", error)
    }
    return false
  }
}

export const safePauseMedia = (el: HTMLMediaElement | null | undefined) => {
  if (!el || el.paused) return false

  try {
    el.pause()
    return true
  } catch (error) {
    if (!isExpectedMediaError(error)) {
      console.warn("Media pause failed:", error)
    }
    return false
  }
}

export const safePostMessage = (
  targetWindow: Window | null | undefined,
  message: unknown,
  targetOrigin = "*"
) => {
  try {
    targetWindow?.postMessage(message, targetOrigin)
    return true
  } catch (error) {
    if ((error as DOMException)?.name !== "SecurityError") {
      console.warn("postMessage failed:", error)
    }
    return false
  }
}

export const safeScrollBy = (
  target: unknown,
  xOrOptions: number | ScrollToOptions,
  y?: number
) => {
  const el = target instanceof HTMLElement ? target : (target as any)?.$el
  if (!el) return false

  if (typeof el.scrollBy === "function") {
    if (typeof xOrOptions === "number") {
      el.scrollBy(xOrOptions, y ?? 0)
    } else {
      el.scrollBy(xOrOptions)
    }
    return true
  }

  if ("scrollTop" in el) {
    el.scrollTop += typeof xOrOptions === "number" ? y ?? 0 : xOrOptions.top ?? 0
    return true
  }

  return false
}

export const requestFullscreenSafely = async (
  el: HTMLElement | null | undefined
) => {
  if (!el || typeof el.requestFullscreen !== "function") return false

  try {
    await el.requestFullscreen()
    return true
  } catch (error) {
    const name = (error as DOMException | undefined)?.name
    if (name !== "NotAllowedError" && name !== "SecurityError") {
      console.warn("Fullscreen request failed:", error)
    }
    return false
  }
}

export const exitFullscreenSafely = async () => {
  if (!document.fullscreenElement) return true

  try {
    await document.exitFullscreen()
    return true
  } catch (error) {
    console.warn("Error exiting fullscreen:", error)
    return false
  }
}
