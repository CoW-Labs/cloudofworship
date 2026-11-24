<template>
  <div
    class="settings-ctn h-[100%] flex flex-col gap-8 overflow-y-auto mb-[2.5%] p-1.5 pb-[10%]"
  >
    <SettingsGroup
      title="NDI live output"
      note="Publish the live window to NDI receivers on your local network. NDI 5 or 6 must be installed separately."
    >
      <SettingsRow
        label="Broadcast live output over NDI"
        description="Starts after the live window opens. Stored on this device only."
      >
        <CowToggle
          bare
          label="Broadcast live output over NDI"
          :model-value="currentState.settings.ndiEnabled ?? false"
          @update:model-value="handleNdiToggle"
        />
      </SettingsRow>

      <SettingsRow
        v-if="ndiQualityChoices.length"
        label="NDI quality"
        description="The size and frame rate receivers get, never larger than your live window. 4K and 60 fps need a wired gigabit network and a receiver that can keep up. Applies the next time NDI starts."
      >
        <SettingsSelect
          width="w-full sm:w-[140px]"
          :options="ndiQualityChoices"
          :model-value="ndiQualityChoice"
          :disabled="ndiStatus.phase === 'broadcasting' || ndiStatus.phase === 'starting'"
          @change="(label: string) => setNdiQualityChoice(label)"
        />
      </SettingsRow>

      <div
        class="rounded-2xl bg-white dark:bg-[#131a27] ring-1 ring-gray-200 dark:ring-white/10 p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="ndiPhaseDotClass"
            />
            <span class="text-sm font-semibold">{{ ndiPhaseLabel }}</span>
            <span
              v-if="ndiStatus.stalled"
              class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            >
              Stalled
            </span>
          </div>
          <Icon
            v-if="ndiBusy"
            name="i-ph-circle-notch"
            class="w-4 h-4 animate-spin text-primary-500"
          />
        </div>

        <ul
          class="mt-3 divide-y divide-gray-100 dark:divide-white/5 text-xs"
        >
          <li class="flex items-center gap-2.5 py-2.5">
            <Icon
              name="i-ph-broadcast"
              class="w-4 h-4 shrink-0 text-gray-400 dark:text-[#9aa3b2]"
            />
            <span class="text-gray-500 dark:text-[#9aa3b2]">Source</span>
            <span class="ml-auto min-w-0 truncate font-medium">
              {{ ndiStatus.sourceName }}
            </span>
          </li>

          <li class="flex items-center gap-2.5 py-2.5">
            <NdiLogo
              class="w-4 h-4 shrink-0"
              :class="
                runtimeMissing
                  ? 'text-amber-500'
                  : 'text-gray-400 dark:text-[#9aa3b2]'
              "
            />
            <span class="text-gray-500 dark:text-[#9aa3b2]">NDI runtime</span>
            <span
              class="ml-auto min-w-0 truncate font-medium"
              :class="runtimeMissing && 'text-amber-600 dark:text-amber-400'"
              :title="ndiStatus.runtimePath || undefined"
            >
              {{
                ndiStatus.runtimeVersion ||
                (runtimeMissing ? "Not installed" : "Not detected")
              }}
            </span>
          </li>

          <li
            v-if="ndiResolution"
            class="flex items-center gap-2.5 py-2.5"
          >
            <Icon
              name="i-ph-monitor"
              class="w-4 h-4 shrink-0 text-gray-400 dark:text-[#9aa3b2]"
            />
            <span class="text-gray-500 dark:text-[#9aa3b2]">Output</span>
            <span class="ml-auto font-medium">{{ ndiResolution }}</span>
          </li>

          <li
            v-if="ndiStatus.phase === 'broadcasting'"
            class="flex items-center gap-2.5 py-2.5"
          >
            <Icon
              name="i-ph-users"
              class="w-4 h-4 shrink-0 text-gray-400 dark:text-[#9aa3b2]"
            />
            <span class="text-gray-500 dark:text-[#9aa3b2]">Receivers</span>
            <span class="ml-auto font-medium">
              {{ ndiStatus.connectionCount }}
            </span>
          </li>
        </ul>

        <div
          v-if="ndiStatus.error"
          class="mt-3 flex gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-200"
        >
          <Icon name="i-ph-warning-circle" class="w-4 h-4 shrink-0 mt-px" />
          <div>
            <p class="font-semibold">{{ ndiStatus.error.message }}</p>
            <p v-if="ndiStatus.error.hint" class="mt-1 leading-relaxed">
              {{ ndiStatus.error.hint }}
            </p>
          </div>
        </div>

        <div
          v-else-if="showWindowsNetworkHint"
          class="mt-3 flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200"
        >
          <Icon name="i-ph-info" class="w-4 h-4 shrink-0 mt-px" />
          <p>
            No receiver is connected. If your NDI receiver cannot find this
            source, allow Cloud of Worship on Windows Firewall and confirm the
            network is marked Private.
          </p>
        </div>

        <div
          v-if="showNdiActions"
          class="mt-3 flex flex-wrap items-center justify-end gap-2"
        >
          <CowButton
            v-if="runtimeMissing"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            @click="useOpenExternal('https://ndi.video/tools/')"
          >
            <Icon name="i-ph-arrow-square-out" class="w-3.5 h-3.5" />
            Get NDI Tools
          </CowButton>
          <CowButton
            v-if="ndiStatus.error?.recoverable && currentState.settings.ndiEnabled"
            variant="secondary"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            :loading="ndiBusy"
            @click="retryNdi"
          >
            <Icon name="i-ph-arrow-clockwise" class="w-3.5 h-3.5" />
            {{ runtimeMissing ? "Check again" : "Retry" }}
          </CowButton>
          <CowButton
            v-if="capturePermissionNeeded"
            variant="secondary"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            @click="openNdiCaptureSettings"
          >
            <Icon name="i-ph-gear" class="w-3.5 h-3.5" />
            Screen Recording settings
          </CowButton>
        </div>
      </div>
    </SettingsGroup>

    <SettingsGroup
      v-if="streamingEnabled"
      title="Live stream"
      note="Broadcast your live output (slides/lyrics) and audio online. Going live streams the live output window automatically."
    >
      <template #badge>
        <span
          class="shrink-0 text-[9px] font-bold leading-none tracking-wide border border-primary-500 text-primary-600 dark:text-primary-400 rounded px-1.5 py-[2px]"
        >
          BETA
        </span>
      </template>

      <SettingsRow
        label="YouTube stream key"
        description="Find it in YouTube Studio under Go Live, then Stream settings. It stays on this device."
        stacked
      >
        <CowInput
          v-model="streamKey"
          class="stream-key-input w-full mt-3"
          label="Paste your key"
          type="password"
          placeholder="xxxx-xxxx-xxxx-xxxx"
          :disabled="isStreaming"
        />
      </SettingsRow>

      <SettingsRow
        label="Stream when I go live"
        description="When on, clicking Go Live opens the live window and starts the stream automatically, in one action."
      >
        <CowToggle
          bare
          label="Stream when I go live"
          :model-value="streamOnGoLive"
          :disabled="isStreaming"
          @update:model-value="(on) => (streamOnGoLive = on)"
        />
      </SettingsRow>

      <SettingsRow
        label="Audio source"
        description="The audio sent to the broadcast. For clean sound, pick your mixer or soundboard input, not the built-in mic."
      >
        <SettingsSelect
          width="w-full sm:w-[160px]"
          :options="streamAudioChoices"
          :model-value="streamAudioChoice"
          :disabled="isStreaming"
          @change="(label: string) => setAudioChoice(label)"
        />
      </SettingsRow>

      <SettingsRow
        v-if="streamQualityChoices.length"
        label="Stream quality"
        :description="streamQualityNote"
      >
        <SettingsSelect
          width="w-full sm:w-[300px]"
          :options="streamQualityChoices"
          :model-value="streamQualityChoice"
          :disabled="isStreaming"
          @change="(label: string) => setQualityChoice(label)"
        />
      </SettingsRow>

      <SettingsRow
        label="Check before streaming"
        description="Before each stream, test your upload speed, your connection to YouTube and your audio level."
      >
        <CowToggle
          bare
          label="Check before streaming"
          :model-value="streamCheckFirst"
          @update:model-value="(on) => (streamCheckFirst = on)"
        />
      </SettingsRow>

      <SettingsRow
        label="Send a test pattern instead"
        description="Broadcasts color bars and a tone rather than your live output — handy to confirm the YouTube connection first."
      >
        <CowToggle
          bare
          label="Send a test pattern instead"
          :model-value="streamSource === 'test'"
          :disabled="isStreaming"
          @update:model-value="(on) => (streamSource = on ? 'test' : 'live-window')"
        />
      </SettingsRow>

      <div
        class="rounded-2xl bg-white dark:bg-[#131a27] ring-1 ring-gray-200 dark:ring-white/10 p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="streamPhaseDotClass"
            />
            <span class="text-sm font-semibold">{{ streamPhaseLabel }}</span>
            <Icon
              v-if="streamBusy"
              name="i-ph-circle-notch"
              class="w-4 h-4 animate-spin text-primary-500"
            />
          </div>
          <CowButton
            v-if="!isStreaming"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            :loading="streamBusy"
            :disabled="!streamKey.trim()"
            @click="startStream"
          >
            <Icon name="i-ph-broadcast" class="w-3.5 h-3.5" />
            Go live
          </CowButton>
          <CowButton
            v-else
            variant="secondary"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            :loading="streamBusy"
            @click="endStream"
          >
            <Icon name="i-ph-stop-circle" class="w-3.5 h-3.5" />
            Stop
          </CowButton>
        </div>

        <ul
          v-if="!isStreaming"
          class="mt-3 divide-y divide-gray-100 dark:divide-white/5 text-xs"
        >
          <li class="flex items-center gap-2.5 py-2.5">
            <Icon
              :name="streamKey.trim() ? 'i-ph-key' : 'i-ph-warning'"
              class="w-4 h-4 shrink-0"
              :class="
                streamKey.trim()
                  ? 'text-gray-400 dark:text-[#9aa3b2]'
                  : 'text-amber-500'
              "
            />
            <span class="text-gray-500 dark:text-[#9aa3b2]">Stream key</span>
            <span
              class="ml-auto font-medium"
              :class="
                !streamKey.trim() && 'text-amber-600 dark:text-amber-400'
              "
            >
              {{ streamKey.trim() ? "Added" : "Add one above to go live" }}
            </span>
          </li>
          <li class="flex items-center gap-2.5 py-2.5">
            <Icon
              :name="streamSource === 'test' ? 'i-ph-test-tube' : 'i-ph-monitor'"
              class="w-4 h-4 shrink-0 text-gray-400 dark:text-[#9aa3b2]"
            />
            <span class="text-gray-500 dark:text-[#9aa3b2]">Source</span>
            <span class="ml-auto font-medium">
              {{ streamSource === "test" ? "Test pattern" : "Live output" }}
            </span>
          </li>
        </ul>

        <div
          v-if="streamStatus.phase === 'reconnecting'"
          class="mt-3 flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200"
        >
          <Icon name="i-ph-warning" class="w-4 h-4 shrink-0 mt-px" />
          <p class="font-semibold">{{ streamStatus.error || "Reconnecting…" }}</p>
        </div>
        <div
          v-else-if="streamStatus.phase === 'error' && streamStatus.error"
          class="mt-3 flex gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-200"
        >
          <Icon name="i-ph-warning-circle" class="w-4 h-4 shrink-0 mt-px" />
          <p class="font-semibold">{{ streamStatus.error }}</p>
        </div>

        <StreamStats
          v-if="isStreaming && streamSource !== 'test'"
          class="mt-3 !w-full"
        />
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store/app"
import NdiLogo from "@/components/svgs/NdiLogo.vue"
// Everything about streaming the live output online: stream key, audio,
// quality, the pre-flight check and the current stream's status.
const {
  status: streamStatus,
  isInvoking: streamBusy,
  isStreaming,
  streamKey,
  source: streamSource,
  streamOnGoLive,
  audioChoices: streamAudioChoices,
  audioChoice: streamAudioChoice,
  setAudioChoice,
  checkBeforeStreaming: streamCheckFirst,
  qualityChoices: streamQualityChoices,
  qualityChoice: streamQualityChoice,
  setQualityChoice,
  qualityIsUpscaled: streamQualityUpscaled,
  sourceHeight: streamSourceHeight,
  initialize,
  start: startStream,
  end: endStream,
} = useStreamOutput()

