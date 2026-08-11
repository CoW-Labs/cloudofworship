<template>
  <div class="select-menu-ctn w-[100px] shrink-0">
    <CowSelectMenu
      class="w-full max-w-full border-0 shadow-none"
      searchable
      searchable-placeholder="Search name or abbreviation"
      select-class="h-[34px] w-full min-w-0 overflow-hidden bg-white dark:bg-[#171d2b] border-0 shadow-none outline-none rounded-full font-semibold text-gray-900 dark:text-white text-left pl-3 justify-between"
      size="xs"
      :options="bibleVersionSelectOptions"
      :model-value="bibleVersion"
      variant="none"
      color="gray"
      clear-search-on-close
      :ui="{
        trailing: { padding: { xs: '' } },
        icon: {
          trailing: {
            wrapper: 'bible-version-trailing flex items-center gap-1',
          },
        },
      }"
      :ui-menu="{
        container: 'bible-version-menu',
        width: 'min-w-[280px]',
        input: 'text-sm',
        empty: 'text-xs',
        option: {
          size: 'text-sm',
          padding: 'px-3 py-2.5',
        },
      }"
      @open="onOpen"
      @close="$emit('close')"
      @change="
        $event === '+ More Versions'
          ? useGlobalEmit(appWideActions.openSettings, 'Bible Slide Settings')
          : (bibleVersion = $event)
      "
    >
      <template #trailing>
        <div class="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
        <IconWrapper
          name="i-bx-chevron-down"
          size="5"
          class="text-gray-500 dark:text-[#a7afbd]"
        />
      </template>
      <template #option="{ option: version }">
        <span
          v-if="version === '+ More Versions'"
          class="text-primary-500 dark:text-primary-400 font-medium"
        >
          Add More
        </span>
        <span v-else class="truncate">{{ versionLabel(version) }}</span>
      </template>
    </CowSelectMenu>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { appWideActions } from "~/utils/constants"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const props = defineProps({
  bibleVersionInherited: {
    type: String,
    default: "",
  },
})

const bibleVersion = ref<string>(
  props.bibleVersionInherited || currentState.value.settings.defaultBibleVersion
)
const emit = defineEmits(["change", "open", "close"])

const {
  bibleVersionSelectOptions,
  bibleVersionOptions,
  populateBibleVersionOptions,
} = useBibleVersionManager()

// Display the full version name with its abbreviation, e.g. "King James Version (KJV)".
// Falls back to the raw id when no matching name is known.
const versionLabel = (id: string) => {
  const name =
    bibleVersionOptions.value.find((v) => v.id === id)?.name ||
    bibleVersionObjects.find((v) => v.id === id)?.name
  return name ? `${name} (${id})` : id
}

const onOpen = async () => {
  await populateBibleVersionOptions()
  emit("open")
}

onMounted(() => {
  populateBibleVersionOptions()
})

watch(
  () => props.bibleVersionInherited,
  () => {
    bibleVersion.value = props.bibleVersionInherited
  }
)

watch(bibleVersion, (newValue, oldValue) => {
  if (newValue === "+ More Versions") {
    useGlobalEmit(appWideActions.openSettings, "Bible Slide Settings")
    bibleVersion.value = oldValue
  }
  emit("change", newValue)
})
</script>

<style>
/* Deliberately global + !important: Nuxt UI's config-merge always tail-merges
   the library's own "absolute inset-y-0 end-0" default for icon.trailing.wrapper
   in AFTER any :ui override (see node_modules/@nuxt/ui/dist/runtime/utils/index.js
   defuTwMerge — it runs the override and the library default through
   tailwind-merge with the library default passed last, so its position utility
   always wins). There is no way to turn that off via the :ui prop, so the
   divider+chevron end up absolutely positioned over the label text instead of
   flowing after it. Forcing position:static here is the only reliable fix. */
.bible-version-trailing {
  position: static !important;
  padding-right: 0 !important;
}

/* Same tail-merge problem as above: uiMenu.container's library default is
   "z-20 group", and any z-* we pass through :ui-menu loses to it in twMerge.
   The dropdown lives in the editor toolbar row, whose sibling
   SlideContentToolbar pill is z-30 — so at z-20 the menu paints underneath it.
   Only the (non-conflicting) class name survives the merge, so the z-index has
   to be applied here. */
.bible-version-menu {
  z-index: 40 !important;
}
</style>
