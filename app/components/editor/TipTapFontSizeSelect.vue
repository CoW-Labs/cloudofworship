<template>
  <div
    class="button-group flex items-center gap-1 rounded-full bg-gray-100 p-1 dark:bg-[#222938]"
  >
    <CowTooltip
      text="Decrease font size"
      :shortcut="shortcutIds.fontSizeDecrease"
    >
      <UButton
        :disabled="fontSize <= MIN_FONT_SIZE"
        @click="decrease"
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full p-0 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-[#a7afbd] dark:hover:bg-[#2b3242] dark:hover:text-[#d5dae3]"
        variant="ghost"
        color="gray"
      >
        <MinusIcon class="h-4 w-4" />
      </UButton>
    </CowTooltip>
    <div class="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
    <UInput
      v-model="fontSize"
      disabled
      size="xs"
      variant="none"
      class="w-[5ch]"
      inputClass="bg-transparent border-0 shadow-none outline-none px-0 text-center text-gray-800 dark:text-white font-medium tabular-nums"
    />
    <div class="w-px h-4 bg-gray-200 dark:bg-white/10"></div>
    <CowTooltip
      text="Increase font size"
      :shortcut="shortcutIds.fontSizeIncrease"
    >
      <UButton
        :disabled="fontSize >= MAX_FONT_SIZE"
        @click="increase"
        class="grid h-8 w-8 shrink-0 place-items-center rounded-full p-0 text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-[#a7afbd] dark:hover:bg-[#2b3242] dark:hover:text-[#d5dae3]"
        variant="ghost"
        color="gray"
      >
        <PlusIcon class="h-4 w-4" />
      </UButton>
    </CowTooltip>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from "@tiptap/core"

// The stepper reads as a percentage, the same unit the slide-level
// FontSizeSelect uses. The range is wider here because it replaces the old
// H1/H2/H3 buttons: an H1 rendered at twice the paragraph size, so 100% has to
// be able to reach that and beyond.
const MIN_FONT_SIZE = 25
const MAX_FONT_SIZE = 400
const FONT_SIZE_STEP = 10
const DEFAULT_FONT_SIZE = 100

const props = defineProps<{
  editor?: Editor
}>()

const emit = defineEmits<{
  (e: "change", value: number): void
}>()

const fontSize = ref<number>(DEFAULT_FONT_SIZE)

const clampFontSize = (value: number) =>
  Math.min(Math.max(value, MIN_FONT_SIZE), MAX_FONT_SIZE)

// Sizes are stored as `em` rather than `px` so a single value renders
// correctly everywhere: the editor sets its base size in rem, the projector in
// cqw and the schedule thumbnails in vw. Anything with another unit is
// something we didn't write — fall back to 100% rather than mangling it.
const readFontSize = () => {
  const editor = props.editor
  if (!editor || editor.isDestroyed) return DEFAULT_FONT_SIZE

  try {
    const raw = editor.getAttributes("textStyle")?.fontSize as
      | string
      | undefined
    if (!raw?.trim().endsWith("em")) return DEFAULT_FONT_SIZE

    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FONT_SIZE

    return clampFontSize(Math.round(parsed * 100))
  } catch {
    return DEFAULT_FONT_SIZE
  }
}

const syncFromEditor = () => {
  fontSize.value = readFontSize()
}

// Every doc or selection change goes through `transaction`, so one listener
// keeps the readout on whatever the caret currently sits in.
let detachListener: (() => void) | null = null

watch(
  () => props.editor,
  (editor) => {
    detachListener?.()
    detachListener = null
    syncFromEditor()

    if (!editor || editor.isDestroyed) return

    editor.on("transaction", syncFromEditor)
    detachListener = () => editor.off("transaction", syncFromEditor)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  detachListener?.()
  detachListener = null
})

const decrease = () => {
  if (fontSize.value <= MIN_FONT_SIZE) return
  fontSize.value = clampFontSize(fontSize.value - FONT_SIZE_STEP)
  emit("change", fontSize.value)
}

const increase = () => {
  if (fontSize.value >= MAX_FONT_SIZE) return
  fontSize.value = clampFontSize(fontSize.value + FONT_SIZE_STEP)
  emit("change", fontSize.value)
}

// Same Cmd/Ctrl+Shift+> / +< pair the slide toolbar binds. Only one of the two
// toolbars is ever mounted, so there is no contention over the combo.
const shortcutCleanups: Array<() => void> = []

onMounted(() => {
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.fontSizeIncrease, () => {
      if (fontSize.value >= MAX_FONT_SIZE) return false
      increase()
      return true
    })
  )
  shortcutCleanups.push(
    useRegisteredShortcut(shortcutIds.fontSizeDecrease, () => {
      if (fontSize.value <= MIN_FONT_SIZE) return false
      decrease()
      return true
    })
  )
})

onBeforeUnmount(() => {
  shortcutCleanups.splice(0).forEach((cleanup) => cleanup())
})
</script>
