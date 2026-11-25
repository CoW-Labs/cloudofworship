<template>
  <div
    v-if="isEditorReady || boxMode"
    class="editor-floating-toolbar absolute z-10 top-[46px] left-2 right-2 flex"
    @mousedown.capture="onToolbarMouseDown"
  >
    <!-- The pill is the scroller, so a toolbar wider than the slide keeps its
         rounded ends and shadow and scrolls inside them. -->
    <div
      class="content-toolbar-pill relative mx-auto min-w-0 max-w-full bg-white dark:bg-[#171d2b] rounded-full shadow-lg ring-1 ring-gray-200/70 dark:ring-white/5"
    >
    <div
      ref="scrollStrip"
      class="cow-scroll-strip cow-scroll-strip--bare overflow-x-auto rounded-full"
    >
    <div
      class="relative flex w-max items-center gap-1 px-2 py-1 text-gray-600 dark:text-[#a7afbd]"
    >
      <CowTooltip text="Bold" shortcut="bold">
        <UButton
          @click="boxMode ? boxToggle('bold') : toggleBold()"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              isOn('bold'),
          }"
          variant="ghost"
          color="gray"
        >
          <BoldIcon class="w-4 h-4" />
        </UButton>
      </CowTooltip>
      <CowTooltip text="Italic" shortcut="italic">
        <UButton
          @click="boxMode ? boxToggle('italic') : runCommand((chain) => chain.toggleItalic())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              isOn('italic'),
          }"
          variant="ghost"
          color="gray"
        >
          <ItalicIcon class="w-4 h-4" />
        </UButton>
      </CowTooltip>
      <!-- <UButton
      @click="editor.chain().focus().toggleCode().run()"
      :disabled="!editor.can().chain().focus().toggleCode().run()"
      :class="{
        'bg-primary text-white dark:text-primary-900': isOn('code'),
      }"
      icon="i-bx-code"
      variant="ghost"
    /> -->
      <TipTapFontSizeSelect
        class="mx-1"
        :editor="editor"
        :value="boxMode ? selectedBox?.fontSizePercent ?? 100 : undefined"
        @change="onFontSizeChange"
      />
      <div
        class="button-group bg-gray-100 dark:bg-[#171d2b] rounded-full mx-1 p-1 flex items-center gap-1"
      >
        <CowTooltip text="Align left" shortcut="align-left">
          <UButton
            @click="boxMode ? patchBox({ alignment: 'left' }) : runCommand((chain) => chain.setTextAlign('left'))"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                isOn({ textAlign: 'left' }),
            }"
            variant="ghost"
            color="gray"
          >
            <AlignLeftIcon class="w-4 h-4" />
          </UButton>
        </CowTooltip>
        <CowTooltip text="Align centre" shortcut="align-center">
          <UButton
            @click="boxMode ? patchBox({ alignment: 'center' }) : runCommand((chain) => chain.setTextAlign('center'))"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                isOn({ textAlign: 'center' }),
            }"
            variant="ghost"
            color="gray"
          >
            <AlignCenterIcon class="w-4 h-4" />
          </UButton>
        </CowTooltip>
        <CowTooltip text="Align right" shortcut="align-right">
          <UButton
            @click="boxMode ? patchBox({ alignment: 'right' }) : runCommand((chain) => chain.setTextAlign('right'))"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                isOn({ textAlign: 'right' }),
            }"
            variant="ghost"
            color="gray"
          >
            <AlignRightIcon class="w-4 h-4" />
          </UButton>
        </CowTooltip>
      </div>
      <CowTooltip text="Font" :prevent="fontMenuOpen">
        <TipTapFontSelect
          :editor="editor!"
          :value="fontShown"
          size="md"
          :disabled="false"
          @change="onFontFamilyChange($event)"
          @open="onFontMenuOpen"
          @close="onFontMenuClose"
        />
      </CowTooltip>
      <UPopover
        v-model:open="colorPaletteOpen"
        mode="click"
        :popper="{ placement: 'bottom', strategy: 'fixed' }"
        :ui="{
          ring: 'ring-0',
          background: 'bg-transparent',
          shadow: 'shadow-xl',
        }"
        @update:open="onColorPaletteOpenChange"
      >
        <CowTooltip text="Text colour" :prevent="colorPaletteOpen">
          <button
            type="button"
            class="toolbar-color-btn"
            :aria-label="`Change text color, current color ${currentColor}`"
          >
            <span
              class="h-[15px] w-[15px] rounded-full ring-1 ring-black/15 dark:ring-white/25"
              :style="{ backgroundColor: currentColor }"
            ></span>
          </button>
        </CowTooltip>

        <template #panel>
          <BgColorSelection
            background-panel
            color-purpose="text"
            :colors="textColorPalette"
            :value="currentColor"
            @select="onColorChange($event.color)"
          />
        </template>
      </UPopover>
      <!-- TEXT BOXES: free-form text on the slide's canvas -->
      <div
        v-if="canvasAvailable"
        class="button-group bg-gray-100 dark:bg-[#171d2b] rounded-full mx-1 p-1 flex items-center gap-1"
      >
        <CowTooltip text="Add text box">
          <UButton
            @click="addTextBox"
            :disabled="!canvasCanAdd"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            icon="i-ph-textbox"
            aria-label="Add text box"
            variant="ghost"
            color="gray"
          />
        </CowTooltip>
        <CowTooltip v-if="canvasHasLayout" text="Reset text layout">
          <UButton
            @click="resetTextLayout"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            icon="i-ph-arrow-counter-clockwise"
            aria-label="Reset text layout"
            variant="ghost"
            color="gray"
          />
        </CowTooltip>
      </div>
      <!-- MORE: the less-used block formats -->
      <UPopover
        v-if="!boxMode"
        v-model:open="morePopoverOpen"
        mode="click"
        :popper="{ placement: 'bottom', strategy: 'fixed' }"
        :ui="{
          rounded: 'rounded-full',
          shadow: 'shadow-xl',
          container: 'z-50',
        }"
        @update:open="onMorePopoverOpenChange"
      >
        <CowTooltip text="More" :prevent="morePopoverOpen">
          <UButton
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                morePopoverOpen,
            }"
            icon="i-ph-dots-three-bold"
            aria-label="More formatting"
            variant="ghost"
            color="gray"
          />
        </CowTooltip>
        <template #panel>
          <div
            class="flex items-center gap-1 px-2 py-1 rounded-full overflow-hidden"
            @mousedown.prevent
          >
            <CowTooltip text="Strikethrough" shortcut="strike">
              <UButton
                @click="onMoreCommand(() => runCommand((chain) => chain.toggleStrike()))"
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
                :class="{
                  'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                    isOn('strike'),
                }"
                aria-label="Strikethrough"
                variant="ghost"
                color="gray"
              >
                <StrikethroughIcon class="w-4 h-4" />
              </UButton>
            </CowTooltip>
            <CowTooltip text="Normal text" shortcut="paragraph">
              <UButton
                @click="onMoreCommand(() => setParagraph())"
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
              :class="{
                'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                  isOn('paragraph'),
              }"
                icon="i-bx-paragraph"
                aria-label="Normal text"
                variant="ghost"
                color="gray"
              />
            </CowTooltip>
            <CowTooltip text="Bullet list" shortcut="bullet-list">
              <UButton
                @click="onMoreCommand(() => runCommand((chain) => chain.toggleBulletList()))"
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
              :class="{
                'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                  isOn('bulletList'),
              }"
                icon="i-bx-list-ul"
                aria-label="Bullet list"
                variant="ghost"
                color="gray"
              />
            </CowTooltip>
            <CowTooltip text="Numbered list" shortcut="ordered-list">
              <UButton
                @click="onMoreCommand(() => runCommand((chain) => chain.toggleOrderedList()))"
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
              :class="{
                'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                  isOn('orderedList'),
              }"
                icon="i-bx-list-ol"
                aria-label="Numbered list"
                variant="ghost"
                color="gray"
              />
            </CowTooltip>
            <CowTooltip text="Quote" shortcut="blockquote">
              <UButton
                @click="onMoreCommand(() => runCommand((chain) => chain.toggleBlockquote()))"
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
              :class="{
                'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                  isOn('blockquote'),
              }"
                icon="i-bx-bxs-quote-right"
                aria-label="Quote"
                variant="ghost"
                color="gray"
              />
            </CowTooltip>
            <CowTooltip text="Code block" shortcut="code-block">
              <UButton
                @click="onMoreCommand(() => runCommand((chain) => chain.toggleCodeBlock()))"
                class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
              :class="{
                'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                  isOn('codeBlock'),
              }"
                icon="i-bx-code-curly"
                aria-label="Code block"
                variant="ghost"
                color="gray"
              />
            </CowTooltip>
          </div>
        </template>
      </UPopover>
    </div>
    </div>
    <CowScrollFade
      :start="fadeStart"
      :end="fadeEnd"
      color="var(--cow-toolbar-pill-bg)"
      edge-class="rounded-full"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from "@tiptap/core"
