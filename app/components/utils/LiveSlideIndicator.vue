<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="live-indicator absolute top-0 right-0"
      :class="[
        hideText ? 'live-indicator--dot' : 'live-indicator--pill',
        { 'live-indicator--idle': !onAir },
      ]"
    >
      <span class="live-indicator__dot"></span>
      <span v-if="!hideText" class="live-indicator__label">LIVE</span>
    </div>
  </Transition>
</template>
<script setup lang="ts">
import { useOutputOnAir } from "~/composables/useLiveOutputControl"

defineProps({
  visible: Boolean,
  hideText: Boolean,
})

// Grey and still until the output really reaches a screen. The operator's
// views only mark which slide would show; /live, /stage and the livestream are
// the screen itself.
const route = useRoute()
const outputOnAir = useOutputOnAir()
const onAir = computed(
  () => !["/", "/mobile"].includes(route.path) || outputOnAir.value
)
</script>
<style scoped>
.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #f04438;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  /* Glass surface */
  border: 1px solid var(--live-glass-border, rgba(255, 255, 255, 0.18));
  background: var(--live-glass-bg, rgba(255, 255, 255, 0.1));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 4px 16px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(10px) saturate(160%);
  -webkit-backdrop-filter: blur(10px) saturate(160%);
}

.live-indicator--pill {
  padding: 0.3rem 0.6rem 0.3rem 0.5rem;
  border-radius: 999px;
}

.live-indicator--dot {
  padding: 0.3rem;
  border-radius: 999px;
}

.live-indicator__label {
  line-height: 1;
}

.live-indicator__dot {
  position: relative;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  background: #f04438;
}

.live-indicator__dot::after {
  position: absolute;
  inset: 0;
  content: "";
  border-radius: inherit;
  background: #f04438;
  animation: live-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.live-indicator--idle {
  color: #98a2b3;
}

.live-indicator--idle .live-indicator__dot {
  background: #98a2b3;
}

.live-indicator--idle .live-indicator__dot::after {
  animation: none;
  opacity: 0;
}

@keyframes live-ping {
  75%,
  100% {
    transform: scale(2.3);
    opacity: 0;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
