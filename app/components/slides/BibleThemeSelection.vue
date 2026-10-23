<template>
  <div
    class="bible-theme-selection flex w-full flex-col text-gray-800 dark:text-[#F8F9FB]"
    :class="
      embedded
        ? 'rounded-2xl bg-[#f1f3f6] p-2 dark:bg-[#1b212e]'
        : 'h-full overflow-hidden bg-[#f1f3f6] dark:bg-[#131724]'
    "
  >
    <div :class="embedded ? '' : 'min-h-0 flex-1 overflow-y-auto px-3 py-3'">
      <div
        class="grid gap-[8.5px]"
        :class="embedded ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'"
      >
        <button
          v-for="theme in bibleThemes"
          :key="theme.id"
          type="button"
          class="theme-option min-w-0 w-full rounded-xl p-2 flex flex-col gap-1.5 text-left transition-shadow bg-white dark:bg-[#131a27]"
          :class="
            selectedTheme === theme.id
              ? 'ring-2 ring-primary-500'
              : 'ring-1 ring-gray-200 dark:ring-white/10 hover:ring-gray-300 dark:hover:ring-white/20'
          "
          :aria-pressed="selectedTheme === theme.id"
          @click="selectTheme(theme.id)"
        >
          <BibleLayoutThumb :layout="theme.layout" />
          <span class="min-w-0 px-0.5">
            <span class="block truncate text-xs font-medium leading-4">
              {{ theme.name }}
            </span>
            <span
              class="block truncate text-[10px] leading-4 text-gray-500 dark:text-[#9BA3B2]"
            >
              {{ theme.description }}
            </span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import useTheme from "~/composables/useTheme"

const props = defineProps<{
  value?: string
  /**
   * Renders the grid inline (e.g. inside a settings panel) instead of as a
   * popover panel: no panel chrome, no fixed height, no resize handshake.
   */
  embedded?: boolean
}>()

const emit = defineEmits<{
  (e: "select", themeId: string): void
  (e: "resize", size: { width: number; height: number }): void
}>()

// Three 16:9 tiles a row, two rows.
const panelSize = { width: 753, height: 395 }

const { bibleThemes } = useTheme()

const selectedTheme = computed(() => props.value || "default")

const selectTheme = (themeId: string) => {
  emit("select", themeId)
}

onMounted(() => {
  if (!props.embedded) emit("resize", panelSize)
})
</script>
