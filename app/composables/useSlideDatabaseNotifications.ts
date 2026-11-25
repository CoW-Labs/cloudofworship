import type { LiveBroadcastEnvelope } from "~/composables/useBroadcastPost"
import { postCrossWindowNotification } from "~/composables/useBroadcastPost"
import useBroadcastMessage, {
  broadcastNoticeKind,
} from "~/composables/useBroadcastMessage"

export type SlideDatabaseNotification = {
  kind: "slides-changed"
  sourceId: string
}

// Keep one identity per window even if Vite reloads the module while an
// existing listener or a queued repository write still uses the old instance.
const sourceKey = Symbol.for("cloud-of-worship.slide-database-source")
const getSourceId = () => {
  const scope = window as Window & { [sourceKey]?: string }
  return scope[sourceKey] ??= globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
export const notifySlideDatabaseChanged = () => {
  if (typeof window === "undefined") return
  postCrossWindowNotification<SlideDatabaseNotification>({
    kind: "slides-changed",
    sourceId: getSourceId(),
  })
}

export const useSlideDatabaseNotifications = (callback: () => void) => {
  if (typeof window === "undefined") return () => undefined
  return useBroadcastMessage((input) => {
    // Every live slide crosses this channel too; parse only this notice.
    const kind = broadcastNoticeKind(input)
    if (kind !== undefined && kind !== "slides-changed") return
    try {
      const envelope = (typeof input === "string"
        ? JSON.parse(input)
        : input) as LiveBroadcastEnvelope<SlideDatabaseNotification>
      const notification = envelope?.payload
      if (
        notification?.kind === "slides-changed" &&
        notification.sourceId !== getSourceId()
      ) {
        callback()
      }
    } catch {
      // Ignore messages for the live projection and overlay consumers.
    }
  })
}
