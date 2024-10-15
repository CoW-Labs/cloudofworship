<template>
  <div class="settings-ctn h-[100%]">
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
            <IconWrapper name="i-bx-font-family" size="4"> </IconWrapper>
            <span
              v-if="font?.length"
              class="truncate"
              :class="useURLFriendlyString(appStore.settings.defaultFont)"
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
                    appWideActions.openSettings,
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
          @click="$emit('select-active-tab', 'Bible Version Settings')"
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
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
const appStore = useAppStore()

const font = ref(appStore.settings.defaultFont)
const { bibleVersions } = storeToRefs(appStore)
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
const libraryTabs = [
  { label: "Still Background", icon: "i-bx-image" },
  { label: "Motion Background", icon: "i-bx-film" },
]
</script>
