<template>
  <div
    class="media-main min-h-[75vh] lg:min-h-[75vh] xl:min-h-[80vh] 2xl:min-h-[85vh] flex flex-col justify-between"
  >
    <!-- <label class="flex flex-col center text-center">
      <IconWrapper
        name="i-bx-image"
        size="12"
        class="py-4"
        rounded-bg
      ></IconWrapper>
      <h4 class="text-md mt-4 font-medium">Add image, video or audio slides</h4>
      <div
        class="text-center max-w-[150px] mx-auto px-4 py-1 mt-4 bg-primary-500 rounded-md flex items-center text-white cursor-pointer gap-1"
      >
        <IconWrapper name="i-bx-plus" size="5" />
        Add file
      </div>
      <input
        type="file"
        class="invisible"
        accept="video/*,image/*,audio/*"
        multiple
        @change="files = $event.target?.files"
      />
    </label> -->
    <div class="collector-ctn flex flex-col gap-3">
      <div
        class="alert flex gap-2 p-4 rounded-md bg-primary-100 dark:bg-primary-900"
      >
        <IconWrapper
          name="i-bx-info-circle"
          size="4"
          class="text-primary-500"
        />
        <div class="flex-1">
          <h4 class="text-md font-semibold">
            Add image, video or audio slides
          </h4>
          <p class="text-sm">
            You can now add files by dragging and dropping them here or by
            copying and pasting them from your file explorer.
          </p>
        </div>
      </div>
      <FileDropzone @change="files = $event" />
    </div>
    <div
      v-if="fileObjs?.length > 0"
      class="preview-ctn flex flex-col justify-end"
    >
      <h3
        class="bg-primary-100 dark:bg-primary-900 rounded-md p-4 py-2 text-md font-semibold capitalize mb-2"
      >
        Media Preview
        <span class="font-normal"
          >({{ fileObjs?.length }} file{{
            fileObjs?.length > 1 ? "s" : ""
          }})</span
        >
      </h3>
      <UButton
        class="mb-2 w-[100%] flex justify-between"
        trailing-icon="i-bx-chevron-right"
        :loading="imageCompressionLoading"
        @click="addMediaEmitter"
        >Create Slides</UButton
      >
      <Transition name="fade-sm">
        <div
          class="grid gap-1 max-h-[200px] overflow-auto rounded-md overflow-x-hidden"
          :class="fileObjs?.length === 1 ? 'grid-cols-1' : 'grid-cols-3'"
        >
          <div
            v-for="(fileObj, index) in fileObjs"
            :key="fileObj.name"
            v-show="fileObj"
            class="file-preview relative border-2 border-primary-100 rounded-md flex min-h-[100px] cursor-pointer group group-hover:border-primary-500"
            @click="removeFile(index)"
          >
            <img
              v-if="fileObj?.type === 'image'"
              :src="fileObj.url"
              alt="previewed slide image"
              class="rounded-md max-h-[40vh] 2xl:max-h-[100%] bg-primary-950 object-contain"
            />
            <audio
              v-if="fileObj?.type === 'audio'"
              alt="previewed slide image"
              controls
              class="max-h-[40vh] 2xl:max-h-[100%] w-[100%]"
            >
              <source :src="fileObj.url" type="audio/mp3" />
            </audio>
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
            <div
              class="bg-primary-800 opacity-0 absolute inset-0 flex items-center justify-center rounded-md group-hover:opacity-90 transition-all"
            >
              <IconWrapper name="i-bx-trash" size="8" class="text-white" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>
<script setup lang="ts">
import { appWideActions } from "~/utils/constants"
import type { Emitter } from "mitt"

const imageCompressionLoading = ref(false)
const emitter = useNuxtApp().$emitter as Emitter<any>
const files = ref()
const emit = defineEmits(["close"])

const fileObjs = computed(() => {
  const tempArr: any[] = []
  files.value?.forEach((file: any) => {
    if (file) {
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

const addMediaEmitter = async () => {
  imageCompressionLoading.value = true
  // console.log("uncompressedFiles", fileObjs.value)
  const compressedFiles = await Promise.all(
    fileObjs.value.map(async (fileObj) => {
      let compressedFile = fileObj.blob
      if (fileObj.type.includes("image")) {
        compressedFile = await useCompressedImage(fileObj.blob)
      }
      URL.revokeObjectURL(fileObj.url)
      return {
        ...fileObj,
        blob: compressedFile,
        url: URL.createObjectURL(compressedFile),
      }
    })
  )
  // console.log("compressedFiles", compressedFiles)
  imageCompressionLoading.value = false
  useGlobalEmit(appWideActions.newMedia, compressedFiles)
  files.value = []
  emit("close")
}

const removeFile = (index: number) => {
  // console.log(index)
  files.value.splice(index, 1)
}
</script>
