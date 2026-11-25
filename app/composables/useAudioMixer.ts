// Frontend for the desktop stream's audio mixer (see src-tauri/src/stream/mixer.rs).
//
// The mixer mixes the microphone and this app's own sound (video slides, song
// tracks) into the broadcast. The levels are the operator's own and stay on
// this device. They are sent with the start request, so the stream opens as
// they left it, and changed live through `stream_mixer_set`.

import { watchDebounced, useThrottleFn } from "@vueuse/core"

export type MixerSourceName = "mic" | "app"

export interface MixerSource {
  present: boolean
  gain: number
  muted: boolean
}

export interface MixerState {
  active: boolean
  mic?: MixerSource
  app?: MixerSource
  appReason?: string | null
}

// dB peaks since the last reading; null when that source isn't running.
export interface MixerLevels {
  mic: number | null
  app: number | null
  master: number
}

const SETTINGS_KEY = "cow-audio-mixer"
export const MIXER_MAX_PERCENT = 150
export const MIXER_SILENT_DB = -60

interface SavedLevels {
  micGain: number
  micMuted: boolean
  appGain: number
  appMuted: boolean
}

const defaults = (): SavedLevels => ({
  micGain: 1,
  micMuted: false,
  appGain: 1,
  appMuted: false,
})

const readSaved = (): SavedLevels => {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }
  } catch {
    return defaults()
  }
}

let hydrated = false

export const useAudioMixer = () => {
  const levels = useState<SavedLevels>("audio-mixer-levels", defaults)
  const state = useState<MixerState>("audio-mixer-state", () => ({ active: false }))
  const live = useState<MixerLevels | null>("audio-mixer-live", () => null)
  const { isTauri } = useTauri()

  if (import.meta.client && !hydrated) {
    hydrated = true
    levels.value = readSaved()
    // A fader drag changes the levels dozens of times a second; saving once it
    // settles is plenty.
    watchDebounced(
      levels,
      (value) => {
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
        } catch {
          // Storage can be unavailable; the levels then last for this session.
        }
      },
      { deep: true, debounce: 400, maxWait: 2000 }
    )
  }

  const invokeTauri = async <T>(command: string, args?: Record<string, unknown>) => {
    const { invoke } = await import("@tauri-apps/api/core")
    return invoke<T>(command, args)
  }

  // What the start request carries, so the stream opens at the saved levels.
  const settingsForStart = () => ({ ...levels.value })

  const refresh = async () => {
    if (!isTauri) return
    try {
      state.value = await invokeTauri<MixerState>("stream_mixer_state")
    } catch {
      state.value = { active: false }
    }
  }

  const keys = {
    mic: { gain: "micGain", muted: "micMuted" },
    app: { gain: "appGain", muted: "appMuted" },
  } as const

  const gainOf = (source: MixerSourceName) => levels.value[keys[source].gain]
  const mutedOf = (source: MixerSourceName) => levels.value[keys[source].muted]

  // The screen follows the fader at once; the app is told at most ~20 times a
  // second, and always hears the final position.
  const sendGain = {
    mic: useThrottleFn(
      (gain: number) => invokeTauri("stream_mixer_set", { source: "mic", gain }).catch(() => undefined),
      50,
      true,
      true
    ),
    app: useThrottleFn(
      (gain: number) => invokeTauri("stream_mixer_set", { source: "app", gain }).catch(() => undefined),
      50,
      true,
      true
    ),
  }
  const setGain = async (source: MixerSourceName, gain: number) => {
    levels.value[keys[source].gain] = gain
    await sendGain[source](gain)
  }

  const setMuted = async (source: MixerSourceName, muted: boolean) => {
    levels.value[keys[source].muted] = muted
    await invokeTauri("stream_mixer_set", { source, muted }).catch(() => undefined)
  }

  // Readings are only produced while someone is looking at them.
  const watchLevels = async () => {
    if (!isTauri) return () => undefined
    const { listen } = await import("@tauri-apps/api/event")
    const unlisten = await listen<MixerLevels>("stream://mixer-levels", (message) => {
      live.value = message.payload
    })
    await invokeTauri("stream_mixer_levels", { on: true }).catch(() => undefined)
    return () => {
      unlisten()
      live.value = null
      void invokeTauri("stream_mixer_levels", { on: false }).catch(() => undefined)
    }
  }

  return {
    state: readonly(state),
    live: readonly(live),
    refresh,
    gainOf,
    mutedOf,
    setGain,
    setMuted,
    settingsForStart,
    watchLevels,
  }
}
