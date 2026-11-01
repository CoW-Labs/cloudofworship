<template>
  <div>
    <!-- The controls, written once: shown in an accordion, or bare where a
         panel section already gives them a heading. -->
    <DefineControls>
      <div class="interlude-style-controls flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            class="flex items-center gap-2 text-xs text-gray-600 dark:text-[#9BA3B2]"
            :aria-expanded="pickerOpen"
            :aria-label="
              modelValue.color
                ? `Change theme colour, current colour ${modelValue.color}`
                : 'Pick a theme colour'
            "
            @click="pickerOpen = !pickerOpen"
          >
            <span
              class="h-7 w-7 shrink-0 rounded-md ring-1 ring-black/10 dark:ring-white/15"
              :class="{ 'interlude-style-swatch--empty': !modelValue.color }"
              :style="
                modelValue.color ? { backgroundColor: modelValue.color } : {}
              "
            />
            {{ modelValue.color ? "Theme colour" : "Pick a theme colour" }}
          </button>
          <button
            v-if="modelValue.color"
            type="button"
            class="text-xs text-primary-600 hover:underline dark:text-[#d9a4ff]"
            aria-label="Reset to the animation's colours"
            @click="update({ color: null })"
          >
            Reset
          </button>
        </div>
        <!-- The app's colour swatches, as the slide background uses. Inline,
             not a popover: the editor's Interlude panel closes on any click
             outside it, and a popover panel renders outside. Only hue and
             saturation are taken, so pale and deep swatches tint alike. -->
        <!-- Opens by growing to its height (grid rows 0fr → 1fr) and fading
             in, so the controls below slide down rather than jump. The
             negative margin takes back the column's gap while it is shut. -->
        <div
          class="grid transition-all duration-200 ease-out motion-reduce:transition-none"
          :class="
            pickerOpen
              ? 'grid-rows-[1fr] opacity-100'
              : '-mt-4 grid-rows-[0fr] opacity-0'
          "
          :inert="!pickerOpen"
        >
          <div class="min-h-0 overflow-hidden p-px">
            <BgColorSelection
              background-panel
              fill
              color-purpose="theme"
              :value="modelValue.color ?? undefined"
              @select="setColor($event.color)"
            />
          </div>
        </div>

        <CowDropdown
          label="Light / dark"
          :size="size"
          :model-value="toneLabels[modelValue.tone ?? 'mix']"
          :options="Object.values(toneLabels)"
          @update:model-value="onTone"
        />

        <div v-for="slider in sliders" :key="slider.key">
          <div
            class="mb-1.5 flex items-center justify-between text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]"
          >
            <span>{{ slider.label }}</span>
            <span class="tabular-nums">{{ slider.format(local[slider.key]) }}</span>
          </div>
          <CoWSlider
            v-model="local[slider.key]"
            :min="slider.range.min"
            :max="slider.range.max"
            :step="0.05"
            :aria-label="`Animation ${slider.label.toLowerCase()}`"
          />
        </div>
      </div>
    </DefineControls>

    <ReuseControls v-if="bare" />
    <CowAccordion
      v-else
      :items="[
        {
          label: 'Colour, size and speed',
          description: summary,
          slot: 'style',
        },
      ]"
    >
      <template #style>
        <ReuseControls />
      </template>
    </CowAccordion>
  </div>
</template>

<script setup lang="ts">
import { createReusableTemplate, watchDebounced } from "@vueuse/core"

const [DefineControls, ReuseControls] = createReusableTemplate()
import type { InterludeSlideData } from "~/types"
import {
  INTERLUDE_SIZE,
  INTERLUDE_SPEED,
  interludeScale,
} from "~/utils/interlude/engine"

export type InterludeStyle = Pick<
  InterludeSlideData,
  "color" | "tone" | "size" | "speed"
>

const props = defineProps<{
  modelValue: InterludeStyle
  size?: "md" | "sm"
  /** Without the "Colour, size and speed" accordion around the controls. */
  bare?: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: InterludeStyle): void
}>()

const toneLabels: Record<NonNullable<InterludeStyle["tone"]>, string> = {
  mix: "Light and dark",
  light: "Light only",
  dark: "Dark only",
}


const percent = (v: number) => `${Math.round(v * 100)}%`
const times = (v: number) => `${+v.toFixed(2)}×`
const sliders = [
  { key: "size", label: "Size", range: INTERLUDE_SIZE, format: percent },
  { key: "speed", label: "Speed", range: INTERLUDE_SPEED, format: times },
] as const

const update = (patch: Partial<InterludeStyle>) =>
  emit("update:modelValue", { ...props.modelValue, ...patch })

// Sliders move a local copy and save once the drag settles, so the live slide
// and teammates get one update rather than one per step.
const scalesOf = () => ({
  size: interludeScale(props.modelValue.size, INTERLUDE_SIZE),
  speed: interludeScale(props.modelValue.speed, INTERLUDE_SPEED),
})
const local = reactive(scalesOf())
watch(
  () => [props.modelValue.size, props.modelValue.speed],
  () => Object.assign(local, scalesOf())
)
watchDebounced(
  () => ({ ...local }),
  (next) => {
    const saved = scalesOf()
    if (next.size !== saved.size || next.speed !== saved.speed) update(next)
  },
  { debounce: 250 }
)

const summary = computed(() => {
  const parts: string[] = []
  if (props.modelValue.color) parts.push("Theme colour")
  const tone = props.modelValue.tone ?? "mix"
  if (tone !== "mix") parts.push(toneLabels[tone])
  const { size, speed } = scalesOf()
  if (size !== INTERLUDE_SIZE.default) parts.push(`Size ${percent(size)}`)
  if (speed !== INTERLUDE_SPEED.default) parts.push(`Speed ${times(speed)}`)
  return parts.join(" · ") || "Animation default"
})

const onTone = (label: string) => {
  const entry = Object.entries(toneLabels).find(([, text]) => text === label)
  if (entry) update({ tone: entry[0] as InterludeStyle["tone"] })
}

const pickerOpen = ref(false)
const setColor = (color: string) => {
  pickerOpen.value = false
  if (props.modelValue.color !== color) update({ color })
}
</script>

<style scoped>
/* No colour yet: a diagonal slash, like an empty swatch. */
.interlude-style-swatch--empty {
  background: linear-gradient(
      to top right,
      transparent calc(50% - 1px),
      #ef4444 calc(50% - 1px),
      #ef4444 calc(50% + 1px),
      transparent calc(50% + 1px)
    ),
    #ffffff;
}
</style>