onMounted(() => {
  initialize()
  initializeNdi()
})

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const { isEnabled: streamingEnabled } = useFeatureFlags("live-streaming")
const {
  status: ndiStatus,
  isInvoking: ndiBusy,
  initialize: initializeNdi,
  start: startNdi,
  stop: stopNdi,
  retry: retryNdiCommand,
  openCaptureSettings,
  qualityChoices: ndiQualityChoices,
  qualityChoice: ndiQualityChoice,
  setQualityChoice: setNdiQualityChoice,
} = useNdiBroadcast()


const ndiPhaseLabel = computed(() => {
  if (ndiStatus.value.stalled) return "Broadcasting last frame"
  return {
    idle: runtimeMissing.value ? "Can't broadcast yet" : "Not broadcasting",
    starting: "Starting",
    broadcasting: "Broadcasting",
    error: "Needs attention",
    unsupported: "Unsupported on this system",
  }[ndiStatus.value.phase]
})

const ndiPhaseDotClass = computed(() => ({
  "bg-gray-400": ndiStatus.value.phase === "idle",
  "bg-amber-500 animate-pulse": ndiStatus.value.phase === "starting",
  "bg-green-500": ndiStatus.value.phase === "broadcasting" && !ndiStatus.value.stalled,
  "bg-amber-500": ndiStatus.value.phase === "broadcasting" && ndiStatus.value.stalled,
  "bg-red-500": ndiStatus.value.phase === "error",
  "bg-gray-500": ndiStatus.value.phase === "unsupported",
}))

