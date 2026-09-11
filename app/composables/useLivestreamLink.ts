import { useAppStore } from "~/store/app"

/**
 * The public viewer link for the active schedule (`/livestream/:schedule_id`),
 * and copying it to the clipboard.
 *
 * Lived inline in AppSection until the live-output panel needed the same action
 * in its own menu — on mobile that menu is the only place it is reachable, since
 * the Go Live popover it used to hide behind is about opening a second window,
 * which a phone has no way to do.
 *
 * Teams-gated: `canUseLivestreamLink` is false on the free plan, and callers are
 * expected to show the upgrade prompt instead of copying.
 */
export const useLivestreamLink = () => {
  const appStore = useAppStore()
  const { currentState } = storeToRefs(appStore)
  const { isTeamsPlan } = useSubscription()
  const toast = useToast()

  const canUseLivestreamLink = computed(() => isTeamsPlan.value)

  // Drives the tick-vs-clipboard icon on the trigger for a few seconds.
  const isClipboardCopying = ref(false)

  const livestreamURL = computed(() => {
    if (typeof window === "undefined") return ""
    // NOTE: this deliberately uses the current origin. The original had an
    // unused `origin` local that fell back to https://app.cloudofworship.com
    // off localhost, which would make a preview deploy hand out production
    // links — behaviour preserved here rather than changed on the quiet.
    return `${window.location.origin}/livestream/${currentState.value.activeSchedule?._id}`
  })

  const copyLivestreamURL = async () => {
    isClipboardCopying.value = true
    await navigator.clipboard.writeText(livestreamURL.value)
    toast.add({
      title: "Livestream URL copied to clipboard",
      color: "green",
      icon: "i-bx-check-circle",
    })
    setTimeout(() => {
      isClipboardCopying.value = false
    }, 3000)
  }

  return {
    canUseLivestreamLink,
    isClipboardCopying,
    livestreamURL,
    copyLivestreamURL,
  }
}
