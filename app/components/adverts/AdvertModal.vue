<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        // The advert is a single fixed-aspect image, so the panel tracks the
        // viewport instead of demanding 700px — below that the old min-width
        // pushed the image (and its close button) off-screen with no way back.
        base: 'w-[94vw] max-w-[700px] sm:w-auto sm:min-w-[700px] max-h-[88dvh] rounded-[24px] overflow-hidden',
      }"
      prevent-close
    >
      <button
        class="bg-primary-500 absolute p-1 text-white rounded-full top-2 right-2 z-10"
        @click="visible = false"
      >
        <CloseIcon class="p-2 text-white" />
      </button>
      <a
        :href="activeAdvert?.url"
        target="_blank"
        class="block"
        @click="onAdvertClicked"
      >
        <img
          class="w-full max-h-[88dvh] object-contain scale-105"
          :src="activeAdvert?.image"
        />
      </a>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Advert } from "~/types"
import { escapePriority } from "~/composables/useEscapeKey"

const props = defineProps<{
  activeAdvert: Advert | null
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
})

// `prevent-close` stops an accidental overlay click from dismissing the advert,
// but that also opts the modal out of Headless UI's Escape handling — Escape
// should still dismiss it.
useEscapeKey(
  () => {
    if (!visible.value) return false
    visible.value = false
    return true
  },
  { priority: escapePriority.modal }
)

const onAdvertClicked = () => {
  usePosthogCapture("ADVERT_CLICKED")
}
</script>
