import type { QuickAction } from "~/types"

const STORAGE_KEY = "cow_seen_feature_intros"

// How long a quick action carries its "NEW" badge after `newSince`.
const NEW_ACTION_WINDOW_DAYS = 60

// Shared by every caller so an intro marked seen anywhere is seen everywhere.
// Seen keys are a per-device convenience, so they live in localStorage.
const seenKeys = ref<string[] | null>(null)

// The quick action whose intro is waiting on the operator, and what to run
// once they choose to try it. One host (QuickActions) renders the modal.
const pendingIntro = shallowRef<{ action: QuickAction; run: () => void } | null>(
  null
)
const introHosts = ref(0)

const readSeen = (): string[] => {
  if (seenKeys.value) return seenKeys.value
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    seenKeys.value = raw ? JSON.parse(raw) : []
  } catch {
    seenKeys.value = []
  }
  return seenKeys.value!
}

export const quickActionIntroKey = (action: QuickAction) =>
  `quick-action:${action.action}`

export const useFeatureIntros = () => {
  const hasSeen = (key: string) => readSeen().includes(key)

  const markSeen = (key: string) => {
    if (hasSeen(key)) return
    seenKeys.value = [...readSeen(), key]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seenKeys.value))
    } catch {
      // Ignore storage failures (e.g. private mode, quota, SecurityError).
    }
  }

  // Badged for the whole window, whether or not its intro has been seen.
  const isActionNew = (action?: QuickAction) => {
    if (!action?.newSince) return false
    const since = Date.parse(action.newSince)
    if (Number.isNaN(since)) return false
    const ageDays = (Date.now() - since) / 86_400_000
    return ageDays >= 0 && ageDays <= NEW_ACTION_WINDOW_DAYS
  }

  /**
   * Runs `run` now, or first shows the action's intro when it is new and the
   * operator hasn't seen it. With no host mounted to show the intro, the
   * action runs straight away so a click is never swallowed.
   */
  const introduceThen = (action: QuickAction, run: () => void) => {
    if (
      !action.intro ||
      !isActionNew(action) ||
      hasSeen(quickActionIntroKey(action)) ||
      introHosts.value < 1
    ) {
      run()
      return
    }
    pendingIntro.value = { action, run }
  }

  return {
    hasSeen,
    markSeen,
    isActionNew,
    introduceThen,
    pendingIntro,
    introHosts,
  }
}
