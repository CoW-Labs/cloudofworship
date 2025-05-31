<template>
  <div class="h-[100%] overflow-y-auto mb-[2.5%]">
    <div
      v-for="bibleVersion in bibleVersionOptions"
      :key="bibleVersion"
      class="bible-version-card relative pb-4 mb-4 border-b border-gray-200 last:border-0 dark:border-gray-700 flex items-center justify-between gap-4"
    >
      <UProgress
        class="absolute inset-0 top-auto rounded-none opacity-0"
        :class="{
          'opacity-1': bibleVersionLoading === bibleVersion?.id,
        }"
        :value="parseInt(bibleDownloadProgress)"
        :max="100"
        size="xs"
      />
      <div class="col">
        <div class="text-md">{{ bibleVersion?.id }}</div>
        <div class="text-sm text-gray-400">
          {{ bibleVersion?.name }}
        </div>
      </div>
      <div class="col">
        <UButton
          :icon="bibleVersion?.isDownloaded ? 'i-bx-check' : 'i-bx-download'"
          color="primary"
          :variant="bibleVersion?.isDownloaded ? 'ghost' : 'outline'"
          :disabled="bibleVersion?.isDownloaded"
          @click="downloadBibleVersion(bibleVersion?.id)"
        >
          {{ bibleVersion?.isDownloaded ? "Saved" : "Save" }}
        </UButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
const appStore = useAppStore()
const db = useIndexedDB()

const bibleDownloadProgress = ref<string>("0")
const bibleVersion = ref(appStore.currentState.settings.defaultBibleVersion)
const bibleVersionLoading = ref<boolean | string>(false)
const { currentState } = storeToRefs(appStore)
const bibleVersionOptions = ref<Array<any>>(
  currentState.value.settings.bibleVersions
)
const bibleVersionSelectOptions = computed(() =>
  [
    ...currentState.value.settings.bibleVersions,
    currentState.value.settings.bibleVersions?.find(
      (version) => !version?.isDownloaded
    )
      ? {
          id: "+ More Versions",
          name: "Add more versions",
          isDownloaded: false,
        }
      : null,
  ]
    ?.filter((version) => version?.isDownloaded)
    ?.map((version) => version?.id)
)

const isBibleVersionDownloaded = async (bibleVersion: string) => {
  return (await db.bibleAndHymns.where("id").equals(bibleVersion).count()) > 0
}

const populateBibleVersionOptions = async () => {
  const tempBibleVersions = [...currentState.value.settings.bibleVersions]
  for (const bibleVersion of tempBibleVersions) {
    bibleVersion.isDownloaded = await isBibleVersionDownloaded(bibleVersion.id)
  }
  bibleVersionOptions.value = tempBibleVersions
}

const downloadBibleVersion = async (bibleVersion: string) => {
  const tempBibleVersion = (version: string, data: any) => ({
    id: version,
    data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  bibleVersionLoading.value = bibleVersion
  let bibleResponse = await useDetailedFetch(
    `https://d37gopmfkl2m2z.cloudfront.net/open/bible-versions/${bibleVersion?.toLowerCase()}.json`,
    bibleDownloadProgress
  )
  bibleResponse = await bibleResponse.json()
  await db.bibleAndHymns.add(tempBibleVersion(bibleVersion, bibleResponse))
  bibleVersionLoading.value = false
  populateBibleVersionOptions()
}

// Function Invocations
populateBibleVersionOptions()
</script>
