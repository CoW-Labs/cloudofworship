export type NdiPhase =
  | "idle"
  | "starting"
  | "broadcasting"
  | "error"
  | "unsupported"

export type NdiCapturePermission =
  | "unknown"
  | "notRequired"
  | "granted"
  | "required"
  | "denied"

export interface NdiErrorInfo {
  code: string
  message: string
  hint?: string | null
  helpUrl?: string | null
  recoverable: boolean
}

export interface NdiStatus {
  phase: NdiPhase
  sourceName: string
  runtimeAvailable: boolean
  runtimeVersion?: string | null
  runtimePath?: string | null
  capturePermission: NdiCapturePermission
  width?: number | null
  height?: number | null
  fps: number
  framesSent: number
  connectionCount: number
  lastFrameAgeMs?: number | null
  stalled: boolean
  error?: NdiErrorInfo | null
}

const idleStatus = (): NdiStatus => ({
  phase: "idle",
  sourceName: "Cow Live Center",
  runtimeAvailable: false,
  runtimeVersion: null,
  runtimePath: null,
  capturePermission: "unknown",
  width: null,
  height: null,
  fps: 30,
  framesSent: 0,
  connectionCount: 0,
  lastFrameAgeMs: null,
  stalled: false,
  error: null,
})

const asErrorInfo = (error: unknown): NdiErrorInfo => {
  if (error && typeof error === "object" && "code" in error) {
    const value = error as Partial<NdiErrorInfo>
    return {
      code: String(value.code || "internal"),
      message: String(value.message || "NDI could not start."),
      hint: value.hint,
      helpUrl: value.helpUrl,
      recoverable: value.recoverable ?? true,
    }
  }
  return {
    code: "internal",
    message: error instanceof Error ? error.message : String(error),
    recoverable: true,
  }
}

type NdiCommand =
  | "ndi_start"
  | "ndi_stop"
  | "ndi_status"
  | "ndi_open_capture_settings"

export interface NdiCommandTransport {
  isDesktop: boolean
  invoke<T>(command: NdiCommand): Promise<T>
  listen(event: "ndi://status", handler: (status: NdiStatus) => void): Promise<void>
}

/** A transport-injected command client, kept free of Vue so lifecycle behavior is testable. */
export const createNdiCommandClient = (
  transport: NdiCommandTransport,
  onStatus: (status: NdiStatus) => void
) => {
  let listening = false

  const run = async (command: "ndi_start" | "ndi_stop") => {
    if (!transport.isDesktop) return idleStatus()
    const status = await transport.invoke<NdiStatus>(command)
    onStatus(status)
    return status
  }

  return {
    async initialize() {
      if (!transport.isDesktop) return idleStatus()
      if (!listening) {
        await transport.listen("ndi://status", onStatus)
        listening = true
      }
      const status = await transport.invoke<NdiStatus>("ndi_status")
      onStatus(status)
      return status
    },
    start: () => run("ndi_start"),
    stop: () => run("ndi_stop"),
    async retry() {
      await run("ndi_stop")
      return run("ndi_start")
    },
    async openCaptureSettings() {
      if (!transport.isDesktop) return
      await transport.invoke<void>("ndi_open_capture_settings")
    },
  }
}

let sharedStatusListener: Promise<void> | null = null

export const useNdiBroadcast = () => {
  const { isTauri } = useTauri()
  const status = useState<NdiStatus>("ndi-status", idleStatus)
  const isInvoking = useState<boolean>("ndi-command-pending", () => false)

  const client = createNdiCommandClient(
    {
      isDesktop: isTauri && import.meta.client,
      async invoke<T>(command: NdiCommand) {
        const { invoke } = await import("@tauri-apps/api/core")
        return invoke<T>(command)
      },
      async listen(event, handler) {
        if (!sharedStatusListener) {
          sharedStatusListener = import("@tauri-apps/api/event")
            .then(({ listen }) =>
              listen<NdiStatus>(event, (message) => handler(message.payload))
            )
            .then(() => undefined)
            .catch((error) => {
              sharedStatusListener = null
              throw error
            })
        }
        await sharedStatusListener
      },
    },
    (nextStatus) => {
      status.value = nextStatus
    }
  )

  const applyCommandError = (error: unknown) => {
    const errorInfo = asErrorInfo(error)
    status.value = {
      ...status.value,
      phase:
        errorInfo.code === "unsupportedPlatform" ||
        errorInfo.code === "unsupportedOsVersion"
          ? "unsupported"
          : "error",
      error: errorInfo,
    }
    return errorInfo
  }

  const initialize = async () => {
    try {
      await client.initialize()
    } catch (error) {
      console.error("Failed to initialize NDI status:", error)
    }
  }

  const invokeCommand = async (
    command: "start" | "stop" | "retry"
  ) => {
    isInvoking.value = true
    try {
      const result = await client[command]()
      status.value = result
      return result
    } catch (error) {
      throw applyCommandError(error)
    } finally {
      isInvoking.value = false
    }
  }

  const start = () => invokeCommand("start")
  const stop = () => invokeCommand("stop")
  const retry = () => invokeCommand("retry")

  const openCaptureSettings = async () => {
    try {
      await client.openCaptureSettings()
    } catch (error) {
      throw applyCommandError(error)
    }
  }

  return {
    status: readonly(status),
    isInvoking: readonly(isInvoking),
    initialize,
    start,
    retry,
    stop,
    openCaptureSettings,
  }
}