import type { TextBox } from "~/types"
import { asFontFamily } from "~/utils/fontFamily"
import useScrollEdgeFade from "~/composables/useScrollEdgeFade"
import { useCanvasEditor } from "~/composables/useCanvasEditor"
import { textColorPalette } from "~/utils/textColors"

const props = defineProps<{
  editor?: Editor
  /** The slide being edited, so the toolbar can reach its text boxes. */
  slideId?: string
}>()

const {
  available: canvasAvailable,
  canAdd: canvasCanAdd,
  hasLayout: canvasHasLayout,
  add: addTextBox,
  reset: resetTextLayout,
  selected: selectedBox,
  patchSelected,
} = useCanvasEditor(() => props.slideId)

// A text box that holds its own words (a template's labels and headings) has
// no editor to type styles into, so while one is selected every control styles
// that box instead. A box that reads the slide's own text keeps its editor.
const boxMode = computed(() => selectedBox.value?.source === "custom")
const patchBox = (patch: Partial<TextBox>) => {
  patchSelected(patch)
}
// What the selected box draws, read from the page by the canvas, so a box
// that follows the slide or its template still shows its real look.
const shown = computed(() => selectedBox.value?.shown)
const boxToggle = (key: "bold" | "italic") =>
  patchBox({ [key]: !(shown.value?.[key] ?? selectedBox.value?.[key]) })
