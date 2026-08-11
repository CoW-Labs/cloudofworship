<template>
  <Transition
    name="overlay-panel"
    appear
    :duration="{ enter: 220, leave: 180 }"
  >
    <div
      v-if="overlaySlide"
      class="overlay-slide-stage absolute inset-0 z-[15] pointer-events-none flex"
      :class="positionClasses"
    >
      <div
        class="overlay-slide-scale"
        :style="{
          '--overlay-scale': String(resolvedSettings.scale / 200),
          '--overlay-origin': transformOrigin,
        }"
      >
        <div class="overlay-slide-panel relative isolate">
          <div
            class="overlay-slide-surface absolute inset-0"
            :class="{ 'overlay-slide-surface--dynamic': dynamicBackground }"
          />
          <div class="overlay-slide-content relative z-[1]">
            <div v-if="isTimeOverlay" class="overlay-time-content">
              <div v-if="timeLabel" class="overlay-time-label jost">
                {{ timeLabel }}
              </div>
              <div
                class="overlay-time-value opacity-95"
                :class="timeFontClass"
              >
                {{ formattedTime }}
              </div>
            </div>
            <div v-else-if="isCountdownOverlay" class="overlay-time-content">
              <div v-if="countdownLabel" class="overlay-time-label jost">
                {{ countdownLabel }}
              </div>
              <div
                class="overlay-time-value opacity-95"
                :class="timeFontClass"
              >
                {{ formattedCountdown }}
              </div>
            </div>
            <LiveContent
              v-else
              :slide="overlaySlide"
              :content-visible="true"
              :padding="{ top: 0, right: 0, bottom: 0, left: 0 }"
            />
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Countdown, OverlayPosition, TimeSlideData } from "~/types"

defineProps<{
  size?: string
  dynamicBackground?: boolean
}>()

const { currentState } = storeToRefs(useAppStore())
const { getOverlaySettingsForSlide } = useOverlaySettings()
const overlaySlide = computed(() => currentState.value.activeOverlaySlide)
const formattedTime = useLiveClock()
const isTimeOverlay = computed(
  () => overlaySlide.value?.type === slideTypes.time
)
const isCountdownOverlay = computed(
  () => overlaySlide.value?.type === slideTypes.countdown
)
const timeLabel = computed(
  () => (overlaySlide.value?.data as TimeSlideData | undefined)?.label || ""
)
const countdownData = computed(
  () => overlaySlide.value?.data as Countdown | undefined
)
const countdownLabel = computed(() => countdownData.value?.content || "")
const formattedCountdown = ref("")
const localCountdownEndsAt = ref<number | null>(null)
let countdownTimeout: ReturnType<typeof setTimeout> | null = null
const timeFontClass = computed(() =>
  useURLFriendlyString(overlaySlide.value?.slideStyle?.font || "Inter")
)
const resolvedSettings = computed(() =>
  getOverlaySettingsForSlide(overlaySlide.value)
)

const positionClasses = computed(() => {
  const classes: Record<OverlayPosition, string> = {
    "top-left": "items-start justify-start",
    "top-middle": "items-start justify-center",
    "top-right": "items-start justify-end",
    middle: "items-center justify-center",
    "bottom-left": "items-end justify-start",
    "bottom-middle": "items-end justify-center",
    "bottom-right": "items-end justify-end",
  }
  return classes[resolvedSettings.value.position]
})

const horizontalPosition = computed(() => {
  if (resolvedSettings.value.position.endsWith("left")) return "left"
  if (resolvedSettings.value.position.endsWith("right")) return "right"
  return "center"
})

const verticalPosition = computed(() => {
  if (resolvedSettings.value.position.startsWith("top")) return "top"
  if (resolvedSettings.value.position.startsWith("bottom")) return "bottom"
  return "center"
})

const transformOrigin = computed(
  () => `${horizontalPosition.value} ${verticalPosition.value}`
)

const stopCountdownClock = () => {
  if (countdownTimeout) clearTimeout(countdownTimeout)
  countdownTimeout = null
}

const updateCountdownClock = () => {
  stopCountdownClock()
  const data = countdownData.value
  if (!data) {
    formattedCountdown.value = ""
    return
  }

  const isPlaying = Boolean(
    overlaySlide.value?.slideStyle?.isMediaPlaying &&
      localCountdownEndsAt.value
  )
  const remaining = isPlaying
    ? Math.max(0, (localCountdownEndsAt.value as number) - Date.now())
    : useTimeStringToMilli(data.timeLeft || "00:00:00")

  formattedCountdown.value = useMilliToTimeString(remaining).replace("00:", "")
  if (isPlaying && remaining > 0) {
    const delay = Math.min(1000, (remaining % 1000) + 20)
    countdownTimeout = setTimeout(updateCountdownClock, delay)
  }
}

