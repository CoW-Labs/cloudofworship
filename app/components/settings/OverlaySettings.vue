<template>
  <div class="settings-ctn h-full overflow-y-auto mb-[2.5%] pb-[15%]">
    <div class="settings-group">
      <div class="mb-4">
        <h3 class="text-md font-semibold">Content Overlay Layout</h3>
        <p class="text-xs text-gray-500 mt-1">
          These settings apply to text, countdown, and time overlays.
        </p>
      </div>

      <UForm :state="{}">
        <UFormGroup
          label="Position"
          class="flex items-center justify-between py-2 px-2 hover:bg-primary/10"
        >
          <CowSelectMenu
            class="border-0 shadow-none max-w-[220px]"
            select-class="w-[220px] bg-gray-100 dark:bg-gray-800 dark:text-white"
            size="md"
            :options="positionOptions"
            :model-value="overlaySettings.position"
            variant="none"
            color="primary"
            :ui-menu="selectMenuUI"
            @change="updatePosition($event.key)"
          />
        </UFormGroup>

        <UFormGroup
          label="Size"
          class="flex flex-col py-3 px-2 hover:bg-primary/10"
        >
          <div class="flex items-center gap-3 w-full mt-2">
            <span class="text-sm w-10">50%</span>
            <URange
              :model-value="draftScale"
              :min="50"
              :max="200"
              :step="5"
              @update:model-value="draftScale = Number($event)"
              @change="commitScale"
            />
            <span class="text-sm w-12 text-right">200%</span>
          </div>
          <div class="text-xs text-gray-500 mt-2">
            Current size: {{ draftScale }}%
          </div>
        </UFormGroup>
      </UForm>
    </div>

    <UDivider class="my-6" />

    <div class="settings-group relative">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold relative">
          Overlays & Themes
          <IconWrapper
            v-if="showTeamsBadge && !hasAccessToOverlays"
            name="i-bxs-award"
            class="inline-flex w-6 h-6 text-xs ml-2 text-[#FF8980] absolute -top-1 cursor-pointer"
            @click="handleUpgradeClick"
          />
        </h3>
      </div>
      <UForm :state="{}">
        <UFormGroup
          label="Decorative overlay"
          class="flex w-full items-center justify-between py-2 px-2 hover:bg-primary/10"
        >
          <CowSelectMenu
            class="border-0 shadow-none max-w-[220px]"
            select-class="w-[220px] bg-gray-100 dark:bg-gray-800 dark:text-white"
            size="md"
            :options="decorativeOverlayOptions"
            :model-value="appStore.currentState.activeOverlay"
            :disabled="!hasAccessToOverlays"
            variant="none"
            color="primary"
            :ui-menu="selectMenuUI"
            @change="updateDecorativeOverlay($event.key)"
          />
        </UFormGroup>
      </UForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OverlayPosition, Slide } from "~/types"
import { useAppStore } from "~/store/app"
import { tabSessionId } from "~/composables/useRealtimeSlides"

const appStore = useAppStore()
const emitter = useNuxtApp().$emitter as any
const { hasAccessToFeature } = useSubscription()
const { isEnabled: isPremiumFeatureEnabled } = useFeatureFlags("teams")
const {
  overlaySettings,
  applyOverlaySettings,
  setOverlaySettings,
} = useOverlaySettings()

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

const hasAccessToOverlays = computed(() => {
  if (!isPremiumFeatureEnabled.value) return true
  return hasAccessToFeature("overlays-themes")
})

const showTeamsBadge = computed(() => isPremiumFeatureEnabled.value)

const selectMenuUI = {
  width: "w-[220px]",
  input: "text-xs",
  empty: "text-xs",
  option: { size: "text-xs" },
}

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
