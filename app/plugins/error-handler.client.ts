import posthog from "posthog-js"
import { shouldSuppressError } from "~/utils/errorFilters"

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, _instance, info) => {
    if (shouldSuppressError(error)) return

    console.error("Vue error:", error, info)
    posthog.captureException?.(error, { vue_info: info })
  }

  // PostHog autocaptures unhandled rejections through its own listener, so this
  // one only suppresses the benign ones (`before_send` drops the report; the
  // preventDefault keeps it out of the console too). Capturing here as well
  // reported every rejection twice, which doubled the occurrence counts on
  // every issue in error tracking.
  window.addEventListener("unhandledrejection", (event) => {
    if (shouldSuppressError(event.reason)) {
      event.preventDefault()
    }
  })

  window.addEventListener("error", (event) => {
    if (event.message === "Script error.") {
      event.preventDefault()
    }
  })
})
