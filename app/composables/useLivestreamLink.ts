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
  copiedDescription?: ComputedRef<string | undefined>
  canUse: ComputedRef<boolean>
}) => {
  const appStore = useAppStore()
  const { currentState } = storeToRefs(appStore)
  const toast = useToast()
  const runtimeConfig = useRuntimeConfig()

  // Drives the tick-vs-clipboard icon on the trigger for a few seconds.
  const isClipboardCopying = ref(false)

  const url = computed(() => {
    if (typeof window === "undefined") return ""
    const { origin } = window.location
    // Packaged desktop origins only exist on this machine. Browser previews
    // and localhost development retain their own web origin.
    const isWebOrigin =
      /^https?:\/\//.test(origin) &&
      !/^https?:\/\/tauri\.localhost(?::\d+)?$/.test(origin)
    const viewerOrigin = isWebOrigin ? origin : runtimeConfig.public.APP_URL
    return `${viewerOrigin.replace(/\/+$/, "")}/${options.route}/${currentState.value.activeSchedule?._id}`
  })

  const copy = async () => {
    isClipboardCopying.value = true
    await navigator.clipboard.writeText(url.value)
    toast.add({
      title: options.copiedTitle,
      description: options.copiedDescription?.value,
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
 * Unlimited on Teams. A free church gets a lifetime allowance of sessions (a
 * schedule watched on a new day spends one), counted and enforced by the
 * server when a viewer connects. `canUseLivestreamLink` is false only once the
 * allowance is known to be spent, and callers show the upgrade prompt then.
 */
export const useLivestreamLink = () => {
  const { hasAccessToFeature } = useSubscription()
  const {
    usage,
    isMetered,
    refresh,
    livestreamSessionsLeft,
    livestreamSessionsLimit,
  } = useUsageQuotas()
  if (isMetered.value && !usage.value) refresh()

  const hasTeamsAccess = computed(() => hasAccessToFeature("livestream-url"))

  /** e.g. "3 of 5 free sessions left". Null on Teams or while unknown. */
  const livestreamSessionsLabel = computed(() => {
    if (hasTeamsAccess.value || livestreamSessionsLeft.value === null) return null
    return `${livestreamSessionsLeft.value} of ${livestreamSessionsLimit.value} free sessions left`
  })

  const link = useScheduleViewerLink({
    route: "livestream",
    copiedTitle: "Livestream URL copied to clipboard",
    copiedDescription: computed(() =>
      livestreamSessionsLabel.value
        ? `Streaming a schedule on a new day uses one free session. ${livestreamSessionsLabel.value}.`
        : undefined
    ),
    // An unknown count is let through: the server has the final say.
    canUse: computed(
      () => hasTeamsAccess.value || livestreamSessionsLeft.value !== 0
    ),
  })

  return {
    canUseLivestreamLink: link.canUse,
    livestreamSessionsLabel,
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
