<template>
  <div
    v-if="isEditorReady"
    class="my-2 flex gap-1 w-[100%] absolute z-10 bg-white dark:bg-[#121212] p-1 right-0 left-0 top-[45px]"
    :class="containerOverflow"
    @mousedown.capture="onToolbarMouseDown"
  >
    <UButton
      @click="runCommand((chain) => chain.toggleBold())"
      :class="{
        'bg-primary text-white dark:text-primary-900': editor.isActive('bold'),
      }"
      icon="i-bx-bold"
      variant="ghost"
    />
    <UButton
      @click="runCommand((chain) => chain.toggleItalic())"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('italic'),
      }"
      icon="i-bx-italic"
      variant="ghost"
    />
    <UButton
      @click="runCommand((chain) => chain.toggleStrike())"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('strike'),
      }"
      icon="i-bx-strikethrough"
      variant="ghost"
    />
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
      class="button-group bg-primary-100 dark:bg-primary-900 rounded-md mx-1 p-1 flex items-center gap-1"
    >
      <UButton
        v-for="headingSize in 3"
        :key="`heading-size-${headingSize}`"
        @click="toggleHeading(headingSize)"
        class="dark:text-primary-400 dark:hover:text-primary-500 gap-0 items-end"
        :class="{
          'bg-primary text-white dark:text-primary-900': editor.isActive(
            'heading',
            {
              level: headingSize,
            }
          ),
        }"
        variant="ghost"
      >
        H<span class="text-xs">{{ headingSize }}</span>
      </UButton>
    </div>
    <UButton
      @click="setParagraph()"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('paragraph'),
      }"
      icon="i-bx-paragraph"
      variant="ghost"
    />
    <UButton
      @click="runCommand((chain) => chain.toggleBulletList())"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('bulletList'),
      }"
      icon="i-bx-list-ul"
      variant="ghost"
    />
    <UButton
      @click="runCommand((chain) => chain.toggleOrderedList())"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('orderedList'),
      }"
      icon="i-bx-list-ol"
      variant="ghost"
    />
    <div
      class="button-group bg-primary-100 dark:bg-primary-900 rounded-md mx-1 p-1 flex items-center gap-1"
    >
      <UButton
        @click="runCommand((chain) => chain.setTextAlign('left'))"
        class="dark:text-primary-400 dark:hover:text-primary-500"
        :class="{
          'bg-primary text-white dark:text-primary-900': editor.isActive({
            textAlign: 'left',
          }),
        }"
        icon="i-bi-text-left"
        variant="ghost"
      />
      <UButton
        @click="runCommand((chain) => chain.setTextAlign('center'))"
        class="dark:text-primary-400 dark:hover:text-primary-500"
        :class="{
          'bg-primary text-white dark:text-primary-900': editor.isActive({
            textAlign: 'center',
          }),
        }"
        icon="i-bi-text-center"
        variant="ghost"
      />
      <UButton
        @click="runCommand((chain) => chain.setTextAlign('right'))"
        class="dark:text-primary-400 dark:hover:text-primary-500"
        :class="{
          'bg-primary text-white dark:text-primary-900': editor.isActive({
            textAlign: 'right',
          }),
        }"
        icon="i-bi-text-right"
        variant="ghost"
      />
    </div>
    <TipTapFontSelect
      :editor="editor"
      size="md"
      :disabled="false"
      @change="runCommand((chain) => chain.setFontFamily($event))"
      @open="containerOverflow = ''"
      @close="containerOverflow = 'overflow-x-auto'"
    />
    <UTooltip text="Change text color" :popper="{ arrow: true }">
      <label class="cursor-pointer">
        <input
          type="color"
          @input="onColorChange"
          class="sr-only"
          :value="currentColor"
        />
        <div
          class="min-w-10 h-10 flex items-center justify-center rounded-md p-1.5 text-primary-500 dark:text-primary-400 bg-primary-100 dark:bg-primary-900 hover:bg-primary-200 dark:hover:bg-primary-950 cursor-pointer transition-colors"
        >
          <span class="i-bx-palette text-lg"></span>
          <div
            class="absolute w-[80%] rounded-xl h-1 bottom-[3px]"
            :style="`background: ${currentColor}`"
          ></div>
        </div>
      </label>
    </UTooltip>
    <UButton
      @click="runCommand((chain) => chain.toggleBlockquote())"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('blockquote'),
      }"
      icon="i-bx-bxs-quote-right"
      variant="ghost"
    />
    <UButton
      @click="runCommand((chain) => chain.toggleCodeBlock())"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('codeBlock'),
      }"
      icon="i-bx-code-curly"
      variant="ghost"
    />
  </div>
</template>

<script setup lang="ts">
import type { Editor } from "@tiptap/core"

const props = defineProps<{
  editor?: Editor
}>()

const containerOverflow = ref("overflow-x-auto")
const savedSelection = ref<{ from: number; to: number } | null>(null)

const isEditorReady = computed(() => {
  const editor = props.editor
  if (!editor || editor.isDestroyed) return false

  try {
    return Boolean(editor.view?.dom)
  } catch {
    return false
  }
})

// Computed property for current text color
const currentColor = computed(() => {
  if (!isEditorReady.value) return "#ffffff"
  return props.editor?.getAttributes("textStyle").color || "#ffffff"
})

const saveSelection = () => {
  const editor = props.editor
  if (!editor || !isEditorReady.value) return

  const { from, to } = editor.state.selection
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

const runCommand = (apply: (chain: any) => any) => {
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
  } catch (error) {
    console.warn("[TipTap] Toolbar command skipped:", error)
  }
}

// Handle color change with proper focus management
const onColorChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const color = target.value

  // Set color and maintain focus
  runCommand((chain) => chain.setColor(color))
}

const toggleHeading = (level: number) => {
  // Use toggleHeading which is the correct TipTap command
  runCommand((chain) => chain.toggleHeading({ level }))
}

const setParagraph = () => {
  runCommand((chain) => chain.setParagraph())
}
</script>

<style scoped></style>
