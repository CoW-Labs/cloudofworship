<template>
  <UModal
    fullscreen
    v-model="settingsModalOpen"
    @close="$emit('close-modal')"
    :ui="{
      rounded: 'rounded-xl',
      fullscreen: 'w-[80vw] max-w-[900px] h-auto rounded-xl',
      // width: 'w-[1000px] sm:max-w-lg',
    }"
  >
    <AppSection
      heading="App Settings"
      class="border-0"
      heading-styles="text-lg font-semibold"
      :secondary-buttons="[
        {
          label: '',
          action: 'close-modal',
          icon: 'i-mdi-close',
          color: 'primary',
          confirmAction: false,
          visible: true,
          variant: 'ghost',
        },
      ]"
    >
      <div class="flex gap-2 w-[100%] h-[100%]">
        <div class="lhs min-w-[220px] flex flex-col gap-1 h-[100%]">
          <UButton
            v-for="tab in tabs"
            variant="ghost"
            block
            size="lg"
            class="justify-start text-black dark:text-white"
            :class="[
              {
                'text-white bg-primary-500 hover:bg-primary-500':
                  activeTab === tab.name,
              },
            ]"
            @click="activeTab = tab.name"
          >
            {{ tab?.name }}
          </UButton>
        </div>
        <div class="rhs w-[100%] rounded-lg p-6 pt-2 min-h-[600px]">
          <!-- SUB-SETTINGS HEADER -->
          <h3 class="font-semibold text-lg mb-4">
            {{ activeTab }}
          </h3>
          <Transition name="fade-sm">
            <!-- ACCOUNT SETTINGS -->
            <div
              class="settings-ctn h-[100%]"
              v-if="activeTab === 'Account Settings'"
            >
              <EmptyState
                icon="i-mdi-timer-sand-empty"
                sub="Nothing to see for now"
                action=""
                action-text=""
                class="pb-4"
              />
            </div>
            <!-- PROFILE SETTINGS -->
            <div
              class="settings-ctn h-[100%]"
              v-else-if="activeTab === 'Profile Settings'"
            >
              <EmptyState
                icon="i-mdi-timer-sand-empty"
                sub="Nothing to see for now"
                action=""
                action-text=""
                class="pb-4"
              />
            </div>
            <!-- SLIDE SETTINGS -->
            <div
              class="settings-ctn h-[100%]"
              v-else-if="activeTab === 'Slide Settings'"
            >
              <UForm>
                <UFormGroup label="Set default font">
                  <USelectMenu
                    class="border-0 shadow-none w-[200px]"
                    searchable
                    searchable-placeholder="Search fonts"
                    select-class="w-[200px] bg-primary-100 dark:bg-primary-800 dark:text-white"
                    size="md"
                    :options="appFonts"
                    :model-value="appStore.settings.defaultFont"
                    variant="none"
                    color="primary"
                    clear-search-on-close
                    :ui="selectUI"
                    :ui-menu="selectMenuUI"
                    @change="appStore.setDefaultFont($event)"
                  >
                    <template #label>
                      <IconWrapper name="i-bx-font-family" size="4">
                      </IconWrapper>
                      <span
                        v-if="font?.length"
                        class="truncate"
                        :class="
                          useURLFriendlyString(appStore.settings.defaultFont)
                        "
                        >{{ appStore.settings.defaultFont }}</span
                      >
                      <span v-else>Select font</span>
                    </template>
                    <template #option="{ option: font }">
                      <span
                        v-if="font?.length"
                        class="truncate"
                        :class="useURLFriendlyString(font)"
                        >{{ font }}</span
                      >
                      <span v-else>Select font</span>
                    </template>
                  </USelectMenu>
                </UFormGroup>
                <div class="flex items-end gap-4">
                  <UFormGroup label="Set default Bible Version" class="mt-4">
                    <USelectMenu
                      class="border-0 shadow-none max-w-[200px]"
                      searchable
                      searchable-placeholder="Search version"
                      select-class="w-[200px] bg-primary-100 dark:bg-primary-800 dark:text-white"
                      size="md"
                      :options="bibleVersionSelectOptions"
                      :model-value="appStore.settings.defaultBibleVersion"
                      variant="none"
                      color="primary"
                      clear-search-on-close
                      :ui="selectUI"
                      :ui-menu="selectMenuUI"
                      @change="
                        $event === '+ More Versions'
                          ? useGlobalEmit(
                              'open-settings',
                              'Bible Version Settings'
                            )
                          : appStore.setDefaultBibleVersion($event)
                      "
                    >
                    </USelectMenu>
                  </UFormGroup>
                  <UButton
                    size="md"
                    icon="i-bx-plus"
                    variant="outline"
                    @click="activeTab = 'Bible Version Settings'"
                  >
                    Add more
                  </UButton>
                </div>
                <UFormGroup label="Set default slide alignment" class="mt-4">
                  <USelectMenu
                    class="border-0 shadow-none max-w-[200px] capitalize"
                    select-class="w-[200px] bg-primary-100 dark:bg-primary-800 dark:text-white capitalize"
                    size="md"
                    :options="['left', 'center', 'right']"
                    :model-value="appStore.settings.slideStyles.alignment"
                    variant="none"
                    color="primary"
                    clear-search-on-close
                    :ui="selectUI"
                    :ui-menu="selectMenuUI"
                    @change="
                      appStore.setSlideStyles({
                        ...appStore.settings.slideStyles,
                        alignment: $event,
                      })
                    "
                  />
                </UFormGroup>
              </UForm>
            </div>
            <!-- BIBLE VERSION SETTINGS -->
            <div v-else-if="activeTab === 'Bible Version Settings'">
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
                    :icon="
                      bibleVersion?.isDownloaded
                        ? 'i-bx-check'
                        : 'i-bx-download'
                    "
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
            <!-- STORAGE SETTINGS -->
            <div
              class="settings-ctn h-[100%]"
              v-else-if="activeTab === 'Storage Settings'"
            >
              <EmptyState
                icon="i-mdi-timer-sand-empty"
                sub="Nothing to see for now"
                action=""
                action-text=""
                class="pb-4"
              />
            </div>
          </Transition>
        </div>
      </div>
    </AppSection>
  </UModal>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"

