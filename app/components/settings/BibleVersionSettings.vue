<template>
  <div class="h-[100%] overflow-y-auto mb-[2.5%]">
    <div class="mb-4">
      <p class="text-xs opacity-50">
        Cloud of Worship does not own any Bible versions. All translations are
        graciously provided by open source repositories and are free to use
        without a Teams subscription.
      </p>
    </div>
    <!-- BIBLE SLIDES -->
    <div class="settings-group border-gray-200 dark:border-gray-800 mb-6">
      <UForm :state="{}">
        <UFormGroup
          label="Set default Bible Version"
          class="flex items-center w-full justify-between py-1 px-0 hover:bg-primary/10"
        >
          <USelectMenu
            class="border-0 shadow-none max-w-[200px]"
            searchable
            searchable-placeholder="Search version"
            select-class="w-[200px] bg-gray-100 dark:bg-gray-800 dark:text-white"
            size="md"
            :options="
              bibleVersionOptions
                ?.filter((version) => version.isDownloaded)
                .map((version) => version.id)
            "
            :model-value="appStore.currentState.settings.defaultBibleVersion"
            variant="none"
            color="primary"
            clear-search-on-close
            :ui="selectUI"
            :ui-menu="selectMenuUI"
            @focus="populateBibleVersionOptions()"
            @change="appStore.setDefaultBibleVersion($event)"
          />
        </UFormGroup>
      </UForm>
    </div>
    <UDivider class="mb-6" />
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

const {
  bibleVersionOptions,
  downloadProgress: bibleDownloadProgress,
  bibleVersionLoading,
  downloadBibleVersion,
  populateBibleVersionOptions,
} = useBibleVersionManager()

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

populateBibleVersionOptions()
</script>
