import type { LiveBroadcastEnvelope } from "~/composables/useBroadcastPost"
import { postCrossWindowNotification } from "~/composables/useBroadcastPost"
import useBroadcastMessage from "~/composables/useBroadcastMessage"

export type SlideDatabaseNotification = {
  kind: "slides-changed"
  sourceId: string
}

const sourceId =
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
export const notifySlideDatabaseChanged = () => {
  if (typeof window === "undefined") return
  postCrossWindowNotification<SlideDatabaseNotification>({
    kind: "slides-changed",
    sourceId,
  })
}

export const useSlideDatabaseNotifications = (callback: () => void) => {
  if (typeof window === "undefined") return () => undefined
  return useBroadcastMessage((input) => {
    try {
      const envelope = (typeof input === "string"
        ? JSON.parse(input)
        : input) as LiveBroadcastEnvelope<SlideDatabaseNotification>
      const notification = envelope?.payload
      if (
        notification?.kind === "slides-changed" &&
        notification.sourceId !== sourceId
      ) {
        callback()
      }
    } catch {
      // Ignore messages for the live projection and overlay consumers.
    }
  })
}
