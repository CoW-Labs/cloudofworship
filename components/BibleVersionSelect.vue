<template>
  <div class="select-menu-ctn w-[80px]">
    <USelectMenu
      class="absolute border-0 shadow-none max-w-[80px] pr-1"
      searchable
      searchable-placeholder="Search version"
      select-class="bg-white dark:bg-primary-800 border-3 shadow-none outline-none w-[16ch] text-center"
      size="xs"
      :options="bibleVersionOptions"
      :model-value="bibleVersion"
      variant="none"
      color="primary"
      clear-search-on-close
      :ui="{
        base: 'bg-primary-500',
        input: 'bg-primary-500',
        color: {
          primary: {
            outline: 'shadow-sm bg-primary-500 ',
          },
        },
      }"
      :ui-menu="{
        width: 'min-w-[140px]',
        input: 'text-xs',
        empty: 'text-xs',
        option: {
          size: 'text-xs',
        },
      }"
      @open="$emit('open')"
      @close="$emit('close')"
      @change="
        $event === '+ More Versions'
          ? useGlobalEmit(appWideActions.openSettings, 'Bible Version Settings')
          : (bibleVersion = $event)
      "
    >
      <template #option="{ option: version }">
        <span v-if="version === '+ More Versions'" class="pb-5">
          <UButton
            size="xs"
            class="w-full h-[30px] whitespace-nowrap absolute bottom-0 right-0 left-0"
            @click="useGlobalEmit(appWideActions.openSettings, 'bible-version')"
          >
            <IconWrapper name="i-bx-plus" size="4" /> Add more
          </UButton>
        </span>
        <span v-else class="truncate">{{ version }}</span>
      </template>
    </USelectMenu>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { appWideActions } from "~/utils/constants"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const bibleVersion = ref<string>(
  currentState.value.settings.defaultBibleVersion
)
const emit = defineEmits(["change"])
const bibleVersionOptions = computed(() =>
  [
    ...currentState.value.settings.bibleVersions,
    currentState.value.settings.bibleVersions?.find(
      (version) => !version?.isDownloaded
    )
      ? { id: "+ More Versions", name: "Add more versions", isDownloaded: true }
      : null,
  ]
    ?.filter((version) => version?.isDownloaded)
    ?.map((version) => version?.id)
)

watch(bibleVersion, (newValue, oldValue) => {
  if (newValue === "+ More Versions") {
    useGlobalEmit(appWideActions.openSettings, "Bible Version Settings")
    bibleVersion.value = oldValue
  }
  emit("change", newValue)
})
</script>
