<template>
  <div
    class="w-full h-full p-1.5 flex text-white text-[6px] leading-tight"
    :class="{
      'flex-col justify-center': !isHorizontal,
      'flex-row items-center gap-1': isHorizontal,
      'flex-col-reverse': theme.layout.labelPosition === 'top',
      'flex-row-reverse': theme.layout.labelPosition === 'right',
    }"
  >
    <!-- Scripture Content Preview -->
    <div
      class="content-preview flex-1"
      :class="{
        'text-left': theme.layout.contentAlignment === 'left',
        'text-center': theme.layout.contentAlignment === 'center',
        'text-right': theme.layout.contentAlignment === 'right',
      }"
    >
      <p class="opacity-90">For God so loved the world...</p>
    </div>

    <!-- Label Preview -->
    <div
      class="label-preview mt-1"
      :class="[
        labelClasses,
        {
          'text-left': theme.layout.labelAlignment === 'left',
          'text-center': theme.layout.labelAlignment === 'center',
          'text-right': theme.layout.labelAlignment === 'right',
          'absolute bottom-0 left-0 right-0 mt-0': theme.layout.labelPosition === 'overlay',
        },
      ]"
    >
      <span
        :class="{
          'bg-black/40 px-1 py-0.5 rounded-sm': theme.layout.labelBackground,
          'text-[8px]': theme.layout.labelSize === 'large',
          'text-[10px] font-semibold': theme.layout.labelSize === 'xlarge',
        }"
      >
        John 3:16
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BibleTheme } from '~/composables/useTheme'

const props = defineProps<{
  theme: BibleTheme
}>()

const isHorizontal = computed(() => 
  props.theme.layout.labelPosition === 'left' || props.theme.layout.labelPosition === 'right'
)

const labelClasses = computed(() => {
  const classes: string[] = []
  
  if (props.theme.layout.labelPosition === 'right') {
    classes.push('writing-vertical-lr', 'rotate-180', 'text-[5px]')
  }
  
  if (props.theme.layout.labelPosition === 'left') {
    classes.push('writing-vertical-rl', 'text-[5px]')
  }
  
  if (props.theme.id === 'minimal') {
    classes.push('opacity-50')
  }
  
  return classes.join(' ')
})
</script>

<style scoped>
.writing-vertical-lr {
  writing-mode: vertical-lr;
}

.writing-vertical-rl {
  writing-mode: vertical-rl;
}
</style>
