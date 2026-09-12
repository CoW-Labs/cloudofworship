import posthog from "posthog-js"
import { shouldSuppressError } from "~/utils/errorFilters"

/**
 * The component a Vue error came from.
 *
 * Production stack frames point at a minified chunk (`_nuxt/CmHprZFG.js:203`),
 * and the chunk is deleted by the next deploy, so PostHog cannot symbolicate a
 * report that arrives from a tab running an older build — which is exactly the
 * case for the long-lived operator console. The instance Vue hands us knows its
 * own name, and that survives everything: it turns "a computed somewhere"
 * into "LiveOutput" without a source map.
 */
const componentName = (instance: any): string | undefined => {
  const type = instance?.type
  if (!type) return undefined
  return (
    type.__name ||
    type.name ||
    // Set by the SFC compiler; the basename is the component the operator sees.
    type.__file?.split("/").pop()?.replace(/\.vue$/, "") ||
    undefined
  )
}

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    if (shouldSuppressError(error)) return

    console.error("Vue error:", error, info)
    posthog.captureException?.(error, {
      vue_info: info,
      vue_component: componentName(instance),
    })
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
