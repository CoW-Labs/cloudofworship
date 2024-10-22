<template>
  <div class="bg-style p-4 gap-4 grid grid-cols-1 w-[200px]">
    <UFormGroup>
      <label class="text-xs font-semibold mb-2 block"> Background Blur </label>
      <URange v-model="blur" size="sm" step="0.05" min="0" max="15" />
    </UFormGroup>
    <UFormGroup>
      <label class="text-xs font-semibold mb-2 block">
        Background brightness
      </label>
      <URange v-model="brightness" size="sm" min="20" max="100" />
    </UFormGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

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
