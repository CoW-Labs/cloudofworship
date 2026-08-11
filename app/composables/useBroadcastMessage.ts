import { LIVE_CHANNEL_NAME } from "~/composables/useBroadcastPost"

// Every envelope carries an id, and desktop builds deliver the same envelope
// twice (BroadcastChannel + Tauri event bus). Remember a short tail of ids so
// the second copy is dropped before it reaches the caller.
const SEEN_LIMIT = 100

const envelopeId = (data: unknown) => {
  if (typeof data !== "string") return null
  // The id is serialised first, so this avoids parsing a whole slide payload
  // just to decide whether we have already handled it.
  return data.match(/^\{"id":"([^"]+)"/)?.[1] || null
}

const useBroadcastMessage = (callback: (data: unknown) => void) => {
  const seen = new Set<string>()
  const seenOrder: string[] = []

  const deliver = (data: unknown) => {
    const id = envelopeId(data)
    if (id) {
      if (seen.has(id)) return
      seen.add(id)
      seenOrder.push(id)
      if (seenOrder.length > SEEN_LIMIT) {
        const dropped = seenOrder.shift()
        if (dropped) seen.delete(dropped)
      }
    }
    callback(data)
  }

  const bc = new BroadcastChannel(LIVE_CHANNEL_NAME)

  const handler = (event: MessageEvent) => {
    deliver(event.data)
  }

  bc.addEventListener("message", handler)

  // Desktop: the operator window is a separate webview, so also listen on the
  // Tauri event bus that useBroadcastPost mirrors to.
  const { isTauri } = useTauri()
  let unlistenTauri: (() => void) | null = null
  let tauriListenerCancelled = false

  if (isTauri) {
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<string>(LIVE_CHANNEL_NAME, (event) => deliver(event.payload))
      )
      .then((unlisten) => {
        if (tauriListenerCancelled) unlisten()
        else unlistenTauri = unlisten
      })
      .catch((error) => {
        console.warn("Failed to listen for desktop live broadcasts:", error)
      })
  }

  // Return cleanup function to close channel and remove listener
  return () => {
    bc.removeEventListener("message", handler)
    bc.close()
    tauriListenerCancelled = true
    unlistenTauri?.()
    unlistenTauri = null
  }
}

export default useBroadcastMessage
