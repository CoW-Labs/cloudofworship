<template>
  <div>
    <!-- The controls, written once: shown in an accordion, or bare where a
         panel section already gives them a heading. -->
    <DefineControls>
      <div class="interlude-style-controls flex flex-col gap-4">
        <!-- Curated colour themes. Each recolours whichever animation is
             picked and keeps its light and shade, so any theme suits any
             animation. The first cell leaves the animation's own colours. -->
        <div>
          <p class="mb-1.5 text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]">
            Colours
          </p>
          <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <button
              v-for="option in themeOptions"
              :key="option.id ?? 'default'"
              type="button"
              class="group min-w-0 rounded-xl p-1.5 text-left ring-1 transition-shadow"
              :class="
                option.selected
                  ? 'bg-white ring-2 ring-primary-500 dark:bg-[#222838]'
                  : 'bg-white/70 ring-gray-200 hover:ring-gray-300 dark:bg-[#222838] dark:ring-white/10 dark:hover:ring-white/20'
              "
              :aria-pressed="option.selected"
              :aria-label="`${option.name} colours`"
              @click="pickTheme(option)"
            >
              <span class="flex h-7 w-full overflow-hidden rounded-md">
                <span
                  v-if="!option.colors.length"
                  class="interlude-style-swatch--empty h-full w-full"
                />
                <span
                  v-for="(colour, i) in option.colors"
                  :key="i"
                  class="h-full flex-1"
                  :style="{ backgroundColor: colour }"
                />
              </span>
              <span class="mt-1 block truncate px-0.5 text-[11px] leading-4 text-gray-700 dark:text-[#d4d9e3]">
                {{ option.name }}
              </span>
            </button>
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
import { getInterludeTheme, interludeThemes } from "~/utils/interlude/themes"

export type InterludeStyle = Pick<
  InterludeSlideData,
  "themeId" | "color" | "tone" | "size" | "speed"
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

// A slide saved with the old single colour keeps it, shown as its own cell
// until another is picked.
const legacyColour = computed(() =>
  !props.modelValue.themeId && props.modelValue.color
    ? props.modelValue.color
    : null
)

const themeOptions = computed(() => [
  {
    id: null as string | null,
    name: "Animation's own",
    colors: [] as string[],
    selected: !props.modelValue.themeId && !legacyColour.value,
    legacy: false,
  },
  ...(legacyColour.value
    ? [
        {
          id: null as string | null,
          name: "Custom colour",
          colors: [legacyColour.value],
          selected: true,
          legacy: true,
        },
      ]
    : []),
  ...interludeThemes.map((theme) => ({
    id: theme.id as string | null,
    name: theme.name,
    colors: [...theme.colors],
    selected: props.modelValue.themeId === theme.id,
    legacy: false,
  })),
])

const pickTheme = (option: { id: string | null; selected: boolean; legacy: boolean }) => {
  if (option.legacy || option.selected) return
  update({ themeId: option.id, color: null })
  usePosthogCapture("INTERLUDE_THEME_CHANGED", { themeId: option.id ?? "default" })
}

const summary = computed(() => {
  const parts: string[] = []
  const theme = getInterludeTheme(props.modelValue.themeId)
  if (theme) parts.push(theme.name)
  else if (legacyColour.value) parts.push("Custom colour")
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
