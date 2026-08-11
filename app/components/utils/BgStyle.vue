<template>
  <div
    v-if="backgroundPanel"
    class="h-[114px] w-[198px] rounded-xl bg-white px-[17px] py-[14px] shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
  >
    <label
      class="block text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]"
    >
      Blur
    </label>
    <CoWSlider
      v-model="blur"
      class="mt-[4px] w-[164px]"
      :step="0.05"
      :min="0"
      :max="15"
      aria-label="Background blur"
    />

    <label
      class="mt-[19px] block text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]"
    >
      Brightness
    </label>
    <CoWSlider
      v-model="brightness"
      class="mt-[4px] w-[164px]"
      :min="20"
      :max="100"
      aria-label="Background brightness"
    />
  </div>

  <div v-else class="bg-style p-4 gap-4 grid grid-cols-1 w-[200px]">
    <UFormGroup>
      <label class="text-xs font-semibold mb-2 block"> Background Blur </label>
      <CoWSlider
        v-model="blur"
        :step="0.05"
        :min="0"
        :max="15"
        aria-label="Background blur"
      />
    </UFormGroup>
    <UFormGroup>
      <label class="text-xs font-semibold mb-2 block">
        Background brightness
      </label>
      <CoWSlider
        v-model="brightness"
        :min="20"
        :max="100"
        aria-label="Background brightness"
      />
    </UFormGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

defineProps<{
  backgroundPanel?: boolean
}>()

const appStore = useAppStore()
const blur = ref(appStore.currentState.settings.slideStyles.blur || 0)
const brightness = ref(
  appStore.currentState.settings.slideStyles.brightness || 0
)

watchEffect(() => {
  const tempSlideStyle = { ...appStore.currentState.settings.slideStyles }
  tempSlideStyle.blur = blur.value
  tempSlideStyle.brightness = brightness.value

  appStore.setSlideStyles(tempSlideStyle)
})
</script>