const ndiResolution = computed(() =>
  ndiStatus.value.width && ndiStatus.value.height
    ? `${ndiStatus.value.width} × ${ndiStatus.value.height} · ${ndiStatus.value.fps} fps`
    : ""
)
const runtimeMissing = computed(
  () => ndiStatus.value.error?.code === "runtimeNotInstalled"
)
const capturePermissionNeeded = computed(() =>
  ["required", "denied"].includes(ndiStatus.value.capturePermission)
)
const showWindowsNetworkHint = computed(
  () =>
    import.meta.client &&
    navigator.userAgent.includes("Windows") &&
    ndiStatus.value.phase === "broadcasting" &&
    ndiStatus.value.connectionCount === 0
)
const showNdiActions = computed(
  () =>
    Boolean(ndiStatus.value.error?.recoverable) ||
    runtimeMissing.value ||
    capturePermissionNeeded.value
)

const liveWindowIsOpen = async () => {
  const { getAllWebviewWindows } = await import(
    "@tauri-apps/api/webviewWindow"
  )
  return (await getAllWebviewWindows()).some(
    (window) => window.label === "live-output"
  )
}

const handleNdiToggle = async (enabled: boolean) => {
  appStore.setNdiEnabled(enabled)
  if (!enabled) {
    try {
      await stopNdi()
    } catch (error) {
      console.warn("Could not stop NDI cleanly:", error)
    }
    return
  }

  if (!(await liveWindowIsOpen())) {
    useToast().add({
      title: "NDI will start with the live window",
      icon: "i-ph-check-circle",
    })
    return
  }
  try {
    await startNdi()
  } catch (error: any) {
    useToast().add({
      title: "NDI could not start",
      description: error?.message,
      icon: "i-ph-warning-circle",
      color: "red",
    })
  }
}

