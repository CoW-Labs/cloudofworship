import type { StreamStatus } from "~/composables/useStreamOutput"

/**
 * Whether the desktop app is livestreaming right now, readable from any
 * window. The stream is controlled from the operator window, but its status
 * event reaches every Tauri window, so the projector window can follow it
 * without the operator's state. Always false in the web build.
 */
const onAir = ref(false)
let started = false

export const useStreamOnAir = () => {
  const { isTauri } = useTauri()
  if (!started && isTauri && import.meta.client) {
    started = true
    const follow = (status?: StreamStatus | null) => {
      onAir.value = status?.phase === "live" || status?.phase === "reconnecting"
    }
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<StreamStatus>("stream://status", (message) => follow(message.payload))
      )
      .catch((error) => console.warn("Couldn't follow the stream status:", error))
    import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke<StreamStatus>("stream_status"))
      .then(follow)
      .catch(() => {})
  }
  return readonly(onAir)
}
