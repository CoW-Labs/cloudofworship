<template>
  <div
    v-if="backgroundPanel"
    class="h-[114px] w-[198px] rounded-xl bg-[#222838] px-[17px] py-[14px]"
  >
    <label class="block text-[12px] leading-[17px] text-[#9BA3B2]">
      Blur
    </label>
    <input
      v-model.number="blur"
      class="cow-background-range mt-[4px] block"
      type="range"
      :step="0.05"
      :min="0"
      :max="15"
      aria-label="Background blur"
    />

    <label
      class="mt-[19px] block text-[12px] leading-[17px] text-[#9BA3B2]"
    >
      Brightness
    </label>
    <input
      v-model.number="brightness"
      class="cow-background-range mt-[4px] block"
      type="range"
      :min="20"
      :max="100"
      aria-label="Background brightness"
    />
  </div>

  <div v-else class="bg-style p-4 gap-4 grid grid-cols-1 w-[200px]">
    <UFormGroup>
      <label class="text-xs font-semibold mb-2 block"> Background Blur </label>
      <URange 
        v-model="blur" 
        size="sm" 
        :step="0.05" 
        :min="0" 
        :max="15" />
    </UFormGroup>
    <UFormGroup>
      <label class="text-xs font-semibold mb-2 block">
        Background brightness
      </label>
      <URange
        v-model="brightness"
        size="sm"
        :min="20"
        :max="100" />
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

<style scoped>
.cow-background-range {
  width: 164px;
  height: 12px;
  margin-left: 0;
  margin-right: 0;
  appearance: none;
  cursor: pointer;
  border: 1px solid rgb(255 255 255 / 6%);
  border-radius: 999px;
  background: rgb(255 255 255 / 6%);
}

.cow-background-range::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: #f8f9fb;
}

.cow-background-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 0;
  border-radius: 999px;
  background: #f8f9fb;
}

.cow-background-range:focus-visible {
  outline: 2px solid #e8d1f8;
  outline-offset: 2px;
}
</style>
