<template>
  <div
    class="select-menu-ctn"
    :class="size === 'lg' ? 'w-[170px]' : 'w-[140px]'"
  >
    <USelectMenu
      class="absolute top-[6px] border-0 shadow-none"
      :class="size === 'lg' ? 'top-[6px]' : 'top-[10px]'"
      searchable
      searchable-placeholder="Search fonts"
      :select-class="`border-3 shadow-none outline-none text-center ${
        size === 'lg'
          ? 'w-[170px] bg-primary-100 dark:bg-primary-800'
          : 'w-[140px] bg-primary-200 dark:bg-primary-900 dark:text-white'
      }`"
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
        width: size === 'lg' ? 'w-[170px]' : 'w-[140px]',
        input: 'text-xs',
        empty: 'text-xs',
        option: {
          size: 'text-xs',
        },
      }"
      :disabled="disabled"
      @open="$emit('open')"
      @close="$emit('close')"
      @change="$emit('change', $event)"
    >
      <template #label>
        <IconWrapper name="i-bx-font-family" size="4"> </IconWrapper>
        <span
          v-if="font?.length"
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
import { useAppStore } from "~/store/app"
import { appFonts } from "~/utils/constants"

const props = defineProps<{
  size: string
  selectedFont: string
  disabled: boolean
}>()

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const fonts = ref<string[]>(appFonts)
const font = ref<string>(props.selectedFont || "Inter")

watch(
  () => props.selectedFont,
  (newVal, _oldVal) => {
    font.value = newVal
  }
)
</script>
