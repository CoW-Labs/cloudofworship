<template>
  <div class="select-menu-ctn w-[120px]">
    <CowSelectMenu
      class="absolute border-0 shadow-none top-[6px]"
      select-class="border-0 shadow-none outline-none text-center w-[120px] rounded-full bg-gray-100 dark:bg-[#222938] dark:text-white"
      size="md"
      :options="['1', '2', '3', '4', '5', '6']"
      v-model.number="lines"
      variant="none"
      color="gray"
      clear-search-on-close
      :ui-menu="{
        width: 'w-[120px]',
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
        <IconWrapper name="i-tabler-list-numbers" size="4"> </IconWrapper>
        <span v-if="lines" class="truncate"
          >{{ lines }} {{ lines > 1 ? "lines" : "line" }}</span
        >
        <span v-else class="truncate whitespace-nowrap">Lines per slide</span>
      </template>
      <template #option="{ option: lines }">
        <span v-if="lines" class="truncate" :class="useURLFriendlyString(lines)"
          >{{ lines }} {{ lines > 1 ? "lines" : "line" }}</span
        >
        <span v-else class="truncate whitespace-nowrap">Lines per slide</span>
      </template>
    </CowSelectMenu>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

const props = defineProps<{
  size?: string
  selectedLine?: number
  disabled?: boolean
}>()

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const lines = ref<number>(
  props.selectedLine ||
    currentState.value.settings.slideStyles.linesPerSlide ||
    4
)

watch(
  () => props.selectedLine,
  (newVal, _oldVal) => {
    if (newVal) {
      lines.value = newVal
    }
  }
)
</script>