// The box an editor's words sit in, when it is selected and bold as a whole.
const slotBoxBold = computed(
  () =>
    !boxMode.value &&
    typeof selectedBox.value?.source === "number" &&
    selectedBox.value?.bold === true
)
const isOn = (name: string | Record<string, string>) => {
  if (boxMode.value) {
    const box = selectedBox.value
    if (name === "bold") return shown.value?.bold ?? !!box?.bold
    if (name === "italic") return shown.value?.italic ?? !!box?.italic
    if (typeof name === "object" && "textAlign" in name)
      return (box?.alignment ?? shown.value?.alignment ?? "left") === name.textAlign
    return false
  }
  if (name === "bold" && slotBoxBold.value) return true
  return !!props.editor?.isActive(name as never)
}

// Bold has to beat two things a template brings: a weight written on the
// words themselves (the thin half of a headline), and a box that is bold as a
// whole, which no mark inside it could undo. The first is cleared from the
// words Bold touches; the second moves into the words, so Bold can then turn
// it off wherever it is asked to.
const clearWeight = (chain: any) =>
  chain.setMark("textStyle", { fontWeight: null }).removeEmptyTextStyle()
const toggleBold = () => {
  const editor = props.editor
  if (!editor || !isEditorReady.value) return
  if (slotBoxBold.value) {
    const docSize = editor.state.doc.content.size
    const selection = savedSelection.value ?? editor.state.selection
    patchBox({ bold: undefined })
    runCommand((chain) =>
      clearWeight(
        chain
          .setTextSelection({ from: 0, to: docSize })
          .setBold()
          .setTextSelection({ from: selection.from, to: selection.to })
          .unsetBold()
      )
    )
    return
  }
  runCommand((chain) => clearWeight(chain.toggleBold()))
}

