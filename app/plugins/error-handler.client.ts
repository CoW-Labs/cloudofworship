import posthog from "posthog-js"

const ignoredErrorMessages = new Set([
  "Permissions check failed",
  "Script error.",
])

const ignoredErrorNames = new Set([
  "AbortError",
  "NotAllowedError",
  "NotSupportedError",
])

const shouldSuppressError = (error: unknown) => {
  const err = error as Error | undefined
  return Boolean(
    (err?.message && ignoredErrorMessages.has(err.message)) ||
      (err?.name && ignoredErrorNames.has(err.name))
  )
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, _instance, info) => {
    if (shouldSuppressError(error)) return

    console.error("Vue error:", error, info)
    posthog.captureException?.(error, { vue_info: info })
  }

  window.addEventListener("unhandledrejection", (event) => {
    if (shouldSuppressError(event.reason)) {
      event.preventDefault()
      return
    }

    posthog.captureException?.(event.reason, {
      source: "unhandledrejection",
    })
  })

  window.addEventListener("error", (event) => {
    if (event.message === "Script error.") {
      event.preventDefault()
    }
  })
})