const props = defineProps<{
  isOpen: boolean
  page: string
}>()

const appStore = useAppStore()
const db = useIndexedDB()
const settingsModalOpen = ref(props.isOpen)
const tabs = [
  { name: "Account Settings", active: false },
  { name: "Profile Settings", active: false },
  { name: "Slide Settings", active: false },
  { name: "Bible Version Settings", active: false },
  { name: "Storage Settings", active: false },
]
const activeTab = ref(props.page || "Slide Settings")
const font = ref(appStore.settings.defaultFont)

const bibleDownloadProgress = ref<string>("0")
const bibleVersion = ref(appStore.settings.defaultBibleVersion)
const bibleVersionLoading = ref<boolean | string>(false)
const { bibleVersions } = storeToRefs(appStore)
console.log("bibleVersions", bibleVersions.value)
const bibleVersionOptions = ref<Array<any>>(bibleVersions.value)
const bibleVersionSelectOptions = computed(() =>
  [
    ...bibleVersions.value,
    bibleVersions.value?.find((version) => !version?.isDownloaded)
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
const libraryTabs = [
  { label: "Still Background", icon: "i-bx-image" },
  { label: "Motion Background", icon: "i-bx-film" },
]

const selectUI = {
  base: "bg-primary-500",
  input: "bg-primary-500",
  color: {
    primary: {
      outline: "shadow-sm bg-primary-500 ",
    },
  },
}
const selectMenuUI = {
  width: "w-[200px]",
  input: "text-xs",
  empty: "text-xs",
  option: {
    size: "text-xs",
  },
}

watch(
  () => props.isOpen,
  () => {
    settingsModalOpen.value = props.isOpen
    if (props.isOpen) {
      populateBibleVersionOptions()
      activeTab.value = props.page || "Slide Settings"
    }
  }
)

const isBibleVersionDownloaded = async (bibleVersion: string) => {
  return (await db.bibleAndHymns.where("id").equals(bibleVersion).count()) > 0
}

const populateBibleVersionOptions = async () => {
  const tempBibleVersions = [...bibleVersions.value]
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
  const bibleResponse = await useS3File(
    `${bibleVersion?.toLowerCase()}.json`,
    bibleDownloadProgress
  )
  await db.bibleAndHymns.add(tempBibleVersion(bibleVersion, bibleResponse))
  bibleVersionLoading.value = false
  populateBibleVersionOptions()
}
</script>
