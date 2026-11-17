<template>
  <div
    class="cow-slider"
    :class="[$attrs.class, { 'is-disabled': disabled }]"
    :style="[$attrs.style as any, `--cow-slider-progress: ${progress}`]"
  >
    <div class="cow-slider__fill" />
    <div class="cow-slider__thumb"><span class="cow-slider__dimple" /></div>
    <!-- The native input only handles dragging, keys and a11y; it is invisible. -->
    <input
      v-bind="inputAttrs"
      class="cow-slider__input"
      type="range"
      :value="current"
      :min="min"
      :max="max"
      :step="effectiveStep"
      :disabled="disabled"
      @input="onInput"
    />
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  {
    modelValue: 0,
    min: 0,
    max: 100,
    disabled: false,
  }
)

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void
}>()

const attrs = useAttrs()

// id, aria-label and listeners belong on the input; class and style on the wrapper
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

/** Without an explicit step, the range is cut into 300 positions so any range drags smoothly. */
const effectiveStep = computed(() => props.step ?? (props.max - props.min) / 300)

// What the slider shows. It follows the pointer at once; the parent hears about
// it at most once per frame, because every update can write to the stores,
// localStorage and the live window, which a low-end laptop can't keep up with.
const current = ref(props.modelValue)
watch(
  () => props.modelValue,
  (value) => {
    current.value = value
  }
)

const progress = computed(() => {
  const range = props.max - props.min
  if (range <= 0) return 0

  const value = Math.min(props.max, Math.max(props.min, current.value))
  return ((value - props.min) / range) * 100
})

let frame = 0
const flush = () => {
  frame = 0
  emit("update:modelValue", current.value)
}

const onInput = (event: Event) => {
  current.value = (event.target as HTMLInputElement).valueAsNumber
  if (!frame) frame = requestAnimationFrame(flush)
}

onBeforeUnmount(() => {
  // don't lose the last value if the slider goes away mid-drag
  if (frame) {
    cancelAnimationFrame(frame)
    flush()
  }
})
</script>

<style scoped>
/* Chunky, glossy slider: a recessed track, a purple fill that deepens toward
   the handle, and one dimple marking the handle. Drawn with plain elements so
   the fill and its rounded end are a single shape. */
.cow-slider {
  --cow-slider-size: 24px;
  --cow-slider-light: #d8b4fe; /* purple-300 */
  --cow-slider-mid: #a855f7; /* purple-500 */
  --cow-slider-deep: #9333ea; /* purple-600 */
  --cow-slider-track: #e2e8f0;
  --cow-slider-track-shadow: rgb(15 23 42 / 22%);
  /* how far the handle has travelled along the track */
  --cow-slider-travel: calc(
    (100% - var(--cow-slider-size)) * var(--cow-slider-progress) / 100
  );

  position: relative;
  width: 100%;
  height: var(--cow-slider-size);
  border-radius: 999px;
  background: var(--cow-slider-track);
  box-shadow:
    inset 0 2px 4px var(--cow-slider-track-shadow),
    inset 0 -1px 0 rgb(255 255 255 / 60%);
}

.cow-slider__fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(var(--cow-slider-size) + var(--cow-slider-travel));
  border-radius: 999px;
  background:
    linear-gradient(
      to bottom,
      rgb(255 255 255 / 40%) 0%,
      rgb(255 255 255 / 10%) 45%,
      rgb(0 0 0 / 0%) 55%,
      rgb(0 0 0 / 10%) 100%
    ),
    linear-gradient(
      to right,
      var(--cow-slider-light),
      var(--cow-slider-mid) 60%,
      var(--cow-slider-deep)
    );
  /* a short ease fills the gaps between input events, so it glides */
  transition: width 90ms ease-out;
  pointer-events: none;
}

.cow-slider__thumb {
  position: absolute;
  top: 0;
  left: var(--cow-slider-travel);
  display: grid;
  place-items: center;
  width: var(--cow-slider-size);
  height: var(--cow-slider-size);
  transition: left 90ms ease-out;
  pointer-events: none;
}

.cow-slider__dimple {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgb(59 7 100 / 40%);
  transition: transform 120ms ease-out;
}

.cow-slider:active .cow-slider__dimple {
  transform: scale(1.15);
}

.cow-slider__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  opacity: 0;
}

.cow-slider:has(.cow-slider__input:focus-visible) {
  outline: 2px solid #a855f7;
  outline-offset: 2px;
}

.cow-slider.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.cow-slider.is-disabled .cow-slider__input {
  cursor: not-allowed;
}
</style>

<style>
html.dark .cow-slider {
  --cow-slider-track: #1c1a22;
  --cow-slider-track-shadow: rgb(0 0 0 / 70%);

  box-shadow:
    inset 0 2px 5px var(--cow-slider-track-shadow),
    inset 0 -1px 0 rgb(255 255 255 / 6%);
}

html.dark .cow-slider:has(.cow-slider__input:focus-visible) {
  outline-color: #e8d1f8;
}
</style>
