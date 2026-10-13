<template>
  <div
    class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%] flex flex-col gap-8"
  >
    <!-- ALERT SETTINGS -->
    <SettingsGroup title="Alert Settings">
      <SettingsSlider
        label="Default alert limit"
        :description="`Currently ${currentState.settings.alertLimit ?? 5} alerts.`"
        :model-value="currentState.settings.alertLimit ?? 5"
        :min="5"
        :max="30"
        :step="1"
        @change="updateSetting('alertLimit', Number($event))"
      />
    </SettingsGroup>

    <!-- TRANSCRIPTION SETTINGS -->
    <SettingsGroup title="Transcription Settings">
      <SettingsRow
        label="Automatic transcription actions"
        description="Automatically open detected Bible references and respond to sermon voice navigation commands while transcribing."
      >
        <CowToggle
          bare
          label="Automatic transcription actions"
          :model-value="currentState.settings.transcriptionAutoActions ?? true"
          @update:model-value="updateSetting('transcriptionAutoActions', $event)"
        />
      </SettingsRow>

      <SettingsRow
        label="Voice Bible version changes"
        description="Let commands like “switch to NIV” change the active Bible slide to a downloaded Bible version."
        :disabled="!(currentState.settings.transcriptionAutoActions ?? true)"
      >
        <CowToggle
          bare
          label="Voice Bible version changes"
          :disabled="!(currentState.settings.transcriptionAutoActions ?? true)"
          :model-value="
            currentState.settings.transcriptionVoiceBibleVersionCommands ?? true
          "
          @update:model-value="
            updateSetting('transcriptionVoiceBibleVersionCommands', $event)
          "
        />
      </SettingsRow>
    </SettingsGroup>

    <!-- OVERLAY LAYOUT SETTINGS -->
    <SettingsGroup
      title="Content Overlay Layout"
      note="These settings apply to text, countdown, and time overlays."
    >
      <SettingsRow label="Position">
        <SettingsSelect
          :options="positionOptions"
          value-attribute="key"
          option-attribute="label"
          :model-value="overlaySettings.position"
          @change="updatePosition($event)"
        />
      </SettingsRow>

      <SettingsSlider
        label="Size"
        v-model="draftScale"
        :min="50"
        :max="200"
        :step="5"
        suffix="%"
        @change="commitScale"
      />
    </SettingsGroup>

    <!-- DECORATIVE OVERLAY SETTINGS -->
    <SettingsGroup title="Overlays & Themes">
      <template #badge>
        <IconWrapper
          v-if="showTeamsBadge && !hasAccessToOverlays"
          name="i-bxs-award"
          class="inline-flex w-5 h-5 text-[#FF8980] cursor-pointer"
          @click="handleUpgradeClick"
        />
      </template>

      <SettingsRow
        label="Decorative overlay"
        description="Adds an ambient effect on top of every live slide."
        :disabled="!hasAccessToOverlays"
      >
        <SettingsSelect
          :options="decorativeOverlayOptions"
          value-attribute="key"
          option-attribute="label"
          :model-value="appStore.currentState.activeOverlay"
          :disabled="!hasAccessToOverlays"
          @change="updateDecorativeOverlay($event)"
        />
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { AppSettings, OverlayPosition, Slide } from "~/types"
import { tabSessionId } from "~/composables/useRealtimeSlides"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const emitter = useNuxtApp().$emitter as any
const { hasAccessToFeature, isPaywallEnabled } = useSubscription()
const { overlaySettings, applyOverlaySettings, setOverlaySettings } =
  useOverlaySettings()

const updateSetting = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
) => {
  appStore.setAppSettings({
    ...appStore.currentState.settings,
    [key]: value,
  })
}

const positionOptions = [
  { key: "top-left", label: "Top left" },
  { key: "top-middle", label: "Top middle" },
  { key: "top-right", label: "Top right" },
  { key: "middle", label: "Middle" },
  { key: "bottom-left", label: "Bottom left" },
  { key: "bottom-middle", label: "Bottom middle" },
  { key: "bottom-right", label: "Bottom right" },
] satisfies Array<{ key: OverlayPosition; label: string }>

const decorativeOverlayOptions = [
  { key: "falling-snow", label: "Falling Snow" },
  { key: "none", label: "None selected" },
]

const hasAccessToOverlays = computed(() => hasAccessToFeature("overlays-themes"))

const showTeamsBadge = computed(() => isPaywallEnabled.value)

const draftScale = ref(overlaySettings.value.scale)

watch(
  () => overlaySettings.value.scale,
  (scale) => {
    draftScale.value = scale
  }
)

const broadcastActiveOverlay = () => {
  const activeOverlay = appStore.currentState.activeOverlaySlide
  if (!activeOverlay) return

  const updatedOverlay: Slide = applyOverlaySettings(activeOverlay)
  appStore.setActiveOverlaySlide(updatedOverlay)
  useBroadcastOverlayPost(appWideActions.showSlideOverlay, updatedOverlay)

  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) {
    socket.emit(appWideActions.showSlideOverlay, {
      ...updatedOverlay,
      tabId: tabSessionId,
    })
  }
}

const updatePosition = (position: OverlayPosition) => {
  setOverlaySettings({ position })
  broadcastActiveOverlay()
}

const commitScale = () => {
  if (draftScale.value === overlaySettings.value.scale) return
  setOverlaySettings({ scale: draftScale.value })
  broadcastActiveOverlay()
}

onBeforeUnmount(commitScale)

const handleUpgradeClick = () => {
  emitter.emit("show-upgrade-modal")
  usePosthogCapture("TEAMS_FEATURE_BLOCKED", {
    feature: "overlay-settings-premium",
  })
}

const removeDecorativeOverlay = () => {
  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) socket.emit("remove-overlay", {})
}

const updateDecorativeOverlay = (overlay: string) => {
  if (!hasAccessToOverlays.value) {
    handleUpgradeClick()
    return
  }

  appStore.setActiveOverlay(overlay)
  if (!overlay || overlay === "none") {
    removeDecorativeOverlay()
    return
  }

  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) socket.emit("add-overlay", overlay)
}
</script>
