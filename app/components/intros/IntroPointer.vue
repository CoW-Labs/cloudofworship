<template>
  <!-- The intro animations' mouse pointer. Place it inside the element it
       clicks: it comes in from below right, rests on it, then presses. -->
  <svg
    class="intro-pointer absolute h-5 w-5 drop-shadow"
    :class="`is-${state}`"
    viewBox="0 0 24 24"
  >
    <path
      d="M5 3l14 8.2-6.1 1.3 3.6 6.4-2.6 1.5-3.6-6.4L5.6 18z"
      fill="#111827"
      stroke="#fff"
      stroke-width="1.4"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ state: "hidden" | "over" | "press" }>()
</script>

<style scoped>
.intro-pointer {
  opacity: 0;
  transform: translate(160%, 120%);
  transition:
    opacity 0.3s ease,
    transform 0.8s cubic-bezier(0.65, 0, 0.35, 1);
}
.intro-pointer.is-over {
  opacity: 1;
  transform: none;
}
.intro-pointer.is-press {
  opacity: 1;
  transform: scale(0.82);
  transition-duration: 0.3s, 0.15s;
}
@media (prefers-reduced-motion: reduce) {
  .intro-pointer {
    display: none;
  }
}
</style>