watch(
  [
    () => overlaySlide.value?.id,
    () => overlaySlide.value?.slideStyle?.isMediaPlaying,
    () => countdownData.value?.timeLeft,
    () => countdownData.value?.remainingMs,
  ],
  () => {
    localCountdownEndsAt.value =
      overlaySlide.value?.slideStyle?.isMediaPlaying &&
      countdownData.value?.remainingMs != null
        ? Date.now() + countdownData.value.remainingMs
        : null
    updateCountdownClock()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopCountdownClock()
})
</script>

<style scoped>
.overlay-slide-stage {
  container-type: inline-size;
  padding: 5%;
}

.overlay-slide-scale {
  max-width: 100%;
  transform: scale(var(--overlay-scale));
  transform-origin: var(--overlay-origin);
}

.overlay-slide-panel {
  max-width: 58cqw;
  padding: clamp(20px, 3.2cqw, 58px) clamp(30px, 5cqw, 92px);
  backface-visibility: hidden;
  contain: layout style;
  transform-origin: var(--overlay-origin);
}

.overlay-slide-surface {
  border: 1px solid rgb(255 255 255 / 0.25);
  border-radius: 9999px;
  background: rgb(107 114 128 / 0.72);
  box-shadow: 0 16px 45px rgb(0 0 0 / 0.3);
  backdrop-filter: blur(8px);
  backface-visibility: hidden;
}

.overlay-slide-surface--dynamic {
  background: rgb(75 85 99 / 0.92);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.24);
  backdrop-filter: none;
}

.overlay-slide-content {
  width: max-content;
  max-width: 50cqw;
}

.overlay-time-content {
  font-size: clamp(18px, 4.25cqw, 82px);
  line-height: 1;
  white-space: nowrap;
}

.overlay-time-label {
  margin-bottom: 0.25em;
  font-size: 0.7em;
  line-height: 1.1;
}

.overlay-slide-content :deep(.live-content),
.overlay-slide-content :deep(.slide-layout-ctn) {
  width: auto !important;
  height: auto !important;
}

.overlay-slide-content :deep(.live-content) {
  padding: 0;
}

.overlay-slide-content :deep(.slide-layout-ctn) {
  min-height: 0 !important;
  max-width: 50cqw;
  font-size: clamp(18px, 4.25cqw, 82px) !important;
}

.overlay-slide-content :deep(.tiptap.live-content h1),
.overlay-slide-content :deep(.tiptap.live-content h2),
.overlay-slide-content :deep(.tiptap.live-content h3),
.overlay-slide-content :deep(.tiptap.live-content h4),
.overlay-slide-content :deep(.tiptap.live-content h5),
.overlay-slide-content :deep(.tiptap.live-content h6) {
  margin: 2cqw 0 !important;
}

.overlay-slide-content :deep(.tiptap.live-content h1) {
  font-size: 6cqw !important;
}

.overlay-slide-content :deep(.tiptap.live-content h2) {
  font-size: 5.5cqw !important;
}

.overlay-slide-content :deep(.tiptap.live-content h3) {
  font-size: 5cqw !important;
}

.overlay-slide-content :deep(.tiptap.live-content h4) {
  font-size: 4.7cqw !important;
}

.overlay-slide-content :deep(p:last-child) {
  margin-bottom: 0;
}

.overlay-panel-enter-active {
  transition: opacity 220ms ease-out;
  will-change: opacity;
}

.overlay-panel-enter-active .overlay-slide-panel {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform;
}

.overlay-panel-leave-active .overlay-slide-panel {
  transition: transform 180ms ease-in;
  will-change: transform;
}

.overlay-panel-leave-active {
  transition: opacity 180ms ease-in;
  will-change: opacity;
}

.overlay-panel-enter-from,
.overlay-panel-leave-to {
  opacity: 0;
}

.overlay-panel-enter-from .overlay-slide-panel,
.overlay-panel-leave-to .overlay-slide-panel {
  transform: scale(0.8);
}

@media (prefers-reduced-motion: reduce) {
  .overlay-panel-enter-active,
  .overlay-panel-leave-active,
  .overlay-panel-enter-active .overlay-slide-panel,
  .overlay-panel-leave-active .overlay-slide-panel {
    transition-duration: 1ms;
  }
}
</style>
