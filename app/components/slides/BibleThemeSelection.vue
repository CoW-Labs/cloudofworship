<template>
  <div class="p-4 w-[350px] h-[300px] overflow-auto">
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="theme in bibleThemes"
        :key="theme.id"
        class="theme-option flex flex-col items-center p-3 rounded-lg border transition-all hover:bg-primary-100 dark:hover:bg-primary-800"
        :class="{
          'border-primary-500 bg-primary-50 dark:bg-primary-900':
            selectedTheme === theme.id,
          'border-primary-200 dark:border-primary-700':
            selectedTheme !== theme.id,
        }"
        @click="selectTheme(theme.id)"
      >
        <!-- Theme Preview -->
        <div
          class="theme-preview w-full h-16 mb-2 rounded-md bg-primary-800 relative overflow-hidden flex items-center justify-center"
          :class="theme.preview"
        >
          <ThemePreview :theme="theme" />
        </div>

        <!-- Theme Info -->
        <div class="text-left">
          <div class="flex items-center justify-start gap-1.5">
            <UIcon
              :name="theme.icon"
              class="w-4 h-4 text-primary-600 dark:text-primary-300"
            />
            <span class="text-xs font-medium">
              {{ theme.name }}
            </span>
          </div>
          <p class="text-[10px] opacity-60 mt-0.5 leading-tight">
            {{ theme.description }}
          </p>
        </div>
      </button>
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
}>()

const { bibleThemes } = useTheme()

const selectedTheme = computed(() => props.value || "default")

const selectTheme = (themeId: string) => {
  emit("select", themeId)
}
</script>

<style scoped>
.theme-option:hover {
  transform: scale(1.02);
}

.theme-preview {
  background: linear-gradient(135deg, #1e3a5f 0%, #2d5a7b 100%);
}
</style>
