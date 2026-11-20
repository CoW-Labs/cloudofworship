<template>
  <div
    class="flex h-full w-full flex-col overflow-hidden bg-[#f1f3f6] text-gray-800 dark:bg-[#131724] dark:text-[#F8F9FB]"
  >
    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <p
        v-if="!animationsOn"
        class="mb-2 text-xs text-gray-500 dark:text-[#9BA3B2]"
      >
        Slide transitions are off in Settings, so this slide will cut straight in.
      </p>
      <div class="grid grid-cols-5 gap-[8.5px]">
        <button
          v-for="option in options"
          :key="option.key"
          type="button"
          class="transition-option group min-w-0 w-full rounded-xl p-2 flex flex-col gap-1.5 text-left transition-shadow bg-white dark:bg-[#131a27]"
          :class="
            selected === option.key
              ? 'ring-2 ring-primary-500'
              : 'ring-1 ring-gray-200 dark:ring-white/10 hover:ring-gray-300 dark:hover:ring-white/20'
          "
          :aria-pressed="selected === option.key"
          @click="emit('select', option.key === 'default' ? null : option.key)"
        >
          <!-- A still sketch of a slide; it plays its transition on hover
               only, so the panel costs nothing while it sits open. -->
          <span
            class="transition-thumb relative block w-full overflow-hidden rounded-md bg-purple-950"
            :data-type="option.preview"
            style="aspect-ratio: 16 / 9"
            aria-hidden="true"
          >
            <span class="thumb-line thumb-line-1 bg-purple-100"></span>
            <span class="thumb-line thumb-line-2 bg-purple-100"></span>
          </span>
          <span class="min-w-0 px-0.5">
            <span class="block truncate text-xs font-medium leading-4">
              {{ option.label }}
            </span>
            <span
              class="block truncate text-[10px] leading-4 text-gray-500 dark:text-[#9BA3B2]"
            >
              {{ option.hint }}
            </span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { TransitionType } from "~/types"

const props = defineProps<{
  value?: TransitionType
}>()

const emit = defineEmits<{
  (e: "select", type: TransitionType | null): void
  (e: "resize", size: { width: number; height: number }): void
}>()

const appStore = useAppStore()
const animationsOn = computed(
  () => appStore.currentState.settings.animations !== false
)
const globalType = computed<TransitionType>(
  () => appStore.currentState.settings.transitionType || "fade"
)
const globalLabel = computed(
  () =>
    transitionTypeOptions.find((o) => o.key === globalType.value)?.label ??
    "Fade"
)

const hints: Record<TransitionType, string> = {
  fade: "A soft crossfade",
  drift: "Words rise into place",
  breathe: "Words settle, a touch large",
  cascade: "Heading first, then words",
}

const options = computed(() => [
  {
    key: "default" as const,
    label: "Default",
    hint: `Follows Settings: ${globalLabel.value}`,
    preview: globalType.value,
  },
  ...transitionTypeOptions.map((o) => ({
    key: o.key,
    label: o.label,
    hint: hints[o.key],
    preview: o.key,
  })),
])

const selected = computed(() => props.value || "default")

onMounted(() => emit("resize", { width: 640, height: 168 }))
</script>

<style scoped>
.thumb-line {
  position: absolute;
  left: 22%;
  right: 22%;
  height: 9%;
  border-radius: 999px;
}
.thumb-line-1 {
  top: 36%;
}
.thumb-line-2 {
  top: 54%;
  left: 30%;
  right: 30%;
  opacity: 0.7;
}

.group:hover [data-type="fade"] .thumb-line {
  animation: thumb-fade 1.6s ease-in-out infinite;
}
.group:hover [data-type="drift"] .thumb-line {
  animation: thumb-drift 1.6s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
}
.group:hover [data-type="breathe"] .thumb-line {
  animation: thumb-breathe 1.6s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
}
.group:hover [data-type="cascade"] .thumb-line {
  animation: thumb-drift 1.6s cubic-bezier(0.22, 0.61, 0.36, 1) infinite;
}
.group:hover [data-type="cascade"] .thumb-line-2 {
  animation-delay: 0.18s;
}

@keyframes thumb-fade {
  0%,
  15% {
    opacity: 0;
  }
  55%,
  100% {
    opacity: 1;
  }
}
@keyframes thumb-drift {
  0%,
  15% {
    opacity: 0;
    transform: translateY(40%);
  }
  60%,
  100% {
    opacity: 1;
    transform: none;
  }
}
@keyframes thumb-breathe {
  0%,
  15% {
    opacity: 0;
    transform: scale(1.12);
  }
  60%,
  100% {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .thumb-line {
    animation: none !important;
  }
}
</style>
