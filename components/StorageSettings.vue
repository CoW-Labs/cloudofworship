<template>
  <div class="settings-ctn h-[100%]">
    <div class="header flex items-center justify-between gap-2">
      <div class="col flex items-center gap-2">
        <Icon name="i-lucide-hard-drive" class="w-8 h-8" />
        <h3 class="text-lg font-semibold">
          {{ formatMegabytes(totalDataSize) }}
          <span class="text-sm font-normal">stored on this computer</span>
        </h3>
      </div>
      <Icon
        v-if="loading"
        name="i-lucide-loader-2"
        class="w-6 h-6 animate-spin"
      />
    </div>
    <div class="storage-chart flex rounded-full overflow-hidden my-2 w-full">
      <div
        class="storage-chart-bar-inner h-[10px] bg-primary-500 transition-all"
        :style="{
          width: `${(cachedTableSize / totalDataSize) * 100}%`,
        }"
      ></div>
      <div
        class="storage-chart-bar-inner h-[10px] bg-teal-500 transition-all"
        :style="{
          width: `${(libraryTableSize / totalDataSize) * 100}%`,
        }"
      ></div>
      <div
        class="storage-chart-bar-inner h-[10px] bg-cyan-500 transition-all"
        :style="{
          width: `${(bibleAndHymnsTableSize / totalDataSize) * 100}%`,
        }"
      ></div>
      <div
        class="storage-chart-bar-inner h-[10px] bg-blue-500 transition-all"
        :style="{
          width: `${(mediaTableSize / totalDataSize) * 100}%`,
        }"
      ></div>
    </div>

    <table class="table-auto w-full">
      <tbody>
        <tr class="border-b border-gray-200 dark:border-gray-800 h-[50px]">
          <td>
            <div class="flex items-center gap-2">
              <div
                class="colored-circle rounded-full w-3 h-3 bg-primary-500"
              ></div>
              Background Videos and Images
            </div>
          </td>
          <td>{{ formatMegabytes(cachedTableSize) }}</td>
        </tr>
        <tr class="border-b border-gray-200 dark:border-gray-800 h-[50px]">
          <td>
            <div class="flex items-center gap-2">
              <div
                class="colored-circle rounded-full w-3 h-3 bg-teal-500"
              ></div>
              Library Items
            </div>
          </td>
          <td>{{ formatMegabytes(libraryTableSize) }}</td>
        </tr>
        <tr class="border-b border-gray-200 dark:border-gray-800 h-[50px]">
          <td>
            <div class="flex items-center gap-2">
              <div
                class="colored-circle rounded-full w-3 h-3 bg-cyan-500"
              ></div>
              Bible versions and hymns
            </div>
          </td>
          <td>{{ formatMegabytes(bibleAndHymnsTableSize) }}</td>
        </tr>
        <tr class="border-gray-200 dark:border-gray-800 h-[50px]">
          <td>
            <div class="flex items-center gap-2">
              <div
                class="colored-circle rounded-full w-3 h-3 bg-blue-500"
              ></div>
              Media Slides (Images, Videos, Audio)
            </div>
          </td>
          <td>{{ formatMegabytes(mediaTableSize) }}</td>
        </tr>
      </tbody>
    </table>

    <div class="danger-zone mt-4 bg-red-100 dark:bg-red-900 rounded-md p-4">
      <h3 class="font-medium">Danger Zone</h3>
      <p class="text-xs mb-4 mt-2">
        This is a danger zone. If you are not sure what you are doing, do not
        delete anything here. If you are sure, click the button below.
      </p>
      <UInput
        v-if="deletePrompt"
        v-model="deletePromptText"
        placeholder="Type 'intentionally deleting' to confirm"
        input-class=" bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        class="mb-4"
        size="xs"
      >
      </UInput>
      <UButton
        color="danger"
        block
        icon="i-bx-trash"
        variant="outline"
        :disabled="
          deletePrompt ? deletePromptText !== 'intentionally deleting' : false
        "
        @click="deletePrompt ? deleteAllData() : (deletePrompt = true)"
      >
        Clear all data on this device
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Media } from "~/types"

const db = useIndexedDB()
const loading = ref<boolean>(true)
const cachedTableSize = ref<number>(0)
const libraryTableSize = ref<number>(0)
const bibleAndHymnsTableSize = ref<number>(0)
const mediaTableSize = ref<number>(0)
const deletePrompt = ref<boolean>(false)
const deletePromptText = ref<string>("")

const totalDataSize = computed(() => {
  return (
    cachedTableSize.value +
    libraryTableSize.value +
    bibleAndHymnsTableSize.value +
    mediaTableSize.value
  )
})

const formatMegabytes = (sizeInMegabytes: number) => {
  if (sizeInMegabytes >= 1024) {
    return `${sizeInMegabytes.toFixed(2)} GB`
  } else {
    return `${sizeInMegabytes.toFixed(2)} MB`
  }
}

const getStoreSize = async (store: any) => {
  let storeSize = 0
  await store.each((item: any) => {
    const itemSize = new Blob([JSON.stringify(item)]).size
    storeSize += itemSize
  })
  return storeSize
}

const calculateMediaTableSize = async () => {
  let totalSize = 0
  // console.log("mediaTableSize", await db.media.count())
  await db.media.each((item: Media) => {
    totalSize += item?.data?.byteLength || 0
  })
  mediaTableSize.value = totalSize / 1024 / 1024
}

const calculateBackgroundVideosAndImagesTableSize = async () => {
  let totalSize = 0
  db.cached.count
  await db.cached.each((item: any) => {
    totalSize += item?.data?.size || 0
  })
  cachedTableSize.value = totalSize / 1024 / 1024
}

const calculateLibraryTableSize = async () => {
  libraryTableSize.value = (await getStoreSize(db.library)) / 1024 / 1024
}

const calculateBibleAndHymnsTableSize = async () => {
  bibleAndHymnsTableSize.value =
    (await getStoreSize(db.bibleAndHymns)) / 1024 / 1024
}

const deleteAllData = async () => {
  loading.value = true
  console.log("deleting all data")

  await db.delete()
  deletePrompt.value = false
  deletePromptText.value = ""
  loading.value = false
}

// calculateMediaTableSize()
// calculateBackgroundVideosAndImagesTableSize()
// calculateLibraryTableSize()
// calculateBibleAndHymnsTableSize()
// loading.value = false

onMounted(async () => {
  loading.value = true
  await calculateMediaTableSize()
  await calculateBackgroundVideosAndImagesTableSize()
  await calculateLibraryTableSize()
  await calculateBibleAndHymnsTableSize()
  loading.value = false
})
</script>

<style scoped></style>
