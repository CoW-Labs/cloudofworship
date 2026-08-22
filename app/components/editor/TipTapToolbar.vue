<template>
  <div
    v-if="isEditorReady"
    class="absolute z-10 top-[46px] left-2 right-2 flex"
    :class="containerOverflow"
    @mousedown.capture="onToolbarMouseDown"
  >
    <div
      class="content-toolbar-pill mx-auto shrink-0 flex items-center gap-1 bg-white dark:bg-[#171d2b] rounded-full shadow-lg ring-1 ring-gray-200/70 dark:ring-white/5 px-2 py-1 text-gray-600 dark:text-[#a7afbd]"
    >
      <CowTooltip text="Bold" shortcut="bold">
        <UButton
          @click="runCommand((chain) => chain.toggleBold())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('bold'),
          }"
          variant="ghost"
          color="gray"
        >
          <BoldIcon class="w-4 h-4" />
        </UButton>
      </CowTooltip>
      <CowTooltip text="Italic" shortcut="italic">
        <UButton
          @click="runCommand((chain) => chain.toggleItalic())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('italic'),
          }"
          variant="ghost"
          color="gray"
        >
          <ItalicIcon class="w-4 h-4" />
        </UButton>
      </CowTooltip>
      <CowTooltip text="Strikethrough" shortcut="strike">
        <UButton
          @click="runCommand((chain) => chain.toggleStrike())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('strike'),
          }"
          variant="ghost"
          color="gray"
        >
          <StrikethroughIcon class="w-4 h-4" />
        </UButton>
      </CowTooltip>
      <!-- <UButton
      @click="editor.chain().focus().toggleCode().run()"
      :disabled="!editor.can().chain().focus().toggleCode().run()"
      :class="{
        'bg-primary text-white dark:text-primary-900': editor.isActive('code'),
      }"
      icon="i-bx-code"
      variant="ghost"
    /> -->
      <div
        class="button-group bg-gray-100 dark:bg-[#171d2b] rounded-full mx-1 p-1 flex items-center gap-1"
      >
        <CowTooltip
          v-for="headingSize in 3"
          :key="`heading-size-${headingSize}`"
          :text="`Heading ${headingSize}`"
          :shortcut="`heading-${headingSize}`"
        >
          <UButton
            @click="toggleHeading(headingSize)"
            class="rounded-full gap-0 items-end text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                editor.isActive('heading', { level: headingSize }),
            }"
            variant="ghost"
            color="gray"
          >
            H<span class="text-xs">{{ headingSize }}</span>
          </UButton>
        </CowTooltip>
      </div>
      <CowTooltip text="Normal text" shortcut="paragraph">
        <UButton
          @click="setParagraph()"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('paragraph'),
          }"
          icon="i-bx-paragraph"
          variant="ghost"
          color="gray"
        />
      </CowTooltip>
      <CowTooltip text="Bullet list" shortcut="bullet-list">
        <UButton
          @click="runCommand((chain) => chain.toggleBulletList())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('bulletList'),
          }"
          icon="i-bx-list-ul"
          variant="ghost"
          color="gray"
        />
      </CowTooltip>
      <CowTooltip text="Numbered list" shortcut="ordered-list">
        <UButton
          @click="runCommand((chain) => chain.toggleOrderedList())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('orderedList'),
          }"
          icon="i-bx-list-ol"
          variant="ghost"
          color="gray"
        />
      </CowTooltip>
      <div
        class="button-group bg-gray-100 dark:bg-[#171d2b] rounded-full mx-1 p-1 flex items-center gap-1"
      >
        <CowTooltip text="Align left" shortcut="align-left">
          <UButton
            @click="runCommand((chain) => chain.setTextAlign('left'))"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                editor.isActive({ textAlign: 'left' }),
            }"
            variant="ghost"
            color="gray"
          >
            <AlignLeftIcon class="w-4 h-4" />
          </UButton>
        </CowTooltip>
        <CowTooltip text="Align centre" shortcut="align-center">
          <UButton
            @click="runCommand((chain) => chain.setTextAlign('center'))"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                editor.isActive({ textAlign: 'center' }),
            }"
            variant="ghost"
            color="gray"
          >
            <AlignCenterIcon class="w-4 h-4" />
          </UButton>
        </CowTooltip>
        <CowTooltip text="Align right" shortcut="align-right">
          <UButton
            @click="runCommand((chain) => chain.setTextAlign('right'))"
            class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-200 dark:hover:bg-[#2b3242]"
            :class="{
              'bg-gray-200 dark:bg-[#2b3242] text-gray-900 dark:text-white':
                editor.isActive({ textAlign: 'right' }),
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
          :editor="editor"
          size="md"
          :disabled="false"
          @change="
            runCommand((chain) => chain.setFontFamily($event), {
              restoreFocus: true,
            })
          "
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
      <CowTooltip text="Quote" shortcut="blockquote">
        <UButton
          @click="runCommand((chain) => chain.toggleBlockquote())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('blockquote'),
          }"
          icon="i-bx-bxs-quote-right"
          variant="ghost"
          color="gray"
        />
      </CowTooltip>
      <CowTooltip text="Code block" shortcut="code-block">
        <UButton
          @click="runCommand((chain) => chain.toggleCodeBlock())"
          class="toolbar-icon-btn text-gray-600 dark:text-[#a7afbd] dark:hover:text-[#d5dae3] hover:bg-gray-100 dark:hover:bg-[#2b3242]"
          :class="{
            'bg-gray-200 dark:bg-[#171d2b] text-gray-900 dark:text-white':
              editor.isActive('codeBlock'),
          }"
          icon="i-bx-code-curly"
          variant="ghost"
          color="gray"
        />
      </CowTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from "@tiptap/core"

const props = defineProps<{
  editor?: Editor
}>()

const containerOverflow = ref("overflow-x-auto")
const savedSelection = ref<{ from: number; to: number } | null>(null)
const colorPaletteOpen = ref(false)
const fontMenuOpen = ref(false)
const textColorPalette = [
  "#FFFFFF",
  "#DDE1E8",
  "#818CF8",
  "#E8D1F8",
  "#BD7AEA",
  "#7209B7",
  "#FCEFD4",
  "#F6D08E",
  "#EFAD3E",
  "#F79009",
  "#F97066",
  "#B42318",
  "#D1FADF",
  "#32D583",
  "#14B8A6",
  "#027A48",
  "#D1E0FF",
  "#528BFF",
  "#2970FF",
  "#004EEB",
  "#22D3EE",
  "#3B4252",
  "#131724",
  "#0D0F1A",
]

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
  if (!editor || !isEditorReady.value) return

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
  containerOverflow.value = ""
}

const onFontMenuClose = () => {
  fontMenuOpen.value = false
  containerOverflow.value = "overflow-x-auto"
  nextTick(() => requestAnimationFrame(reassertSelection))
}

const onColorPaletteOpenChange = (open: boolean) => {
  if (open) {
    saveSelection()
    containerOverflow.value = ""
    return
  }

  onFontMenuClose()
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
const onColorChange = (color: string) => {
  runCommand((chain) => chain.setColor(color), { restoreFocus: true })
  colorPaletteOpen.value = false
}

const toggleHeading = (level: number) => {
  // Use toggleHeading which is the correct TipTap command
  runCommand((chain) => chain.toggleHeading({ level }))
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
