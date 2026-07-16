<template>
  <div
    class="select-menu-ctn"
    :class="size === 'lg' ? 'w-[170px]' : 'w-[140px]'"
  >
    <CowSelectMenu
      class="absolute top-[6px] border-0 shadow-none"
      :class="size === 'lg' ? 'top-[6px]' : 'top-[10px]'"
      searchable
      searchable-placeholder="Search fonts"
      :select-class="`h-10 border-0 shadow-none outline-none text-center rounded-full bg-gray-100 dark:bg-[#222938] dark:text-white ${
        size === 'lg' ? 'w-[170px]' : 'w-[140px]'
      }`"
      size="md"
      :options="fonts"
      v-model="font"
      variant="none"
      color="gray"
      clear-search-on-close
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
    </CowSelectMenu>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { appFonts } from "~/utils/constants"

const props = defineProps<{
  size: string
  selectedFont?: string
  disabled?: boolean
}>()

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const fonts = ref<string[]>(appFonts)
const font = ref<string>(props.selectedFont || "Inter")

watch(
  () => props.selectedFont,
  (newVal, _oldVal) => {
    if (newVal) {
      font.value = newVal
    }
  }
)
</script>
