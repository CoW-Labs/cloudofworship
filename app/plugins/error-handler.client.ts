import posthog from "posthog-js"
import { shouldSuppressError } from "~/utils/errorFilters"

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
