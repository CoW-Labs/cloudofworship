<template>
  <!-- Laid out as the editor's other panels: a muted ground with a heading
       and a text-link action, and the controls on a card inside it. -->
  <div
    class="camera-effect-panel flex w-[300px] min-w-[300px] flex-col gap-2 rounded-2xl bg-gray-50 p-3 text-gray-800 ring-1 ring-gray-200/70 dark:bg-[#131724] dark:text-[#F8F9FB] dark:ring-white/[0.06]"
  >
    <div class="flex items-center justify-between gap-2 px-0.5">
      <h3 class="text-[12px] font-normal leading-[17px]">
        {{ title }}
      </h3>
      <button
        type="button"
        class="text-[12px] leading-[17px] text-primary-600 hover:underline disabled:pointer-events-none disabled:opacity-40 dark:text-[#d9a4ff]"
        :disabled="isDefault"
        @click="reset"
      >
        Reset
      </button>
    </div>

    <p
      v-if="note"
      class="px-0.5 text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]"
    >
      {{ note }}
    </p>

    <div
      class="flex flex-col gap-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-200/70 dark:bg-[#222838] dark:shadow-none dark:ring-0"
    >
      <!-- Either/or settings use the app's dropdown, as the Interlude panel's
           "Light / dark" does. -->
      <CowDropdown
        v-for="choice in choices"
        :key="choice.label"
        :label="choice.label"
        size="sm"
        :model-value="choice.options.find((option) => option.active)?.label"
        :options="choice.options.map((option) => option.label)"
        @update:model-value="onChoose(choice, $event)"
      />

      <div v-for="slider in sliders" :key="slider.key">
        <div
          class="mb-1.5 flex items-center justify-between gap-2 text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]"
        >
          <label :for="`camera-effect-${slider.key}`">
            {{ slider.label }}
          </label>
          <span class="tabular-nums">
            {{ slider.format(draft[slider.key] ?? 0) }}
          </span>
        </div>
        <CoWSlider
          :id="`camera-effect-${slider.key}`"
          :model-value="draft[slider.key]"
          :min="ranges[slider.key]!.min"
          :max="ranges[slider.key]!.max"
          :step="ranges[slider.key]!.step"
          :aria-label="slider.label"
          @update:model-value="draft[slider.key] = $event"
          @change="commit(slider.key)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CameraEffectChoice,
  CameraEffectRange,
  CameraEffectSlider,
} from "~/utils/camera"

/**
 * The "Adjust" panel for a camera effect: dropdowns for its either/or
 * settings, a slider per number setting, and a Reset to the effect's
 * defaults. Each effect passes its own choices, sliders, ranges and defaults
 * (see utils/camera).
 */
const props = defineProps<{
  title: string
  /** A line under the title, such as how the effect finds people. */
  note?: string
  choices?: CameraEffectChoice[]
  settings: Record<string, unknown>
  sliders: CameraEffectSlider[]
  ranges: Record<string, CameraEffectRange>
  defaults: Record<string, unknown>
}>()

const emit = defineEmits<{
  update: [patch: Record<string, unknown>]
}>()

const numbersOf = (settings: Record<string, unknown>) =>
  Object.fromEntries(
    props.sliders.map(({ key }) => [key, Number(settings[key])])
  ) as Record<string, number>

// The handle moves with the drag; the slide is saved once, on release, as the
// app's other sliders do, rather than on every pointer move.
const draft = reactive<Record<string, number>>(numbersOf(props.settings))
watch(
  () => props.settings,
  (settings) => Object.assign(draft, numbersOf(settings))
)

const commit = (key: string) => {
  if (draft[key] !== props.settings[key]) emit("update", { [key]: draft[key] })
}

const onChoose = (choice: CameraEffectChoice, label: string) => {
  const option = choice.options.find((item) => item.label === label)
  if (option && !option.active) emit("update", option.patch)
}

const isDefault = computed(() =>
  Object.keys(props.defaults).every(
    (key) => props.defaults[key] === props.settings[key]
  )
)

const reset = () => emit("update", { ...props.defaults })
</script>
