<template>
  <div
    class="media-main min-h-[75vh] lg:min-h-[75vh] xl:min-h-[80vh] 2xl:min-h-[88vh] flex flex-col justify-between"
  >
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
        multiple
        @change="files = $event.target?.files"
      />
    </label>
    <div
      v-if="fileObjs?.length > 0"
      class="preview-ctn flex flex-col justify-end"
    >
      <h3
        class="bg-primary-100 dark:bg-primary-900 rounded-md p-4 py-2 text-md font-semibold capitalize mb-2"
      >
        Media Preview
        <span class="font-normal">({{ fileObjs?.length }} images/videos)</span>
      </h3>
      <Transition name="fade-sm">
        <div
          class="grid gap-1 max-h-[200px] overflow-auto rounded-md"
          :class="fileObjs?.length === 1 ? 'grid-cols-1' : 'grid-cols-3'"
        >
          <div
            v-for="fileObj in fileObjs"
            :key="fileObj.name"
            v-show="fileObj"
            class="file-preview relative"
          >
            <img
              v-if="fileObj?.type === 'image'"
              :src="fileObj.url"
              alt="previewed slide image"
              class="rounded-md max-h-[40vh] 2xl:max-h-[100%] bg-primary-950"
            />
            <video
              v-else
              :src="fileObj.url"
              autoplay
              muted
              alt="previewed slide image"
              class="rounded-md max-h-[40vh] 2xl:max-h-[100%]"
            />
            <div class="absolute top-0 left-1">
              <IconWrapper
                v-if="fileObj.type?.includes('image')"
                name="i-bx-image"
                size="4"
                class="text-white"
              />
              <IconWrapper
                v-if="fileObj.type?.includes('video')"
                name="i-bx-movie"
                size="4"
                class="text-white"
              />
            </div>
          </div>
        </div>
      </Transition>
      <UButton
        class="mt-2 w-[100%] flex justify-between"
        trailing-icon="i-bx-chevron-right"
        @click="addMediaEmitter"
        >Create Slides</UButton
      >
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Emitter } from "mitt"

const emitter = useNuxtApp().$emitter as Emitter<any>
const files = ref()
const emit = defineEmits(["close"])

const fileObjs = computed(() => {
  const tempArr: any[] = []
  files.value?.forEach((file: any) => {
    if (file) {
      console.log(file)
      tempArr.push({
        blob: file,
        name: file?.name,
        size: file?.size,
        type: file?.type?.split("/")?.[0],
        url: URL.createObjectURL(file),
      })
    }
  })
  return tempArr
})

const addMediaEmitter = () => {
  emitter.emit("new-media", fileObjs.value)
  emit("close")
}
</script>