// The font the toolbar names: the box's, for a box with no editor; otherwise
// the one on the words at the caret, falling back to what the box draws.
const plainFont = (value?: string) =>
  value?.split(",")[0]?.trim().replace(/^["']|["']$/g, "") || undefined
const fontShown = computed(() => {
  if (boxMode.value) return selectedBox.value?.font ?? shown.value?.font
  const onWords = plainFont(
    props.editor?.getAttributes("textStyle")?.fontFamily as string | undefined
  )
  return onWords ?? selectedBox.value?.font ?? shown.value?.font
})

const scrollStrip = ref<HTMLElement | null>(null)
const { start: fadeStart, end: fadeEnd } = useScrollEdgeFade(scrollStrip)
const savedSelection = ref<{ from: number; to: number } | null>(null)
const colorPaletteOpen = ref(false)
const fontMenuOpen = ref(false)
const morePopoverOpen = ref(false)

const isEditorReady = computed(() => {
  const editor = props.editor
  if (!editor || editor.isDestroyed) return false

  try {
    return Boolean(editor.view?.dom)
  } catch {
    return false
  }
})

watch(
  () => props.editor,
  (editor) => {
    savedSelection.value = null
    if (!editor || editor.isDestroyed) return

    const { from, to } = editor.state.selection
    savedSelection.value = { from, to }
  },
  { immediate: true }
)

// Computed property for current text color
const currentColor = computed(() => {
  if (boxMode.value)
    return (selectedBox.value?.color || shown.value?.color || "#FFFFFF").toUpperCase()
  if (!isEditorReady.value) return "#FFFFFF"
  const color = props.editor?.getAttributes("textStyle").color || "#FFFFFF"
  return color.startsWith("#") ? color.toUpperCase() : color
})

const saveSelection = () => {
  const editor = props.editor
  if (!editor || !isEditorReady.value) return

  const { from, to } = editor.state.selection

  // Opening a dropdown can move DOM focus away from ProseMirror and collapse
  // its current selection. Keep the last real range so subsequent toolbar
  // changes continue to target the same highlighted text.
  if (
    !editor.isFocused &&
    from === to &&
    savedSelection.value?.from !== savedSelection.value?.to
  ) {
    return
  }

  savedSelection.value = { from, to }
}

const onToolbarMouseDown = (event: MouseEvent) => {
  saveSelection()

  const target = event.target as HTMLElement | null
  if (target?.closest('input, label, [role="listbox"], [role="option"]')) {
    return
  }

  // Keep the browser from moving focus to toolbar controls before TipTap runs
  // the command. Otherwise the editor falls back to its last caret position.
  event.preventDefault()
}

// Re-assert editor focus + the saved selection. Controls like the font
// dropdown hand focus back to their own trigger one frame *after* the command
// runs, which collapses the visible selection even though the mark was applied.
// Running this on the next frame wins that race so the edited text stays
// highlighted. It only re-focuses — it never blurs — so it triggers no save.
const reassertSelection = () => {
  const editor = props.editor
  // Focusing an editor would move the canvas selection off the selected box.
  if (boxMode.value || !editor || !isEditorReady.value) return

  const chain = editor.chain().focus()
  const selection = savedSelection.value
  if (selection) {
    const docSize = editor.state.doc.content.size
    const from = Math.min(Math.max(selection.from, 0), docSize)
    const to = Math.min(Math.max(selection.to, from), docSize)
    chain.setTextSelection({ from, to })
  }
  chain.run()
}

const onFontMenuOpen = () => {
  fontMenuOpen.value = true
}

const onFontMenuClose = () => {
  fontMenuOpen.value = false
  nextTick(() => requestAnimationFrame(reassertSelection))
}

const onColorPaletteOpenChange = (open: boolean) => {
  if (open) {
    saveSelection()
    return
  }

  onFontMenuClose()
}

const onMorePopoverOpenChange = (open: boolean) => {
  if (open) saveSelection()
}

// Run a command from the More popover, then close it.
const onMoreCommand = (run: () => void) => {
  run()
  morePopoverOpen.value = false
}

const runCommand = (
  apply: (chain: any) => any,
  options: { restoreFocus?: boolean } = {}
) => {
  const editor = props.editor
  if (!editor || !isEditorReady.value) return

  try {
    let chain = editor.chain().focus()
    const selection = savedSelection.value

    if (selection) {
      const docSize = editor.state.doc.content.size
      const from = Math.min(Math.max(selection.from, 0), docSize)
      const to = Math.min(Math.max(selection.to, from), docSize)
      chain = chain.setTextSelection({ from, to })
    }

    apply(chain).run()
    saveSelection()

    // Opt-in for controls that surrender focus to an async popover (font
    // dropdown). Plain buttons keep focus via the mousedown preventDefault, so
    // they don't need — or want — the extra frame.
    if (options.restoreFocus) {
      nextTick(() => {
        requestAnimationFrame(() => {
          reassertSelection()
          // Popover controls may move focus after their change event. A second
          // frame keeps the editor selection active after that final focus hop.
          requestAnimationFrame(reassertSelection)
        })
      })
    }
  } catch (error) {
    console.warn("[TipTap] Toolbar command skipped:", error)
  }
}

// Apply a palette color while preserving the selected editor range.
// The select forwards its raw change payload. Only a string may reach
// `setFontFamily` — see `asFontFamily` for what a stray object does to the
// editor.
const onFontFamilyChange = (value: unknown) => {
  const font = asFontFamily(value, "TipTapToolbar.font-select")
  if (!font) return
  if (boxMode.value) return patchBox({ font })
  runCommand((chain) => chain.setFontFamily(font), { restoreFocus: true })
}

const onColorChange = (color: string) => {
  if (boxMode.value) {
    patchBox({ color })
    colorPaletteOpen.value = false
    return
  }
  runCommand((chain) => chain.setColor(color), { restoreFocus: true })
  colorPaletteOpen.value = false
}

const DEFAULT_FONT_SIZE = 100

// Percent from the stepper, stored as `em` on the textStyle mark. 100% is the
// context's own size, so it unsets the mark rather than writing "1em".
//
// With nothing selected a size would only land on the *next* character typed,
// which reads as the button doing nothing. Applying it across the block the
// caret sits in matches what people expect from a slide editor; the caret is
// put back where it was so the collapse isn't visible.
const onFontSizeChange = (percent: number) => {
  if (boxMode.value) return patchBox({ fontSizePercent: percent })
  const editor = props.editor
  if (!editor || !isEditorReady.value) return

  const size = percent === DEFAULT_FONT_SIZE ? null : `${percent / 100}em`
  const selection = savedSelection.value ?? editor.state.selection
  const collapsed = selection.from === selection.to

  runCommand((chain) => {
    let blockRange: { from: number; to: number } | null = null

    if (collapsed) {
      const $pos = editor.state.doc.resolve(
        Math.min(Math.max(selection.from, 0), editor.state.doc.content.size)
      )
      // Depth 0 means the caret isn't inside a text block; expanding there
      // would restyle the whole document.
      if ($pos.depth > 0) {
        blockRange = { from: $pos.start(), to: $pos.end() }
        chain = chain.setTextSelection(blockRange)
      }
    }

    chain = size ? chain.setFontSize(size) : chain.unsetFontSize()

    return blockRange ? chain.setTextSelection(selection.from) : chain
  })
}

const setParagraph = () => {
  runCommand((chain) => chain.setParagraph())
}
</script>

<style scoped>
.toolbar-icon-btn {
  height: 34px;
  width: 34px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9999px;
}
.toolbar-color-btn {
  height: 26px;
  width: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9999px;
  background: rgb(243 244 246);
  transition: background-color 150ms ease;
}
.toolbar-color-btn:hover {
  background: rgb(229 231 235);
}
:global(html.dark) .toolbar-color-btn {
  background: #171d2b;
}
:global(html.dark) .toolbar-color-btn:hover {
  background: #2b3242;
}
</style>
