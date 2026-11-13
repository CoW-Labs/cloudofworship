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
  // The quality tier this session was started with, e.g. "1080p60".
  quality: string
  framesSent: number
  connectionCount: number
  lastFrameAgeMs?: number | null
  stalled: boolean
  error?: NdiErrorInfo | null
}

export const DEFAULT_NDI_QUALITY = "1080p30"

// One size and frame rate the operator can pick. `available` is false when this
// computer can't send it yet, with `reason` saying why in plain words.
export interface NdiTier {
  id: string
  maxWidth: number
  maxHeight: number
  fps: number
  available: boolean
  reason: string | null
}

// "1080p 60 fps"; 2160 reads as 4K.
export const ndiTierLabel = (tier: NdiTier) =>
  `${tier.maxHeight === 2160 ? "4K" : `${tier.maxHeight}p`} ${tier.fps} fps`

const idleStatus = (): NdiStatus => ({
  phase: "idle",
  sourceName: "CoW Live Output",
  runtimeAvailable: false,
  runtimeVersion: null,
  runtimePath: null,
  capturePermission: "unknown",
  width: null,
  height: null,
  fps: 30,
  quality: DEFAULT_NDI_QUALITY,
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
  | "ndi_tiers"
  | "ndi_open_capture_settings"

export interface NdiCommandTransport {
  isDesktop: boolean
  invoke<T>(command: NdiCommand, args?: Record<string, unknown>): Promise<T>
  listen(event: "ndi://status", handler: (status: NdiStatus) => void): Promise<void>
}

/** A transport-injected command client, kept free of Vue so lifecycle behavior is testable. */
export const createNdiCommandClient = (
  transport: NdiCommandTransport,
  onStatus: (status: NdiStatus) => void
) => {
  let listening = false

  const run = async (command: "ndi_start" | "ndi_stop", quality?: string) => {
    if (!transport.isDesktop) return idleStatus()
    const status = await transport.invoke<NdiStatus>(
      command,
      command === "ndi_start" ? { quality } : undefined
    )
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
    start: (quality?: string) => run("ndi_start", quality),
    stop: () => run("ndi_stop"),
    async retry(quality?: string) {
      await run("ndi_stop")
      return run("ndi_start", quality)
    },
    async tiers() {
      if (!transport.isDesktop) return []
      return transport.invoke<NdiTier[]>("ndi_tiers")
    },
    async openCaptureSettings() {
      if (!transport.isDesktop) return
      await transport.invoke<void>("ndi_open_capture_settings")
    },
  }
}

let sharedStatusListener: Promise<void> | null = null

// The chosen quality stays on this device only, like the on/off preference.
const QUALITY_KEY = "cow-ndi-quality"
let qualityHydrated = false

export const useNdiBroadcast = () => {
  const { isTauri } = useTauri()
  const status = useState<NdiStatus>("ndi-status", idleStatus)
  const isInvoking = useState<boolean>("ndi-command-pending", () => false)
  const quality = useState<string>("ndi-quality", () => DEFAULT_NDI_QUALITY)
  const tiers = useState<NdiTier[]>("ndi-tiers", () => [])
  // Events fire after awaits, where Nuxt's context is gone, so each capture
  // runs inside the app's context.
  const nuxtApp = useNuxtApp()
  const track = (event: string, properties?: Record<string, unknown>) =>
    nuxtApp.runWithContext(() => usePosthogCapture(event, properties))

  if (isTauri && import.meta.client && !qualityHydrated) {
    qualityHydrated = true
    try {
      const saved = localStorage.getItem(QUALITY_KEY)
      if (saved) quality.value = saved
    } catch {
      // Storage can be unavailable; the choice then lasts for this session.
    }
    watch(quality, (value) => {
      try {
        localStorage.setItem(QUALITY_KEY, value)
      } catch {
        // Same: nothing to do but carry on.
      }
    })
  }

  const tierLabelFor = (tier: NdiTier) =>
    tier.available ? ndiTierLabel(tier) : `${ndiTierLabel(tier)} (not available on this computer)`
  const qualityChoices = computed(() => tiers.value.map(tierLabelFor))
  const qualityChoice = computed(() => {
    const tier =
      tiers.value.find((t) => t.id === quality.value) ??
      tiers.value.find((t) => t.id === DEFAULT_NDI_QUALITY)
    return tier ? tierLabelFor(tier) : ""
  })
  const setQualityChoice = (label: string) => {
    const tier = tiers.value.find((candidate) => tierLabelFor(candidate) === label)
    if (!tier || !tier.available || tier.id === quality.value) return
    quality.value = tier.id
    track("NDI_QUALITY_CHANGED", { quality: tier.id, fps: tier.fps, height: tier.maxHeight })
  }

  const client = createNdiCommandClient(
    {
      isDesktop: isTauri && import.meta.client,
      async invoke<T>(command: NdiCommand, args?: Record<string, unknown>) {
        const { invoke } = await import("@tauri-apps/api/core")
        return invoke<T>(command, args)
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
      tiers.value = await client.tiers()
      // A saved tier this computer can't send falls back to the default.
      const saved = tiers.value.find((tier) => tier.id === quality.value)
      if (tiers.value.length && (!saved || !saved.available)) quality.value = DEFAULT_NDI_QUALITY
    } catch (error) {
      console.error("Failed to initialize NDI status:", error)
    }
  }

  const invokeCommand = async (
    command: "start" | "stop" | "retry"
  ) => {
    isInvoking.value = true
    try {
      const result = await (command === "stop" ? client.stop() : client[command](quality.value))
      status.value = result
      if (command !== "stop" && result.phase === "broadcasting") {
        track("NDI_STARTED", { quality: result.quality, retry: command === "retry" })
      }
      return result
    } catch (error) {
      const info = applyCommandError(error)
      if (command !== "stop") track("NDI_START_FAILED", { quality: quality.value, error: info.code })
      throw info
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
    quality,
    qualityChoices,
    qualityChoice,
    setQualityChoice,
    initialize,
    start,
    retry,
    stop,
    openCaptureSettings,
  }
}
