<template>
  <div
    class="camera-echo-panel flex w-[300px] flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200/70 dark:bg-[#1a2130] dark:ring-white/10"
  >
    <div class="flex items-center justify-between gap-2">
      <h4 class="text-xs font-semibold text-gray-700 dark:text-[#c3cad6]">
        Main character echo
      </h4>
      <CowButton
        variant="secondary"
        size="2xs"
        class="!px-3 !py-1 text-xs"
        :disabled="isDefault"
        @click="reset"
      >
        Reset
      </CowButton>
    </div>

    <p class="text-[11px] leading-snug text-gray-500 dark:text-[#9aa3b2]">
      {{ note }}
    </p>

    <div v-for="row in rows" :key="row.key" class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between gap-2 text-xs">
        <label
          :for="`camera-echo-${row.key}`"
          class="text-gray-600 dark:text-[#a7afbd]"
        >
          {{ row.label }}
        </label>
        <span
          class="font-medium tabular-nums text-gray-800 dark:text-white"
        >
          {{ row.format(draft[row.key]) }}
        </span>
      </div>
      <CoWSlider
        :id="`camera-echo-${row.key}`"
        :model-value="draft[row.key]"
        :min="echoRanges[row.key].min"
        :max="echoRanges[row.key].max"
        :step="echoRanges[row.key].step"
        :aria-label="row.label"
        @update:model-value="draft[row.key] = $event"
        @change="commit(row.key)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CameraEchoSettings } from "~/types"
import { defaultEchoSettings, echoRanges } from "~/utils/camera"
import { personSegmenterState } from "~/utils/personSegmenter"

type NumberKey = keyof typeof echoRanges

const props = defineProps<{
  settings: CameraEchoSettings
}>()

const emit = defineEmits<{
  update: [patch: Partial<CameraEchoSettings>]
}>()

const rows: { key: NumberKey; label: string; format: (v: number) => string }[] =
  [
    { key: "copies", label: "Copies per side", format: (v) => String(v) },
    { key: "spacing", label: "Spacing", format: (v) => `${v}% of width` },
    { key: "strength", label: "Strength of first copy", format: (v) => `${v}%` },
    { key: "falloff", label: "Each copy keeps", format: (v) => `${v}%` },
    { key: "fringe", label: "Colour fringe", format: (v) => `${v.toFixed(2)}%` },
  ]

// The handle moves with the drag; the slide is saved once, on release, as the
// app's other sliders do, rather than on every pointer move.
const draft = reactive<Record<NumberKey, number>>({ ...props.settings })
watch(
  () => props.settings,
  (settings) => {
    for (const { key } of rows) draft[key] = settings[key]
  }
)

const commit = (key: NumberKey) => {
  if (draft[key] !== props.settings[key]) emit("update", { [key]: draft[key] })
}

const isDefault = computed(() => {
  const defaults = defaultEchoSettings()
  return (Object.keys(defaults) as (keyof CameraEchoSettings)[]).every(
    (key) => defaults[key] === props.settings[key]
  )
})

const reset = () => emit("update", defaultEchoSettings())

const note = computed(() => {
  if (props.settings.subject === "whole") {
    return "Copies the whole picture. Works best with a lit person on a dark stage."
  }
  if (personSegmenterState.value === "failed") {
    return "Person detection is not available on this computer, so the whole picture is copied."
  }
  if (personSegmenterState.value === "loading") {
    return "Loading person detection…"
  }
  return "Copies only the people the camera sees. Detection runs on this computer, and no video leaves it."
})
</script>
