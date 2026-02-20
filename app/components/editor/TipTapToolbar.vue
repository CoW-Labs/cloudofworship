<template>
  <div
    v-if="editor"
    class="my-2 flex gap-1 w-[100%] absolute z-10 bg-white dark:bg-[#121212] p-1 right-0 left-0 top-[45px]"
    :class="containerOverflow"
  >
    <UButton
      @click="editor.chain().focus().toggleBold().run()"
      :disabled="!editor.can().chain().focus().toggleBold().run()"
      :class="{
        'bg-primary text-white dark:text-primary-900': editor.isActive('bold'),
      }"
      icon="i-bx-bold"
      variant="ghost"
    />
    <UButton
      @click="editor.chain().focus().toggleItalic().run()"
      :disabled="!editor.can().chain().focus().toggleItalic().run()"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('italic'),
      }"
      icon="i-bx-italic"
      variant="ghost"
    />
    <UButton
      @click="editor.chain().focus().toggleStrike().run()"
      :disabled="!editor.can().chain().focus().toggleStrike().run()"
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
      @click="editor.chain().focus().toggleBulletList().run()"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('bulletList'),
      }"
      icon="i-bx-list-ul"
      variant="ghost"
    />
    <UButton
      @click="editor.chain().focus().toggleOrderedList().run()"
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
        @click="editor.chain().focus().setTextAlign('left').run()"
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
        @click="editor.chain().focus().setTextAlign('center').run()"
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
        @click="editor.chain().focus().setTextAlign('right').run()"
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
      @change="editor.chain().focus().setFontFamily($event).run()"
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
      @click="editor.chain().focus().toggleBlockquote().run()"
      :class="{
        'bg-primary text-white dark:text-primary-900':
          editor.isActive('blockquote'),
      }"
      icon="i-bx-bxs-quote-right"
      variant="ghost"
    />
    <UButton
      @click="editor.chain().focus().toggleCodeBlock().run()"
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
const props = defineProps({
  editor: Object,
})
const containerOverflow = ref("overflow-x-auto")
const isEmpty = (obj: Object) => Object.keys(obj).length === 0

// Computed property for current text color
const currentColor = computed(() => {
  return props.editor?.getAttributes("textStyle").color || "#ffffff"
})

// Handle color change with proper focus management
const onColorChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const color = target.value

  // Set color and maintain focus
  props.editor?.chain().focus().setColor(color).run()
}

const toggleHeading = (level: number) => {
  if (!props.editor) return

  // Use toggleHeading which is the correct TipTap command
  props.editor.chain().focus().toggleHeading({ level }).run()
}

const setParagraph = () => {
  if (!props.editor) return

  props.editor.chain().focus().setParagraph().run()
}
</script>

<style scoped></style>
