<template>
  <div
    class="template-card group relative flex min-w-0 flex-col gap-1.5"
    :style="{ contentVisibility: 'auto', containIntrinsicSize: 'auto 180px' }"
  >
    <button
      type="button"
      class="block w-full overflow-hidden rounded-lg text-left shadow-sm ring-1 ring-gray-200/70 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:ring-white/10"
      :aria-label="`Use ${template.name}`"
      @click="$emit('use', template)"
    >
      <TemplatePreview :design="template.design" />
    </button>

    <div class="min-w-0 px-0.5">
      <h4 class="flex items-center gap-1.5 text-sm font-semibold">
        <span class="truncate">{{ template.name }}</span>
        <span
          v-if="template.design.motion"
          class="shrink-0 rounded-full bg-primary-100 px-1.5 py-px text-[10px] font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-300"
          title="Slow motion on the projector"
        >
          Motion
        </span>
      </h4>
      <p
        v-if="template.description"
        class="line-clamp-2 text-xs text-gray-500 dark:text-[#9aa3b2]"
      >
        {{ template.description }}
      </p>
    </div>

    <button
      v-if="canDelete"
      type="button"
      class="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition focus-visible:opacity-100 group-hover:opacity-100"
      :aria-label="`Delete ${template.name}`"
      @click.stop="$emit('delete', template)"
    >
      <CloseIcon class="h-3.5 w-3.5" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Template } from "~/types"

defineProps<{
  template: Template
  canDelete?: boolean
}>()

defineEmits<{ use: [Template]; delete: [Template] }>()
</script>
