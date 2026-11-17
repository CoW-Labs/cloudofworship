<template>
  <div
    class="cow-progress"
    :class="{ 'cow-progress--on-dark': onDark }"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="clamped"
  >
    <div class="cow-progress__fill" :style="{ width: `${clamped}%` }" />
  </div>
</template>

<script setup lang="ts">
/**
 * A thin progress bar drawn like CowSlider's track: a recessed track with a
 * purple gradient fill that deepens toward its end. No handle, since nothing
 * here is dragged. Use `on-dark` on a dark surface (a slide card), where the
 * light track would glare.
 */
const props = withDefaults(
  defineProps<{
    /** 0 to 100. Missing or not a number reads as empty. */
    value?: number | null
    onDark?: boolean
  }>(),
  { value: 0, onDark: false }
)

const clamped = computed(() => {
  const value = Number(props.value)
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0
})
</script>

<style scoped>
.cow-progress {
  --cow-progress-size: 8px;
  --cow-progress-light: #d8b4fe; /* purple-300 */
  --cow-progress-mid: #a855f7; /* purple-500 */
  --cow-progress-deep: #9333ea; /* purple-600 */
  --cow-progress-track: #e2e8f0;
  --cow-progress-track-shadow: rgb(15 23 42 / 22%);

  position: relative;
  width: 100%;
  height: var(--cow-progress-size);
  overflow: hidden;
  /* The fill eases its width, so keep each frame's layout and paint inside the
     bar instead of the slide card around it. */
  contain: layout paint;
  border-radius: 999px;
  background: var(--cow-progress-track);
  box-shadow:
    inset 0 2px 4px var(--cow-progress-track-shadow),
    inset 0 -1px 0 rgb(255 255 255 / 60%);
}

.cow-progress--on-dark {
  --cow-progress-track: #1c1a22;
  --cow-progress-track-shadow: rgb(0 0 0 / 70%);

  box-shadow:
    inset 0 2px 5px var(--cow-progress-track-shadow),
    inset 0 -1px 0 rgb(255 255 255 / 12%);
}

.cow-progress__fill {
  position: absolute;
  inset: 0 auto 0 0;
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
      var(--cow-progress-light),
      var(--cow-progress-mid) 60%,
      var(--cow-progress-deep)
    );
  /* Updates arrive every couple of seconds, so a longer ease keeps it gliding. */
  transition: width 600ms ease-out;
}
</style>

<style>
html.dark .cow-progress:not(.cow-progress--on-dark) {
  --cow-progress-track: #1c1a22;
  --cow-progress-track-shadow: rgb(0 0 0 / 70%);

  box-shadow:
    inset 0 2px 5px var(--cow-progress-track-shadow),
    inset 0 -1px 0 rgb(255 255 255 / 6%);
}
</style>
