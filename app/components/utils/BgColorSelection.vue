<template>
  <div
    v-if="backgroundPanel"
    ref="panelGrid"
    class="grid gap-[8.5px] rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
    :class="fill ? 'w-full justify-between' : 'h-[149.5px] w-[216.5px] grid-cols-6'"
    :style="
      fill ? { gridTemplateColumns: `repeat(${fillColumns}, ${SWATCH}px)` } : {}
    "
  >
    <button
      v-for="color in fill ? fillColors : panelColors"
      :key="color"
      type="button"
      class="h-[25px] w-[25px] rounded transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#E8D1F8]"
      :class="color === value ? 'ring-2 ring-[#E8D1F8]' : ''"
      :style="{ backgroundColor: color }"
      :aria-label="`Use ${color} as ${colorPurpose} colour`"
      :aria-pressed="color === value"
      @click="$emit('select', { color })"
    ></button>
  </div>
  <div
    v-else
    class="bg-image-selection p-2 gap-2 grid"
    :class="{
      'grid-cols-6': count === 6,
      'grid-cols-12': count === 12,
      'grid-cols-7': !count,
    }"
  >
    <UButton
      v-for="color in count === 6
        ? backgroundColors?.slice(0, 6)
        : backgroundColors"
      :key="color"
      @click="$emit('select', { color })"
      class="w-[40px] h-[40px] p-0 text-black bg-cover transition-all overflow-hidden relative rounded-md"
      :class="{ 'w-[34px] h-[34px]': count === 6 }"
    >
      <div
        class="bg-image min-w-[40px] h-[40px] transition rounded-md opacity-100 hover:border-2 border-primary-500 bg-cover"
        :class="{
          'border-2': color === value,
          'min-w-[34px] h-[34px]': count === 6,
        }"
        :style="`background-color: ${color}`"
      ></div>
      <IconWrapper
        v-if="color === value"
        name="i-bx-check"
        size="5"
        :rounded-bg="true"
        class="absolute text-primary-500 scale-50 bottom-2 right-2"
        :class="{ 'bottom-0 right-0': count === 6 }"
      />
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { useResizeObserver } from "@vueuse/core"

/**
 * `select` is a bubbling native DOM event name. Declared so a parent's
 * `@select` binds as a component event instead of *also* being attached to
 * this component's root element as a native listener — the fallthrough that
 * had the font menu delivering a DOM `Event` where a value was expected.
 */
defineEmits<{
  select: [payload: { color: string }]
}>()
const props = withDefaults(
  defineProps<{
    value?: string
    count?: number
    backgroundPanel?: boolean
    colors?: string[]
    colorPurpose?: string
    /**
     * With `backgroundPanel`: span the container's width and show as many
     * columns of swatches as fit, instead of the fixed six.
     */
    fill?: boolean
  }>(),
  {
    colorPurpose: "background",
  }
)

const backgroundPanelColors = [
  "#E8D1F8",
  "#FCEFD4",
  "#D1FADF",
  "#FEE4E2",
  "#D1E0FF",
  "#DDE1E8",
  "#818CF8",
  "#F6D08E",
  "#32D583",
  "#F97066",
  "#528BFF",
  "#3B4252",
  "#BD7AEA",
  "#EFAD3E",
  "#027A48",
  "#B42318",
  "#004EEB",
  "#131724",
  "#14B8A6",
  "#F79009",
  "#22D3EE",
  "#7209B7",
  "#2970FF",
  "#0D0F1A",
]

const panelColors = computed(() =>
  props.colors?.length ? props.colors : backgroundPanelColors
)

// ─── FILL: as many columns as the width allows ───────────────────────────────
// The panel's colours are a grid by column: each column a hue, its rows a pale
// tint, a mid tone, a deep tone and an accent. A wider grid adds columns from
// the right, so every row keeps its kind of colour.
const SWATCH = 25
const GAP = 8.5
const PADDING = 24
const ROWS = 4
const panelColumns = Array.from({ length: 6 }, (_, column) =>
  Array.from({ length: ROWS }, (_, row) => backgroundPanelColors[row * 6 + column]!)
)
const extraColumns = [
  ["#FCE7F6", "#F670C7", "#C11574", "#EE46BC"], // Pink
  ["#CCFBEF", "#2ED3B7", "#107569", "#15B79E"], // Teal
  ["#FFE6D5", "#FF9C66", "#E62E05", "#FB6514"], // Orange
  ["#FEF7C3", "#FDE272", "#CA8504", "#EAAA08"], // Yellow
  ["#E0F2FE", "#7CD4FD", "#0086C9", "#0BA5EC"], // Sky
  ["#E0EAFF", "#8098F9", "#3538CD", "#6172F3"], // Indigo
  ["#FFE4E8", "#FD6F8E", "#C01048", "#F63D68"], // Rose
  ["#ECFCCB", "#A3E635", "#4D7C0F", "#84CC16"], // Lime
  ["#F5EDE6", "#C4A484", "#7C4A2D", "#5C3A21"], // Brown
  ["#EEF2F6", "#9AA4B2", "#4B5565", "#202939"], // Slate
]
const allColumns = [...panelColumns, ...extraColumns]

const panelGrid = ref<HTMLElement | null>(null)
const fillColumns = ref(6)
useResizeObserver(panelGrid, ([entry]) => {
  if (!props.fill || !entry) return
  const inner = entry.contentRect.width
  fillColumns.value = Math.min(
    allColumns.length,
    Math.max(6, Math.floor((inner + GAP) / (SWATCH + GAP)))
  )
})

// Row by row, as the grid lays them out.
const fillColors = computed(() => {
  const columns = props.colors?.length ? null : allColumns.slice(0, fillColumns.value)
  if (!columns) return props.colors!
  return Array.from({ length: ROWS }, (_, row) =>
    columns.map((column) => column[row]!)
  ).flat()
})

const backgroundColors = [
  "#a855f7", // Purple
  "#3498db", // Blue
  "#d35400", // Dark Orange
  "#1abc9c", // Turquoise
  "#e74c3c", // Red
  "#34495e", // Dark Gray
  "#2ecc71", // Green
  "#e67e22", // Orange
  "#16a085", // Dark Green
  "#f1c40f", // Yellow
  "#e74c3c", // Dark Red
  "#2c3e50", // Gray
  "#2980b9", // Light Blue
  "#27ae60", // Dark Green
  "#8e44ad", // Dark Purple
  "#d35400", // Dark Orange
  "#f39c12", // Orange Yellow
]
</script>