const retryNdi = async () => {
  if (!(await liveWindowIsOpen())) {
    useToast().add({
      title: "Open the live window before retrying NDI",
      icon: "i-ph-info",
      color: "amber",
    })
    return
  }
  try {
    await retryNdiCommand()
  } catch (error: any) {
    useToast().add({
      title: "NDI retry failed",
      description: error?.message,
      icon: "i-ph-warning-circle",
      color: "red",
    })
  }
}

const openNdiCaptureSettings = async () => {
  try {
    await openCaptureSettings()
  } catch (error: any) {
    useToast().add({
      title: "Could not open Screen Recording settings",
      description: error?.message,
      icon: "i-ph-warning-circle",
      color: "red",
    })
  }
}



const streamQualityNote = computed(() =>
  streamQualityUpscaled.value
    ? `Your live window is ${streamSourceHeight.value}p, so this quality is an upscale. It won't look sharper than 1080p.`
    : "Higher qualities need a faster upload and a stronger computer. Some are greyed out on computers that can't make them."
)

const streamPhaseLabel = computed(
  () =>
    ({
      idle: "Not streaming",
      live: "Live",
      reconnecting: "Reconnecting…",
      error: "Needs attention",
    })[streamStatus.value.phase]
)

const streamPhaseDotClass = computed(() => ({
  "bg-gray-400": streamStatus.value.phase === "idle",
  "bg-green-500": streamStatus.value.phase === "live",
  "bg-amber-500 animate-pulse": streamStatus.value.phase === "reconnecting",
  "bg-red-500": streamStatus.value.phase === "error",
}))
</script>

<style>
/* Visible resting border for the stream key field only. */
.stream-key-input .cow-input__field {
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.18);
}
.stream-key-input .cow-input__field:hover:not(.cow-input__field--focused) {
  box-shadow: inset 0 0 0 1.5px rgba(15, 23, 42, 0.3);
}
.stream-key-input .cow-input__field.cow-input__field--focused {
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.85);
}
html.dark .stream-key-input .cow-input__field {
  box-shadow: inset 0 0 0 1.5px rgba(148, 163, 184, 0.3);
}
html.dark .stream-key-input .cow-input__field:hover:not(.cow-input__field--focused) {
  box-shadow: inset 0 0 0 1.5px rgba(148, 163, 184, 0.45);
}
html.dark .stream-key-input .cow-input__field.cow-input__field--focused {
  box-shadow: inset 0 0 0 2px rgba(248, 250, 252, 0.92);
}
</style>
