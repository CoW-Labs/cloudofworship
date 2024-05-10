<template>
  <div class="media-main min-h-[80vh] 2xl:min-h-[85vh]">
    <label class="flex flex-col center text-center">
      <IconWrapper
        name="i-bx-image"
        size="12"
        class="py-4"
        rounded-bg
      ></IconWrapper>
      <h4 class="text-md mt-4 font-medium">Add image or video slides</h4>
      <div
        class="text-center max-w-[150px] mx-auto px-4 py-1 mt-4 bg-primary-500 rounded-md flex items-center text-white cursor-pointer gap-1"
      >
        <IconWrapper name="i-bx-plus" size="5" />
        Add file
      </div>
      <input
        type="file"
        class="invisible"
        accept="video/*,image/*"
        @change="file = $event.target?.files?.[0]"
      />
    </label>
    <Transition name="fade-sm">
      <div
        v-if="file"
        class="file-preview mt-[100%] absolute inset-0 top-auto p-4"
      >
        <h3
          class="bg-primary-100 dark:bg-primary-900 rounded-md p-4 py-2 text-md font-semibold capitalize"
        >
          {{ fileObj?.type }} Preview
        </h3>
        <img
          v-if="fileObj?.type === 'image'"
          :src="fileObj.url"
          alt="previewed slide image"
          class="rounded-md mt-2 max-h-[40vh] 2xl:max-h-[100%]"
        />
        <video
          v-else
          :src="fileObj.url"
          autoplay
          controls
          alt="previewed slide image"
          class="rounded-md mt-2 max-h-[40vh] 2xl:max-h-[100%]"
        />
        <UButton
          class="mt-2 w-[100%] flex justify-between"
          trailing-icon="i-bx-chevron-right"
          @click="addMediaEmitter"
          >Create Slide</UButton
        >
      </div>
    </Transition>
  </div>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"

const emitter = useNuxtApp().$emitter as Emitter<any>
const file = ref()
const emit = defineEmits(["close"])

const fileObj = computed(() =>
  file.value
    ? {
        blob: file.value,
        name: file.value?.name,
        size: file.value?.size,
        type: file.value?.type?.split("/")?.[0],
        url: URL.createObjectURL(file.value),
      }
    : null
)

const addMediaEmitter = () => {
  emitter.emit("new-media", fileObj.value)
  emit("close")
}
</script>
