<template>
  <div class="h-[100%] overflow-y-auto mb-[2.5%] p-1 flex flex-col gap-8">
    <SettingsGroup
      title="Default Bible Version"
      note="Cloud of Worship does not own any Bible versions. All translations are graciously provided by open source repositories and are free to use without a Teams subscription."
    >
      <SettingsRow label="Default Bible version">
        <SettingsSelect
          searchable
          searchable-placeholder="Search version"
          :options="
            bibleVersionOptions
              ?.filter((version) => version.isDownloaded)
              .map((version) => version.id)
          "
          :model-value="appStore.currentState.settings.defaultBibleVersion"
          @focus="populateBibleVersionOptions()"
          @change="appStore.setDefaultBibleVersion($event)"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup
      title="Available Versions"
      note="Saved versions work offline on this device."
    >
      <template #actions>
        <UInput
          v-model="versionSearch"
          placeholder="Search versions"
          size="sm"
          class="w-48 cow-search-input"
          input-class="!rounded-xl"
          aria-label="Search Bible versions"
        >
          <template #leading>
            <SearchIcon class="w-4 h-4 text-gray-400 dark:text-[#9aa3b2]" />
          </template>
        </UInput>
      </template>

      <p
        v-if="versionSearch.trim() && !filteredBibleVersions.length"
        class="px-1 py-3 text-xs text-gray-500 dark:text-[#9aa3b2]"
      >
        No versions match “{{ versionSearch.trim() }}”.
      </p>
      <div
        v-for="bibleVersion in filteredBibleVersions"
        :key="bibleVersion?.id"
        class="bible-version-card relative overflow-hidden rounded-2xl bg-white dark:bg-[#131a27] px-4 py-3 flex items-center justify-between gap-4"
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
        <div class="col min-w-0">
          <div class="text-sm font-semibold text-gray-800 dark:text-white">
            {{ bibleVersion?.id }}
          </div>
          <div class="text-xs text-gray-500 dark:text-[#9aa3b2] truncate">
            {{ bibleVersion?.name }}
          </div>
        </div>
        <CowButton
          :variant="bibleVersion?.isDownloaded ? 'secondary' : 'primary'"
          size="2xs"
          class="!px-3.5 !py-1.5 text-xs shrink-0"
          :disabled="bibleVersion?.isDownloaded"
          :loading="bibleVersionLoading === bibleVersion?.id"
          @click="downloadBibleVersion(bibleVersion?.id)"
        >
          {{ bibleVersion?.isDownloaded ? "Saved" : "Save" }}
        </CowButton>
      </div>
    </SettingsGroup>

    <SettingsGroup
      title="Default Bible Theme"
      note="Every new Bible slide is created with this theme. Slides already in a schedule keep the theme they were made with — change those from the slide's theme menu."
    >
      <BibleThemeSelection
        embedded
        :value="appStore.currentState.settings.slideStyles.theme"
        @select="
          appStore.setSlideStyles({
            ...appStore.currentState.settings.slideStyles,
            theme: $event,
          })
        "
      />
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
const appStore = useAppStore()

const {
  bibleVersionOptions,
  downloadProgress: bibleDownloadProgress,
  bibleVersionLoading,
  downloadBibleVersion,
  populateBibleVersionOptions,
} = useBibleVersionManager()

populateBibleVersionOptions()

// Matches the abbreviation or the full name, so "yoruba", "ybcv" and
// "reina" all find their version
const versionSearch = ref("")
const filteredBibleVersions = computed(() => {
  const query = versionSearch.value.trim().toLowerCase()
  if (!query) return bibleVersionOptions.value ?? []
  return (bibleVersionOptions.value ?? []).filter(
    (version) =>
      version?.id?.toLowerCase().includes(query) ||
      version?.name?.toLowerCase().includes(query)
  )
})
</script>
