const useBroadcastMessage = (callback: (data: unknown) => void) => {
  const bc = new BroadcastChannel("cow-live-channel")

  const handler = (event: MessageEvent) => {
    callback(event.data)
  }

  bc.addEventListener("message", handler)

  // Return cleanup function to close channel and remove listener
  return () => {
    bc.removeEventListener("message", handler)
    bc.close()
  }
}

export default useBroadcastMessage
