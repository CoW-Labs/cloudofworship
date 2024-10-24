<template>
  <div class="select-menu-ctn w-[120px]">
    <USelectMenu
      class="border-0 shadow-none"
      searchable
      searchable-placeholder="Search fonts"
      select-class="border-3 shadow-none outline-none text-center text-primary-500 w-[120px] h-10 bg-primary-100 dark:bg-primary-900 dark:text-primary-400"
      size="md"
      :options="fonts"
      v-model="font"
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
        width: 'w-[140px]',
        input: 'text-xs',
        empty: 'text-xs',
        option: {
          size: 'text-xs',
        },
      }"
      :disabled="disabled"
      @change="$emit('change', $event)"
      @open="$emit('open')"
      @close="$emit('close')"
    >
      <template #label>
        <IconWrapper name="i-bx-font-family" size="4"> </IconWrapper>
        <span
          v-if="font?.length"
          v-show="!selectedFont"
          class="truncate"
          :class="useURLFriendlyString(font)"
          >{{ font }}</span
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
  </div>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { appFonts } from "~/utils/constants"

const props = defineProps<{
  size: string
  disabled: boolean
  editor: Object
}>()

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const fonts = ref<string[]>(appFonts)
const font = ref<string>("Inter")

// const emitter = useNuxtApp().$emitter as Emitter<any>
// watch(
//   () => props.editor,
//   () => {
//     console.log("hey")
//   }
// )

const selectedFont = computed(() => {
  appFonts.forEach((tempFont) => {
    const tempFontActive = props.editor?.isActive("textStyle", {
      fontFamily: tempFont,
    })
    if (tempFontActive) {
      font.value = tempFont
      return `${tempFont}`
    }
  })
})
</script>
