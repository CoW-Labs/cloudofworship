<template>
  <div
    class="slide-background-panel flex flex-col md:flex-row h-full w-full overflow-hidden bg-gray-50 text-gray-800 dark:bg-[#131724] dark:text-[#F8F9FB]"
  >
    <aside
      class="flex md:block w-full md:w-[158px] h-auto md:h-full shrink-0 overflow-x-auto md:overflow-x-visible border-b md:border-b-0 md:border-r border-gray-200 bg-[#f1f3f6] dark:border-white/[0.06] dark:bg-[#131724]"
    >
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="flex h-9 w-auto md:w-full shrink-0 items-center whitespace-nowrap border-b-0 md:border-b border-gray-200 px-[15px] text-left text-[12px] font-normal leading-none transition-colors duration-150 dark:border-[#0D0F1A]"
        :class="
          activeSection === section.key
            ? 'bg-white text-gray-900 dark:bg-[#2B3140] dark:text-[#F8F9FB]'
            : 'bg-[#f1f3f6] text-gray-500 hover:bg-white hover:text-gray-900 dark:bg-[#131724] dark:text-[#9BA3B2] dark:hover:bg-[#1a1f2d] dark:hover:text-[#F8F9FB]'
        "
        :aria-pressed="activeSection === section.key"
        @click="activeSection = section.key"
      >
        {{ section.label }}
      </button>
    </aside>

    <section
      class="relative min-h-0 min-w-0 flex-1 overflow-y-auto md:h-full md:overflow-hidden"
    >
      <h3
        class="static md:absolute px-3 pt-3 md:p-0 md:left-3 md:top-[13px] z-10 block text-[12px] font-normal leading-[17px] text-gray-800 dark:text-[#F8F9FB]"
      >
        {{ activeHeading }}
      </h3>

      <template v-if="activeSection === 'image'">
        <div
          class="mx-3 mt-2 h-[220px] w-auto md:absolute md:left-3 md:top-9 md:m-0 md:h-[268px] md:w-[382px] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
        >
          <BgImageSelection
            background-panel
            hide-upload
            :value="slide?.background"
            @select="$emit('select', backgroundTypes.image, $event)"
            @loading-change="$emit('loading-change', $event)"
          />
        </div>
        <FileDropzone
          background-panel
          class="m-3 h-[110px] w-auto md:absolute md:left-[414px] md:top-[14px] md:m-0 md:h-[285px] md:w-[169px]"
          accept="image/*"
          icon="i-bx-image"
          description="Upload an Image or Drag & Drop here"
          :max-file-size="maxImageSize"
          @change="$emit('upload-files', $event, 'image')"
        />
      </template>

      <template v-else-if="activeSection === 'video'">
        <div
          class="mx-3 mt-2 h-[220px] w-auto md:absolute md:left-3 md:top-9 md:m-0 md:h-[268px] md:w-[382px] overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
        >
          <BgVideoSelection
            background-panel
            hide-upload
            :value="slide?.background"
            @select="$emit('select', backgroundTypes.video, $event)"
            @loading-change="$emit('loading-change', $event)"
          />
        </div>
        <FileDropzone
          background-panel
          class="m-3 h-[110px] w-auto md:absolute md:left-[414px] md:top-[14px] md:m-0 md:h-[285px] md:w-[169px]"
          accept="video/*"
          icon="i-bx-film"
          description="Upload a Video or Drag & Drop here"
          :max-video-file-size="maxVideoSize"
          @change="$emit('upload-files', $event, 'video')"
        />
      </template>

      <BgColorSelection
        v-else-if="activeSection === 'colour'"
        background-panel
        class="p-3 md:p-0 md:absolute md:left-3 md:top-9"
        :value="slide?.background"
        @select="$emit('select', backgroundTypes.solid, $event.color)"
      />

      <BgGradientSelection
        v-else-if="activeSection === 'gradient'"
        background-panel
        class="p-3 md:p-0 md:absolute md:left-3 md:top-9"
        :value="slide?.background"
        @select="$emit('select', backgroundTypes.gradient, $event.gradient)"
      />

      <BgStyle
        v-else
        background-panel
        class="p-3 md:p-0 md:absolute md:left-3 md:top-9"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import type { ExtendedFileT, Slide } from "~/types"

type SectionKey = "image" | "video" | "colour" | "gradient" | "style"
type PanelSize = { width: number; height: number }

const props = defineProps<{
  slide?: Slide
}>()

const emit = defineEmits<{
  (
    e: "select",
    type: string,
    data:
      | string
      | { image: string; key?: string }
      | { video: string; key?: string }
  ): void
  (e: "loading-change", loading: boolean): void
  (e: "upload-files", files: File[], kind: "image" | "video"): void
  (e: "resize", size: PanelSize): void
  (e: "close"): void
}>()

const maxImageSize = computed(() => Infinity)
const maxVideoSize = computed(() => Infinity)

const isAudio = computed(() =>
  (props.slide?.data as ExtendedFileT)?.type?.includes("audio")
)

const sections = computed(() => [
  { key: "image" as SectionKey, label: "Add Image" },
  ...(isAudio.value
    ? []
    : [{ key: "video" as SectionKey, label: "Add Video" }]),
  { key: "colour" as SectionKey, label: "Add Colour" },
  { key: "gradient" as SectionKey, label: "Add Gradient" },
  { key: "style" as SectionKey, label: "Background style" },
])

const headings: Record<SectionKey, string> = {
  image: "Add Background Image",
  video: "Add Background Video",
  colour: "Add Background Colour",
  gradient: "Add Background Gradient",
  style: "Adjust Style",
}

const panelSizes: Record<SectionKey, PanelSize> = {
  image: { width: 753, height: 314 },
  video: { width: 753, height: 314 },
  colour: { width: 401, height: 200 },
  gradient: { width: 401, height: 200 },
  style: { width: 390, height: 183 },
}

const initialSection = (): SectionKey => {
  switch (props.slide?.backgroundType) {
    case backgroundTypes.video:
      return isAudio.value ? "image" : "video"
    case backgroundTypes.solid:
      return "colour"
    case backgroundTypes.gradient:
      return "gradient"
    default:
      return "image"
  }
}

const activeSection = ref<SectionKey>(initialSection())
const activeHeading = computed(() => headings[activeSection.value])

watch(
  activeSection,
  (section) => emit("resize", panelSizes[section]),
  { immediate: true }
)
</script>
