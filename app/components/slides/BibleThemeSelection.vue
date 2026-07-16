<template>
  <div
    class="bible-theme-selection flex h-full w-full flex-col overflow-hidden bg-[#f1f3f6] text-gray-800 dark:bg-[#131724] dark:text-[#F8F9FB]"
  >
    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div class="grid grid-cols-3 gap-[8.5px]">
        <button
          v-for="theme in bibleThemes"
          :key="theme.id"
          type="button"
          class="theme-option min-w-0 rounded-xl bg-white/70 p-2 text-left ring-2 transition-colors dark:bg-[#222838]"
          :class="
            selectedTheme === theme.id
              ? 'bg-white ring-primary-300 dark:bg-[#2B3140] dark:ring-[#E8D1F8]'
              : 'ring-transparent hover:bg-white dark:hover:bg-[#2B3140]'
          "
          :aria-pressed="selectedTheme === theme.id"
          @click="selectTheme(theme.id)"
        >
          <span class="block text-[12px] font-normal leading-4">
            {{ theme.name }}
          </span>
          <p
            class="truncate text-[10px] leading-4 text-gray-500 dark:text-[#9BA3B2]"
          >
            {{ theme.description }}
          </p>

          <div
            class="theme-preview relative mt-1.5 h-[90px] w-full overflow-hidden rounded-lg bg-[#e4e8f0] dark:bg-[#171C29]"
            :class="theme.preview"
          >
            <div
              class="absolute inset-x-[9%] flex flex-col gap-2"
              :class="theme.id === 'label-top' ? 'top-[39%]' : 'top-[12%]'"
            >
              <span
                v-for="line in theme.id === 'label-background' ? 2 : 3"
                :key="line"
                class="h-2.5 rounded-full border border-black/[0.06] bg-[#d3d9e4] dark:border-white/[0.07] dark:bg-[#30394b]"
              ></span>
            </div>

            <span
              v-if="theme.id === 'label-top'"
              class="absolute left-1/2 top-[12%] h-2.5 w-[43%] -translate-x-1/2 rounded-full border border-black/[0.06] bg-[#d3d9e4] dark:border-white/[0.07] dark:bg-[#30394b]"
            ></span>

            <span
              v-else-if="theme.id === 'default' || theme.id === 'label-large'"
              class="absolute bottom-[12%] left-1/2 -translate-x-1/2 rounded-full border border-black/[0.06] bg-[#d3d9e4] dark:border-white/[0.07] dark:bg-[#30394b]"
              :class="
                theme.id === 'label-large' ? 'h-5 w-[43%]' : 'h-2.5 w-[43%]'
              "
            ></span>

            <div
              v-else
              class="absolute left-1/2 flex h-8 w-1/2 -translate-x-1/2 items-center justify-center rounded-full bg-[#cbd2df] dark:bg-[#0D0F1A]"
              :class="theme.id === 'overlay' ? 'bottom-0' : 'bottom-[12%]'"
            >
              <span
                class="h-2.5 w-[87%] rounded-full border border-black/[0.06] bg-[#d3d9e4] dark:border-white/[0.07] dark:bg-[#30394b]"
              ></span>
            </div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import useTheme from "~/composables/useTheme"

const props = defineProps<{
  value?: string
}>()

const emit = defineEmits<{
  (e: "select", themeId: string): void
  (e: "resize", size: { width: number; height: number }): void
}>()

const panelSize = { width: 753, height: 330 }

const { bibleThemes } = useTheme()

const selectedTheme = computed(() => props.value || "default")

const selectTheme = (themeId: string) => {
  emit("select", themeId)
}

onMounted(() => emit("resize", panelSize))
</script>
