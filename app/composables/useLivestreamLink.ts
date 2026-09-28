import type { ComputedRef } from "vue"
import { useAppStore } from "~/store/app"

/**
 * A shareable viewer link for the active schedule, and copying it to the
 * clipboard. Both public viewer pages are addressed the same way —
 * `/<route>/:schedule_id` — and gated the same way, so they share this.
 */
const useScheduleViewerLink = (options: {
  route: string
  copiedTitle: string
  canUse: ComputedRef<boolean>
}) => {
  const appStore = useAppStore()
  const { currentState } = storeToRefs(appStore)
  const toast = useToast()

  // Drives the tick-vs-clipboard icon on the trigger for a few seconds.
  const isClipboardCopying = ref(false)

  const url = computed(() => {
    if (typeof window === "undefined") return ""
    // NOTE: this deliberately uses the current origin. The original had an
    // unused `origin` local that fell back to https://app.cloudofworship.com
    // off localhost, which would make a preview deploy hand out production
    // links — behaviour preserved here rather than changed on the quiet.
    return `${window.location.origin}/${options.route}/${currentState.value.activeSchedule?._id}`
  })

  const copy = async () => {
    isClipboardCopying.value = true
    await navigator.clipboard.writeText(url.value)
    toast.add({
      title: options.copiedTitle,
      color: "green",
      icon: "i-bx-check-circle",
    })
    setTimeout(() => {
      isClipboardCopying.value = false
    }, 3000)
  }

  return { canUse: options.canUse, isClipboardCopying, url, copy }
}

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
  const { isTeamsPlan } = useSubscription()
  const link = useScheduleViewerLink({
    route: "livestream",
    copiedTitle: "Livestream URL copied to clipboard",
    canUse: computed(() => isTeamsPlan.value),
  })

  return {
    canUseLivestreamLink: link.canUse,
    isClipboardCopying: link.isClipboardCopying,
    livestreamURL: link.url,
    copyLivestreamURL: link.copy,
  }
}

/**
 * The stage display link for the active schedule (`/stagestream/:schedule_id`)
 * — for a band member's phone, a tablet on a music stand, or a TV away from
 * the operator's computer.
 *
 * Teams-gated through `hasAccessToFeature`, which also honours the app-wide
 * paywall switch; the server refuses the viewer on a free church regardless.
 */
export const useStageStreamLink = () => {
  const { hasAccessToFeature } = useSubscription()
  const link = useScheduleViewerLink({
    route: "stagestream",
    copiedTitle: "Stage display link copied to clipboard",
    canUse: computed(() => hasAccessToFeature("stagestream-url")),
  })

  return {
    canUseStageStreamLink: link.canUse,
    isStageLinkCopying: link.isClipboardCopying,
    stageStreamURL: link.url,
    copyStageStreamURL: link.copy,
  }
}
