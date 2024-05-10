<template>
  <div class="select-menu-ctn w-[80px]">
    <USelectMenu
      class="absolute top-[14px] border-0 shadow-none max-w-[80px]"
      searchable
      searchable-placeholder="Search version"
      select-class="bg-white dark:bg-primary-800 border-3 shadow-none outline-none w-[16ch] text-center"
      size="xs"
      :options="bibleVersions"
      v-model="bibleVersion"
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
        width: 'min-w-[120px]',
        input: 'text-xs',
        empty: 'text-xs',
        option: {
          size: 'text-xs',
        },
      }"
      @change="$emit('change', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

const appStore = useAppStore()
const { settings } = storeToRefs(appStore)
const bibleVersion = ref<string>(settings.value.defaultBibleVersion)
</script>
