<template>
  <div
    v-if="slide?.layout === slideLayoutTypes.heading_sub"
    :class="{
      'outlined-live-content': slide?.slideStyle?.textOutlined,
      'bold-live-content': slide?.slideStyle?.textBold,
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
      'double-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.double,
      'normal-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.normal,
      'single-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.single,
    }"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center rounded-md px-12"
  >
    <TiptapEditorContent :editor="editorOne" />
    <TiptapEditorContent :editor="editorTwo" />
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.full_text"
    :class="{
      'outlined-live-content': slide?.slideStyle?.textOutlined,
      'bold-live-content': slide?.slideStyle?.textBold,
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
      'double-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.double,
      'normal-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.normal,
      'single-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.single,
    }"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center rounded-md px-12"
  >
    <TiptapEditorContent :editor="editorTwo" />
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.two_column"
    class="slide-layout-ctn flex gap-4 h-[100%] justify-around items-center rounded-md px-12"
    :class="{
      'outlined-live-content': slide?.slideStyle?.textOutlined,
      'bold-live-content': slide?.slideStyle?.textBold,
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'double-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.double,
      'normal-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.normal,
      'single-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.single,
    }"
  >
    <TiptapEditorContent :editor="editorOne" />
    <TiptapEditorContent :editor="editorTwo" />
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.bible"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center rounded-md px-12"
    :class="{
      'outlined-live-content': slide?.slideStyle?.textOutlined,
      'bold-live-content': slide?.slideStyle?.textBold,
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
      'double-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.double,
      'normal-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.normal,
      'single-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.single,
    }"
  >
    <TiptapEditorContent
      :editor="uneditableEditorOne"
      :class="useURLFriendlyString(slide?.slideStyle?.font || '')"
    />
    <TiptapEditorContent :editor="uneditableEditorTwo" />
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.countdown"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center rounded-md px-12"
    :class="{
      'outlined-live-content': slide?.slideStyle?.textOutlined,
      'bold-live-content': slide?.slideStyle?.textBold,
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
      'double-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.double,
      'normal-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.normal,
      'single-line-spacing':
        slide?.slideStyle?.lineSpacing === lineSpacingTypes.single,
    }"
  >
    <TiptapEditorContent :editor="uneditableEditorTwo" class="jost" />
    <TiptapEditorContent
      :editor="uneditableEditorThree"
      :class="useURLFriendlyString(slide?.slideStyle?.font || '')"
    />
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"
import { useAppStore } from "~/store/app"
import { Color } from "@tiptap/extension-color"
import TiptapHighlight from "@tiptap/extension-highlight"
import TiptapTextAlign from "@tiptap/extension-text-align"
import TiptapPlaceholder from "@tiptap/extension-placeholder"
import TipTapTextStyle from "@tiptap/extension-text-style"
import TipTapFontFamily from "@tiptap/extension-font-family"

const props = defineProps<{
  slide: Slide
  editable: boolean
}>()

const emit = defineEmits(["update", "change-focused-editor"])
const appStore = useAppStore()

// Common extensions configuration for better code reusability
const getCommonExtensions = (placeholder: string, includeHeading = true) => {
  const extensions = [
    TiptapStarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    TiptapTextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    TiptapHighlight.configure({
      multicolor: true,
    }),
    TiptapPlaceholder.configure({
      placeholder,
      showOnlyWhenEditable: true,
      emptyEditorClass: "is-editor-empty",
    }),
    TipTapTextStyle,
    TipTapFontFamily.configure({
      types: ["textStyle"],
    }),
    Color.configure({
      types: ["textStyle"],
    }),
  ]
  return extensions
}

// Function to apply default white color to editor
const applyDefaultWhiteColor = (editor: any) => {
  if (editor && !editor.isDestroyed) {
    // Set default color to white for all content
    editor.chain().setColor("#ffffff").run()
  }
}

watch(
  () => props.slide,
  (newVal, oldVal) => {
    if (newVal?.id !== oldVal?.id && newVal.type === slideTypes.text) {
      // editorTwo.value?.commands.clearContent()
      // editorOne.value?.commands.setContent("")
      // editorTwo.value?.commands.setContent("")

      editorOne.value?.commands.setContent(newVal?.contents[0])
      editorTwo.value?.commands.setContent(newVal?.contents[1])
      editorThree.value?.commands.setContent(newVal?.contents[2])
      uneditableEditorOne.value?.commands.setContent(newVal?.contents[0])
      uneditableEditorTwo.value?.commands.setContent(newVal?.contents[1])
      uneditableEditorThree.value?.commands.setContent(newVal?.contents[2])
    } else if (newVal.type !== slideTypes.text) {
      editorOne.value?.commands.setContent(newVal?.contents[0])
      editorTwo.value?.commands.setContent(newVal?.contents[1])
      editorThree.value?.commands.setContent(newVal?.contents[2])
      uneditableEditorOne.value?.commands.setContent(newVal?.contents[0])
      uneditableEditorTwo.value?.commands.setContent(newVal?.contents[1])
      uneditableEditorThree.value?.commands.setContent(newVal?.contents[2])
    }
  }
)

onBeforeUnmount(() => {
  editorOne.value?.destroy()
  editorTwo.value?.destroy()
  editorThree.value?.destroy()
  uneditableEditorOne.value?.destroy()
  uneditableEditorTwo.value?.destroy()
  uneditableEditorThree.value?.destroy()
})

