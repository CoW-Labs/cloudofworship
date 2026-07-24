<template>
  <div class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%]">
    <!-- Tabs -->
    <UTabs v-model="activeTab" :items="storageSettingsTabs" class="mb-4">
      <template #default="{ item }">
        <div class="flex items-center gap-2">
          <span>{{ item.label }}</span>
        </div>
      </template>
    </UTabs>

    <!-- Local Storage Tab -->
    <div v-if="activeTab === 0" class="flex flex-col gap-4">
      <div class="rounded-2xl bg-white dark:bg-[#131a27] p-4">
        <div class="header flex items-center justify-between gap-2">
          <div class="col flex items-center gap-2">
            <Icon name="i-lucide-hard-drive" class="w-7 h-7" />
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
        <div class="storage-chart flex rounded-full overflow-hidden my-3 w-full">
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
            <tr class="border-b border-gray-100 dark:border-white/5 h-[48px]">
              <td>
                <div class="flex items-center gap-2 text-sm">
                  <div
                    class="colored-circle rounded-full w-3 h-3 bg-primary-500"
                  ></div>
                  Background Videos and Images
                </div>
              </td>
              <td class="text-right text-sm">
                {{ formatMegabytes(cachedTableSize) }}
              </td>
            </tr>
            <tr class="border-b border-gray-100 dark:border-white/5 h-[48px]">
              <td>
                <div class="flex items-center gap-2 text-sm">
                  <div
                    class="colored-circle rounded-full w-3 h-3 bg-teal-500"
                  ></div>
                  Library Items
                </div>
              </td>
              <td class="text-right text-sm">
                {{ formatMegabytes(libraryTableSize) }}
              </td>
            </tr>
            <tr class="border-b border-gray-100 dark:border-white/5 h-[48px]">
              <td>
                <div class="flex items-center gap-2 text-sm">
                  <div
                    class="colored-circle rounded-full w-3 h-3 bg-cyan-500"
                  ></div>
                  Bible versions and hymns
                </div>
              </td>
              <td class="text-right text-sm">
                {{ formatMegabytes(bibleAndHymnsTableSize) }}
              </td>
            </tr>
            <tr
              class="h-[48px] cursor-pointer select-none"
              @click="mediaExpanded = !mediaExpanded"
            >
              <td>
                <div class="flex items-center gap-2 text-sm">
                  <div
                    class="colored-circle rounded-full w-3 h-3 bg-blue-500"
                  ></div>
                  Media Slides (Images, Videos, Audio)
                  <span
                    v-if="mediaGroups.length"
                    class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#222938] text-gray-500 dark:text-[#9aa3b2]"
                  >
                    {{ mediaGroups.length }}
                    {{ mediaGroups.length === 1 ? "file" : "files" }}
                  </span>
                </div>
              </td>
              <td class="text-right text-sm">
                <div class="flex justify-end gap-2 items-center">
                  {{ formatMegabytes(mediaTableSize) }}
                  <Icon
                    name="i-lucide-chevron-down"
                    class="w-4 h-4 transition-transform"
                    :class="mediaExpanded ? 'rotate-180' : ''"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Expandable per-file media list -->
        <div v-if="mediaExpanded" class="media-files pl-4 come-up-1">
          <div
            v-if="!mediaGroups.length"
            class="py-6 text-center text-sm text-gray-500 dark:text-[#9aa3b2]"
          >
            No media files stored on this device.
          </div>

          <div
            v-for="group in mediaGroups"
            :key="group.baseId"
            class="flex items-center gap-3 py-2 border-t border-gray-100 dark:border-white/5"
          >
            <div
              class="relative w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              :class="kindMeta[group.kind].class"
            >
              <Icon :name="kindMeta[group.kind].icon" class="w-5 h-5" />
              <span
                class="absolute bottom-0 inset-x-0 text-[7px] leading-3 font-bold text-center bg-black/30 rounded-b-xl"
              >
                {{ kindMeta[group.kind].label }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate">{{ group.name }}</p>
              <p class="text-xs text-gray-500 dark:text-[#9aa3b2]">
                {{ group.subtitle }}
              </p>
            </div>
            <span
              class="text-sm text-gray-500 dark:text-[#9aa3b2] whitespace-nowrap"
            >
              {{ formatMegabytes(group.sizeMB) }}
            </span>
            <button
              class="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-[#9aa3b2] dark:hover:bg-red-500/10"
              :aria-label="`Remove ${group.name}`"
              @click="deleteMediaGroup(group)"
            >
              <DeleteIcon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        class="danger-zone rounded-2xl bg-red-50 dark:bg-red-900/25 ring-1 ring-red-200 dark:ring-red-500/20 p-4"
      >
        <h3 class="font-semibold text-sm text-red-700 dark:text-red-200">
          Danger Zone
        </h3>
        <p class="text-xs mb-4 mt-2 text-red-700/80 dark:text-red-200/80">
          This is a danger zone. If you are not sure what you are doing, do not
          delete anything here. If you are sure, click the button below.
        </p>
        <CowInput
          v-if="deletePrompt"
          v-model="deletePromptText"
          label="Type 'intentionally deleting' to confirm"
          class="mb-4 come-up-1"
        />
        <CowButton
          variant="danger"
          block
          :disabled="
            deletePrompt ? deletePromptText !== 'intentionally deleting' : false
          "
          @click="deletePrompt ? deleteAllData() : (deletePrompt = true)"
        >
          <template #leading>
            <DeleteIcon class="w-4 h-4" />
          </template>
          Clear all data on this device
        </CowButton>
      </div>
    </div>

    <!-- Cloud Storage Tab -->
    <div v-else-if="activeTab === 1" class="flex flex-col gap-4">
      <div class="rounded-2xl bg-white dark:bg-[#131a27] p-4">
        <div class="header flex items-center justify-between gap-2">
          <div class="col flex items-center gap-2">
            <Icon name="i-lucide-cloud" class="w-7 h-7" />
            <h3 class="text-lg font-semibold">
              {{ formatMegabytes(cloudStorageUsed) }}
              <span class="text-sm font-normal"
                >of {{ formatMegabytes(maxCloudStorage) }} used in cloud</span
              >
            </h3>
          </div>
        </div>
        <div
          class="storage-chart flex rounded-full overflow-hidden my-3 w-full bg-gray-200 dark:bg-[#222938]"
          role="progressbar"
          aria-label="Cloud storage used"
          :aria-valuenow="cloudStoragePercentage"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="storage-chart-bar-inner h-[10px] transition-all"
            :class="cloudStorageOverage > 0 ? 'bg-red-500' : 'bg-primary-500'"
            :style="{ width: `${cloudStoragePercentage}%` }"
          ></div>
        </div>

        <p
          v-if="cloudStorageOverage > 0"
          class="mt-3 text-sm font-medium text-red-500"
        >
          {{ formatMegabytes(cloudStorageOverage) }} over your storage limit
        </p>

        <table class="table-auto w-full">
          <tbody>
            <tr class="border-b border-gray-100 dark:border-white/5 h-[48px]">
              <td>
                <div class="flex items-center gap-2 text-sm">
                  <div
                    class="colored-circle rounded-full w-3 h-3 bg-primary-500"
                  ></div>
                  Cloud Storage Used
                </div>
              </td>
              <td class="text-right text-sm">
                {{ formatMegabytes(cloudStorageUsed) }}
              </td>
            </tr>
            <tr class="h-[48px]">
              <td>
                <div class="flex items-center gap-2 text-sm">
                  <div
                    class="colored-circle rounded-full w-3 h-3 bg-gray-400"
                  ></div>
                  Available Storage
                </div>
              </td>
              <td class="text-right text-sm">
                {{ formatMegabytes(availableCloudStorage) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Media, Slide } from "~/types"
import { useOnline } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"
import { useAppStore } from "~/store/app"

const authStore = useAuthStore()
const appStore = useAppStore()
const { fetchChurch } = useChurch()
const online = useOnline()
const emitter = useNuxtApp().$emitter as any
const toast = useToast()
const db = useIndexedDB()
const loading = ref<boolean>(true)
const cachedTableSize = ref<number>(0)
const libraryTableSize = ref<number>(0)
const bibleAndHymnsTableSize = ref<number>(0)
const deletePrompt = ref<boolean>(false)
const deletePromptText = ref<string>("")
const activeTab = ref<number>(0)

watch(activeTab, async (tab) => {
  if (tab !== 1 || !online.value || !authStore.user?.churchId) return
  await fetchChurch(authStore.user.churchId, false)
})

// ── Per-file media visibility ──────────────────────────────────────────────
type MediaKind = "video" | "image" | "audio" | "presentation" | "other"

interface MediaGroup {
  baseId: string
  ids: string[]
  size: number // bytes
  sizeMB: number
  kind: MediaKind
  name: string
  subtitle: string
  slideExists: boolean
}

const kindMeta: Record<
  MediaKind,
  { icon: string; label: string; class: string }
> = {
  video: { icon: "i-lucide-play", label: "VIDEO", class: "bg-blue-500" },
  image: { icon: "i-lucide-image", label: "IMAGE", class: "bg-teal-500" },
  audio: {
    icon: "i-lucide-audio-lines",
    label: "AUDIO",
    class: "bg-emerald-500",
  },
  presentation: {
    icon: "i-lucide-presentation",
    label: "SLIDES",
    class: "bg-purple-500",
  },
  other: { icon: "i-lucide-file", label: "FILE", class: "bg-gray-500" },
}

const mediaGroups = ref<MediaGroup[]>([])
const mediaExpanded = ref<boolean>(false)
const removeAllMediaPrompt = ref<boolean>(false)

const mediaTableSize = computed(() =>
  mediaGroups.value.reduce((total, group) => total + group.sizeMB, 0)
)

const getMediaKind = (mime: string, pageCount: number): MediaKind => {
  if (pageCount > 1) return "presentation"
  if (mime.startsWith("video") || ["youtube", "vimeo"].includes(mime))
    return "video"
  if (mime.startsWith("image")) return "image"
  if (mime.startsWith("audio")) return "audio"
  return "other"
}

const getTypeLabel = (mime: string, name: string): string => {
  const ext = name?.split(".").pop()
  if (ext && ext !== name && ext.length <= 4) return ext.toUpperCase()
  const subtype = mime?.split("/")?.[1]
  return subtype ? subtype.toUpperCase() : "FILE"
}

const { getStorageLimit } = useSubscription()
const maxCloudStorage = computed(() => getStorageLimit())
const cloudStorageUsed = computed(() => {
  return Math.max(0, (authStore.church?.storageUsed || 0) / 1024 / 1024)
})
const availableCloudStorage = computed(() =>
  Math.max(0, maxCloudStorage.value - cloudStorageUsed.value)
)
const cloudStorageOverage = computed(() =>
  Math.max(0, cloudStorageUsed.value - maxCloudStorage.value)
)
const cloudStoragePercentage = computed(() => {
  if (maxCloudStorage.value <= 0) return 0

  return Math.min(
    100,
    Math.max(0, (cloudStorageUsed.value / maxCloudStorage.value) * 100)
  )
})

const storageSettingsTabs = [
  {
    label: "Local Files",
    icon: "i-lucide-hard-drive",
  },
  {
    label: "Cloud Files",
    icon: "i-lucide-cloud",
  },
]

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
    return `${(sizeInMegabytes / 1024).toFixed(2)} GB`
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

const loadMediaFiles = async () => {
  const slideMap = new Map<string, Slide>(
    appStore.currentState.activeSlides
      ?.filter((slide) => slide?.id)
      .map((slide) => [slide.id, slide])
  )
  const groups = new Map<
    string,
    { ids: string[]; size: number; mime: string }
  >()

  await safeDBOperation((database) =>
    database.media.each((item: Media) => {
      const id = item.id
      const baseId = id.includes("-page-") ? id.split("-page-")[0] : id
      const size =
        (item?.data as ArrayBuffer)?.byteLength || item?.content?.size || 0

      let group = groups.get(baseId)
      if (!group) {
        group = { ids: [], size: 0, mime: item?.content?.type || "" }
        groups.set(baseId, group)
      }
      group.ids.push(id)
      group.size += size
    })
  )

  mediaGroups.value = Array.from(groups.entries())
    .map(([baseId, group]) => {
      const slide = slideMap.get(baseId)
      const kind = getMediaKind(group.mime, group.ids.length)
      const name =
        slide?.name ||
        (slide?.data as any)?.name ||
        `Media ${baseId.slice(0, 6)}`
      const sizeMB = group.size / 1024 / 1024
      const subtitle =
        kind === "presentation"
          ? `Presentation · ${group.ids.length} pages`
          : getTypeLabel(group.mime, name) + (slide ? "" : " · unused")

      return {
        baseId,
        ids: group.ids,
        size: group.size,
        sizeMB,
        kind,
        name,
        subtitle,
        slideExists: !!slide,
      }
    })
    .sort((a, b) => b.size - a.size)
}

const deleteMediaGroup = async (group: MediaGroup) => {
  mediaGroups.value = mediaGroups.value.filter(
    (item) => item.baseId !== group.baseId
  )

  if (group.slideExists) {
    // Reuse full slide-deletion flow (API + socket broadcast + DB cleanup,
    // respecting any copy saved in the Library).
    emitter.emit("delete-slide", { id: group.baseId })
  } else {
    // Orphaned media record with no owning slide — free it directly.
    for (const id of group.ids) {
      await safeDBOperation((database) => database.media.delete(id))
    }
  }

  toast.add({ title: `${group.name} removed`, icon: "i-tabler-trash" })
}

const removeAllMedia = async () => {
  const groups = [...mediaGroups.value]
  mediaGroups.value = []
  removeAllMediaPrompt.value = false

  for (const group of groups) {
    if (group.slideExists) {
      emitter.emit("delete-slide", { id: group.baseId })
    } else {
      for (const id of group.ids) {
        await safeDBOperation((database) => database.media.delete(id))
      }
    }
  }

  toast.add({ title: "All media files removed", icon: "i-tabler-trash" })
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

  await db.delete()
  deletePrompt.value = false
  deletePromptText.value = ""
  loading.value = false
}

onMounted(async () => {
  loading.value = true
  await loadMediaFiles()
  await calculateBackgroundVideosAndImagesTableSize()
  await calculateLibraryTableSize()
  await calculateBibleAndHymnsTableSize()
  loading.value = false
})
</script>

<style scoped></style>
