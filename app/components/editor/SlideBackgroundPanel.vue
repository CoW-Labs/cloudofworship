<template>
  <div
    class="slide-background-panel flex h-full w-full overflow-hidden bg-[#131724] text-[#F8F9FB]"
  >
    <aside
      class="h-full w-[158px] shrink-0 border-r border-white/[0.06] bg-[#131724]"
    >
      <button
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="flex h-9 w-full items-center border-b border-[#0D0F1A] px-[15px] text-left text-[12px] font-normal leading-none transition-colors duration-150"
        :class="
          activeSection === section.key
            ? 'bg-[#2B3140] text-[#F8F9FB]'
            : 'bg-[#131724] text-[#9BA3B2] hover:bg-[#1a1f2d] hover:text-[#F8F9FB]'
        "
        :aria-pressed="activeSection === section.key"
        @click="activeSection = section.key"
      >
        {{ section.label }}
      </button>
    </aside>

    <section class="relative h-full min-w-0 flex-1 overflow-hidden">
      <h3
        class="absolute left-3 top-[13px] z-10 text-[12px] font-normal leading-[17px] text-[#F8F9FB]"
      >
        {{ activeHeading }}
      </h3>

      <template v-if="activeSection === 'image'">
        <div
          class="absolute left-3 top-9 h-[268px] w-[382px] overflow-hidden rounded-xl bg-[#222838]"
        >
          <BgImageSelection
            background-panel
            hide-upload
            :value="slide?.background"
            @select="$emit('select', backgroundTypes.image, $event.image)"
            @loading-change="$emit('loading-change', $event)"
          />
        </div>
        <FileDropzone
          background-panel
          class="absolute left-[414px] top-[14px] h-[285px] w-[169px]"
          accept="image/*"
          icon="i-bx-image"
          description="Upload an Image or Drag & Drop here"
          :max-file-size="maxImageSize"
          @change="$emit('upload-files', $event, 'image')"
        />
      </template>

      <template v-else-if="activeSection === 'video'">
        <div
          class="absolute left-3 top-9 h-[268px] w-[382px] overflow-hidden rounded-xl bg-[#222838]"
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
          class="absolute left-[414px] top-[14px] h-[285px] w-[169px]"
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
        class="absolute left-3 top-9"
        :value="slide?.background"
        @select="$emit('select', backgroundTypes.solid, $event.color)"
      />

      <BgGradientSelection
        v-else-if="activeSection === 'gradient'"
        background-panel
        class="absolute left-3 top-9"
        :value="slide?.background"
        @select="$emit('select', backgroundTypes.gradient, $event.gradient)"
      />

      <BgStyle
        v-else
        background-panel
        class="absolute left-3 top-9"
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
  (e: "select", type: string, data: string | { video: string; key?: string }): void
  (e: "loading-change", loading: boolean): void
  (e: "upload-files", files: File[], kind: "image" | "video"): void
  (e: "resize", size: PanelSize): void
  (e: "close"): void
}>()

const { isFreePlan, isTeamsPlan } = useSubscription()
const maxImageSize = computed(() => (isFreePlan.value ? 3 : 10))
const maxVideoSize = computed(() => (isTeamsPlan.value ? Infinity : 250))

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
