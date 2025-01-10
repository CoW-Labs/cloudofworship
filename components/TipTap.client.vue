<template>
  <div
    v-if="slide?.layout === slideLayoutTypes.heading_sub"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center rounded-md px-12"
    :class="{
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
    }"
  >
    <TiptapEditorContent :editor="editorOne" />
    <TiptapEditorContent :editor="editorTwo" />
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.full_text"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center rounded-md px-12"
    :class="{
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
    }"
  >
    <TiptapEditorContent :editor="editorTwo" />
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.two_column"
    class="slide-layout-ctn flex gap-4 h-[100%] justify-around items-center rounded-md px-12"
    :class="{
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
    }"
  >
    <TiptapEditorContent :editor="editorOne" />
    <TiptapEditorContent :editor="editorTwo" />
  </div>
  <div
    v-else-if="slide?.layout === slideLayoutTypes.bible"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center rounded-md px-12"
    :class="{
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
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
      'center-live-content': slide?.slideStyle?.alignment === 'center',
      'left-live-content': slide?.slideStyle?.alignment === 'left',
      'right-live-content': slide?.slideStyle?.alignment === 'right',
      'uppercase-live-content': slide?.slideStyle?.lettercase === 'uppercase',
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

watch(
  () => props.slide,
  (newVal, oldVal) => {
    if (newVal?.name !== oldVal?.name && newVal.type === slideTypes.text) {
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
    extensions: [
      TiptapStarterKit,
      TiptapTextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TiptapPlaceholder.configure({
        placeholder: "Your title here",
      }),
      TipTapTextStyle,
      TipTapFontFamily.configure({
        types: ["textStyle"],
      }),
      Color.configure({
        defaultColor: "#000",
      }),
    ],
    onCreate: ({ editor }) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
    onBlur: ({ editor }) => {
      emit("update", 0, editor.getHTML())
      // if (!editor.getHTML().includes("<h1>")) {
      //   editor.chain().focus().toggleHeading({ level: 1 }).run()
      // }
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
    extensions: [
      TiptapStarterKit,
      TiptapTextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TiptapHighlight,
      TiptapPlaceholder.configure({
        placeholder:
          "Write anything, use text formatting options in toolbar above.",
      }),
      TipTapTextStyle,
      TipTapFontFamily.configure({
        types: ["textStyle"],
      }),
      Color.configure({
        defaultColor: "#000",
      }),
    ],
    onCreate: ({ editor }) => {
      // editor.commands.setFontFamily(appStore.currentState.settings.defaultFont)
    },
    onBlur: ({ editor }) => {
      emit("update", 1, editor.getHTML())
    },
    onFocus: ({ editor }) => {
      emit("change-focused-editor", editor)
      // editor.commands.setFontFamily(appStore.currentState.settings.defaultFont)
    },
  })
)

const editorThree = ref(
  useEditor({
    content: props.slide.contents[2] || "",
    editable: props.editable,
    extensions: [
      TiptapStarterKit,
      TiptapTextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TiptapPlaceholder.configure({
        placeholder:
          "Full (richtext) content goes here: \n- Apply text formatting options in toolbar above.\n- Textbox is expandable based on input",
      }),
      TipTapTextStyle,
      TipTapFontFamily.configure({
        types: ["textStyle"],
      }),
      TipTapFontFamily.configure({
        types: ["textStyle"],
      }),
      Color.configure({
        defaultColor: "#000",
      }),
    ],
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
    extensions: [
      TiptapStarterKit,
      TiptapTextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TiptapPlaceholder.configure({
        placeholder:
          "Full (richtext) content goes here: \n- Apply text formatting options in toolbar above.\n- Textbox is expandable based on input",
      }),
      TipTapTextStyle,
      TipTapFontFamily.configure({
        types: ["textStyle"],
      }),
      Color.configure({
        defaultColor: "#000",
      }),
    ],
    // onUpdate: ({ editor }) => {
    //   emit("update", 2, editor.getHTML())
    // },
    onBlur: ({ editor }) => {
      emit("update", 2, editor.getHTML())
    },
    onFocus: ({ editor }) => {
      emit("change-focused-editor", editor)
    },
  })
)

const uneditableEditorTwo = ref(
  useEditor({
    content: props.slide.contents[1] || "",
    editable: false,
    extensions: [
      TiptapStarterKit,
      TiptapTextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TiptapPlaceholder.configure({
        placeholder:
          "Full (richtext) content goes here: \n- Apply text formatting options in toolbar above.\n- Textbox is expandable based on input",
      }),
      TipTapTextStyle,
      TipTapFontFamily.configure({
        types: ["textStyle"],
      }),
      Color.configure({
        defaultColor: "#000",
      }),
    ],
    // onUpdate: ({ editor }) => {
    //   emit("update", 2, editor.getHTML())
    // },
    onBlur: ({ editor }) => {
      emit("update", 2, editor.getHTML())
    },
    onFocus: ({ editor }) => {
      emit("change-focused-editor", editor)
    },
  })
)

const uneditableEditorThree = ref(
  useEditor({
    content: props.slide.contents[1] || "",
    editable: false,
    extensions: [
      TiptapStarterKit,
      TiptapTextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TiptapPlaceholder.configure({
        placeholder:
          "Full (richtext) content goes here: \n- Apply text formatting options in toolbar above.\n- Textbox is expandable based on input",
      }),
      TipTapTextStyle,
      TipTapFontFamily.configure({
        types: ["textStyle"],
      }),
      Color.configure({
        defaultColor: "#000",
      }),
    ],
    // onUpdate: ({ editor }) => {
    //   emit("update", 2, editor.getHTML())
    // },
    onBlur: ({ editor }) => {
      emit("update", 2, editor.getHTML())
    },
    onFocus: ({ editor }) => {
      emit("change-focused-editor", editor)
    },
  })
)
</script>
