<template>
  <div
    class="intermission-background-panel flex flex-col md:flex-row h-full w-full overflow-hidden bg-gray-50 text-gray-800 dark:bg-[#131724] dark:text-[#F8F9FB]"
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

    <section class="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
      <h3
        class="shrink-0 text-[12px] font-normal leading-[17px] text-gray-800 dark:text-[#F8F9FB]"
      >
        {{ activeHeading }}
      </h3>

      <form
        v-if="activeSection === 'texts'"
        class="min-h-0 flex-1 overflow-y-auto flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
        @submit.prevent="saveTexts"
      >
        <div class="flex flex-col gap-3 md:flex-row">
          <CowInput
            v-model="draft.heading"
            label="Heading"
            size="sm"
            maxlength="60"
            class="flex-1"
          />
          <CowInput
            v-model="draft.subtitle"
            label="Sub text"
            size="sm"
            maxlength="70"
            class="flex-1"
          />
        </div>
        <CowDropdown
          label="Text background"
          size="sm"
          :model-value="textBackgroundLabels[draft.textBackground]"
          :options="Object.values(textBackgroundLabels)"
          @update:model-value="onTextBackground"
        />
        <div class="mt-auto flex justify-end">
          <CowButton
            type="submit"
            variant="primary"
            :disabled="!canSave"
          >
            Save
          </CowButton>
        </div>
      </form>

      <div
        v-else
        class="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
      >
        <div class="grid grid-cols-2 md:grid-cols-4 gap-[8.5px]">
          <button
            v-for="variant in intermissionVariants"
            :key="variant.id"
            type="button"
            class="min-w-0 text-left focus-visible:outline-none"
            :aria-pressed="variant.id === value"
            :aria-label="`Use ${variant.name} as background`"
            @click="$emit('select', variant.id)"
            @mouseenter="previewing = variant.id"
            @mouseleave="stopPreview(variant.id)"
            @focus="previewing = variant.id"
            @blur="stopPreview(variant.id)"
          >
            <div
              class="relative w-full overflow-hidden rounded-lg transition-shadow duration-150"
              :class="
                variant.id === value
                  ? 'ring-2 ring-[#E8D1F8]'
                  : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-white/20'
              "
              style="aspect-ratio: 16 / 9"
            >
              <IntermissionView
                :slide="previewSlide(variant.id)"
                :mode="previewing === variant.id ? 'preview' : undefined"
              />
            </div>
            <span
              class="mt-1 block truncate text-[11px] leading-4 text-gray-600 dark:text-[#9BA3B2]"
              :title="variant.best"
            >
              {{ variant.name }}
            </span>
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core"
import type { IntermissionSlideData, Slide } from "~/types"
import { intermissionVariants } from "~/utils/intermission/engine"
import { intermissionModeKey } from "~/utils/intermission/context"
import { defaultIntermissionData } from "~/utils/intermission/slide"

type SectionKey = "animation" | "texts"
type PanelSize = { width: number; height: number }
type IntermissionTexts = Pick<
  IntermissionSlideData,
  "heading" | "subtitle" | "textBackground"
>

const props = defineProps<{
  slide?: Slide
}>()

const emit = defineEmits<{
  (e: "select", variant: string): void
  (e: "save-texts", texts: IntermissionTexts): void
  (e: "resize", size: PanelSize): void
  (e: "close"): void
}>()

const slideData = computed(() => ({
  ...defaultIntermissionData(),
  ...(props.slide?.data as IntermissionSlideData | undefined),
}))
const value = computed(() => slideData.value.variant)

const sections: { key: SectionKey; label: string }[] = [
  { key: "animation", label: "Animation" },
  { key: "texts", label: "Texts" },
]

const headings: Record<SectionKey, string> = {
  animation: "Choose Background Animation",
  texts: "Edit Texts",
}

const panelSizes: Record<SectionKey, PanelSize> = {
  animation: { width: 753, height: 330 },
  texts: { width: 640, height: 240 },
}

const mobilePanelSizes: Record<SectionKey, PanelSize> = {
  animation: { width: 9999, height: 460 },
  texts: { width: 9999, height: 380 },
}

// Texts are edited as a draft and applied together on Save, so the live slide
// and every teammate see one change rather than one per keystroke.
const textsOf = (): IntermissionTexts => ({
  heading: slideData.value.heading,
  subtitle: slideData.value.subtitle,
  textBackground: slideData.value.textBackground,
})
const draft = reactive<IntermissionTexts>(textsOf())
watch(
  () => props.slide?.id,
  () => Object.assign(draft, textsOf())
)

const textBackgroundLabels: Record<
  IntermissionTexts["textBackground"],
  string
> = {
  auto: "Animation default",
  on: "Always on",
  off: "Off",
}

const onTextBackground = (label: string) => {
  const entry = Object.entries(textBackgroundLabels).find(
    ([, text]) => text === label
  )
  if (entry)
    draft.textBackground = entry[0] as IntermissionTexts["textBackground"]
}

const canSave = computed(() => {
  if (!draft.heading.trim()) return false
  const saved = textsOf()
  return (
    draft.heading !== saved.heading ||
    draft.subtitle !== saved.subtitle ||
    draft.textBackground !== saved.textBackground
  )
})

const saveTexts = () => {
  if (!canSave.value) return
  emit("save-texts", {
    heading: draft.heading.trim(),
    subtitle: draft.subtitle.trim(),
    textBackground: draft.textBackground,
  })
}

const isNarrowViewport = useMediaQuery("(max-width: 767px)")

const activeSection = ref<SectionKey>("animation")
const activeHeading = computed(() => headings[activeSection.value])

// Thumbnails are still frames, even inside the animated editor. Only the one
// under the pointer (or keyboard focus) animates, so at most one runs at once.
provide(intermissionModeKey, "static")
const previewing = ref<string | null>(null)
const stopPreview = (id: string) => {
  if (previewing.value === id) previewing.value = null
}

// Each tile carries this slide's own text, so it previews what the slide would
// actually look like on that animation.
const previewSlide = (variant: string) =>
  ({
    id: `intermission-preview-${variant}`,
    data: { ...slideData.value, id: variant, variant },
  }) as unknown as Slide

watch(
  [activeSection, isNarrowViewport],
  () =>
    emit(
      "resize",
      (isNarrowViewport.value ? mobilePanelSizes : panelSizes)[
        activeSection.value
      ]
    ),
  { immediate: true }
)
</script>
