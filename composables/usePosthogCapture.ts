import { PostHog } from "posthog-js"

const usePosthogCapture = (event: string, properties?: Record<string, any>) => {
  const { $posthog } = useNuxtApp()
  ;($posthog as PostHog)?.capture(event, properties)
}

export default usePosthogCapture