const editorOne = ref(
  useEditor({
    content: props.slide.contents[0] || "",
    editable: props.editable,
    extensions: getCommonExtensions("Untitled", true),
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none min-h-[40px] px-4",
        style: "color: #ffffff;",
      },
    },
    onCreate: ({ editor }) => {
      // Apply default white color
      applyDefaultWhiteColor(editor)

      // Apply default font if set
      if (appStore.currentState?.settings?.defaultFont) {
        editor.commands.setFontFamily(
          appStore.currentState.settings.defaultFont
        )
      }

      // Auto-apply heading if empty
      if (!editor.getText().trim()) {
        editor.chain().focus().toggleHeading({ level: 1 }).run()
      }
    },
    onBlur: ({ editor }) => {
      emit("update", 0, editor.getHTML())
    },
    onFocus: ({ editor }) => {
      emit("change-focused-editor", editor)
    },
  })
)

const editorTwo = ref(
  useEditor({
    content: props.slide.contents[1] || "",
    editable: props.editable,
    extensions: getCommonExtensions(
      "Press '/' for commands, or start typing..."
    ),
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none min-h-[100px] px-4",
        style: "color: #ffffff;",
      },
    },
    onCreate: ({ editor }) => {
      // Apply default white color
      applyDefaultWhiteColor(editor)

      // Apply default font if set
      if (appStore.currentState?.settings?.defaultFont) {
        editor.commands.setFontFamily(
          appStore.currentState.settings.defaultFont
        )
      }
    },
    onBlur: ({ editor }) => {
      emit("update", 1, editor.getHTML())
    },
    onFocus: ({ editor }) => {
      emit("change-focused-editor", editor)
    },
  })
)

const editorThree = ref(
  useEditor({
    content: props.slide.contents[2] || "",
    editable: props.editable,
    extensions: getCommonExtensions("Start writing your content here...", true),
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none min-h-[150px] px-4",
        style: "color: #ffffff;",
      },
    },
    onCreate: ({ editor }) => {
      // Apply default white color
      applyDefaultWhiteColor(editor)

      // Apply default font if set
      if (appStore.currentState?.settings?.defaultFont) {
        editor.commands.setFontFamily(
          appStore.currentState.settings.defaultFont
        )
      }
    },
    onBlur: ({ editor }) => {
      emit("update", 2, editor.getHTML())
    },
    onFocus: ({ editor }) => {
      emit("change-focused-editor", editor)
    },
  })
)

const uneditableEditorOne = ref(
  useEditor({
    content: props.slide.contents[0] || "",
    editable: false,
    extensions: getCommonExtensions("", true),
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none px-4",
        style: "color: #ffffff;",
      },
    },
  })
)

const uneditableEditorTwo = ref(
  useEditor({
    content: props.slide.contents[1] || "",
    editable: false,
    extensions: getCommonExtensions(""),
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none px-4",
        style: "color: #ffffff;",
      },
    },
  })
)

const uneditableEditorThree = ref(
  useEditor({
    content: props.slide.contents[2] || "",
    editable: false,
    extensions: getCommonExtensions(""),
    editorProps: {
      attributes: {
        class: "tiptap-editor focus:outline-none px-4",
        style: "color: #ffffff;",
      },
    },
  })
)
</script>

<style>
/* Notion-like editor styles */
.tiptap-editor {
  color: #ffffff;
  font-size: 1rem;
  line-height: 1.5;
}

.ProseMirror {
  outline: none !important;
  min-height: inherit;
  padding: 0.5rem 0;
  color: #ffffff;
}

/* Base elements inherit white by default */
.ProseMirror p,
.ProseMirror h1,
.ProseMirror h2,
.ProseMirror h3,
.ProseMirror ul,
.ProseMirror ol,
.ProseMirror li {
  color: #ffffff;
}

/* Empty editor placeholder styling */
.ProseMirror p.is-editor-empty:first-child::before {
  color: #6b7280;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

/* Better focus styles */
.ProseMirror:focus {
  outline: none;
}

/* Heading styles for better hierarchy */
.ProseMirror h1 {
  font-size: 1.875rem;
  font-weight: 700;
  line-height: 1.2;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.ProseMirror h2 {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.ProseMirror h3 {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.4;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

/* Paragraph spacing - reduced size */
.ProseMirror p {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  line-height: 1.5;
  font-size: 1rem;
}

/* List styling */
.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.5em;
  margin-top: 0.5em;
  margin-bottom: 0.5em;
}

.ProseMirror li {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}

/* Allow custom colors via inline styles to override default white */
.ProseMirror span[style*="color"] {
  /* Inline color styles will naturally take precedence */
}

/* Code block styling */
.ProseMirror pre {
  background: #f6f8fa;
  border-radius: 6px;
  color: #24292e;
  font-family: "JetBrains Mono", "Fira Code", Consolas, Monaco, monospace;
  padding: 0.75rem 1rem;
  margin: 0.5em 0;
}

.dark .ProseMirror pre {
  background: #161b22;
  color: #c9d1d9;
}

/* Blockquote styling */
.ProseMirror blockquote {
  border-left: 3px solid #e5e7eb;
  padding-left: 1rem;
  margin-left: 0;
  margin-right: 0;
  font-style: italic;
  color: #6b7280;
}

.dark .ProseMirror blockquote {
  border-left-color: #374151;
  color: #9ca3af;
}

/* Highlight/mark styling */
.ProseMirror mark {
  background-color: #fef08a;
  border-radius: 0.25em;
  box-decoration-break: clone;
  padding: 0.125em 0;
}

.dark .ProseMirror mark {
  background-color: #854d0e;
}

/* Selection styling */
.ProseMirror ::selection {
  background: rgba(99, 102, 241, 0.2);
}

/* Smooth transitions */
.ProseMirror * {
  transition: all 0.1s ease;
}

/* Better spacing for nested lists */
.ProseMirror li > p {
  margin: 0;
}

.ProseMirror li > ul,
.ProseMirror li > ol {
  margin-top: 0.25em;
}
</style>
