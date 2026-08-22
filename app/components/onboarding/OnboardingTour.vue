<template>
  <ClientOnly>
    <!-- FLOATING HELP BUTTON -->
    <UTooltip text="Take a quick tour" :popper="{ placement: 'left' }">
      <button
        v-show="!isRunning"
        type="button"
        class="cow-tour-fab"
        aria-label="Take a quick tour"
        @click="openWelcome"
      >
        ?
      </button>
    </UTooltip>

    <!-- WELCOME CARD -->
    <UModal
      v-model="isWelcomeOpen"
      :ui="{
        width: 'sm:max-w-[640px] lg:max-w-[760px] xl:max-w-[840px]',
        background: '',
        ring: '',
        shadow: '',
        rounded: 'rounded-2xl',
        padding: 'p-0',
      }"
    >
      <div class="cow-tour-card">
        <div class="cow-tour-header">
          <span class="cow-tour-title">{{ onboardingWelcome.eyebrow }}</span>
          <button
            type="button"
            class="cow-tour-close"
            aria-label="Close"
            @click="dismissWelcome"
          >
            <CloseIcon class="w-4 h-4" />
          </button>
        </div>

        <div class="cow-tour-body">
          <video
            class="cow-tour-video"
            :src="tourVideoSrc"
            autoplay
            loop
            muted
            playsinline
          />
          <h2 class="cow-tour-heading">{{ onboardingWelcome.title }}</h2>
          <p class="cow-tour-desc">{{ onboardingWelcome.description }}</p>
          <div class="cow-tour-actions">
            <CowButton @click="acceptWelcome">
              {{ onboardingWelcome.cta }}
            </CowButton>
          </div>
        </div>
      </div>
    </UModal>
  </ClientOnly>
</template>

<script setup lang="ts">
import "driver.js/dist/driver.css"
import { onboardingWelcome } from "~/utils/onboardingSteps"
import CloseIcon from "~/components/svgs/CloseIcon.vue"

const {
  isWelcomeOpen,
  isRunning,
  openWelcome,
  acceptWelcome,
  dismissWelcome,
} = useOnboardingTour()

const colorMode = useColorMode()
const tourVideoSrc = computed(() =>
  colorMode.value === "dark"
    ? "/large_assets/new-demo-video-dark.mp4"
    : "/large_assets/new-demo-video.mp4"
)
</script>

<!--
  Unscoped on purpose: driver.js renders its popover directly into <body>, so
  scoped styles would never reach it. Every selector is namespaced under
  `.cow-tour-*` / `.cow-tour-popover` to keep the blast radius small.
-->
<style>
/* ---------------------------------------------------------------- FAB --- */
.cow-tour-fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 40;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 9999px;
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
  background-color: #a855f7;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 5px 0 0 #7e22ce,
    0 12px 18px -8px rgba(126, 34, 206, 0.45);
  transition: transform 0.08s ease, box-shadow 0.08s ease,
    background-color 0.2s ease;
}

.cow-tour-fab:hover {
  background-color: #9f4ff5;
}

.cow-tour-fab:active {
  transform: translateY(4px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 0 0 #7e22ce,
    0 4px 8px -6px rgba(126, 34, 206, 0.6);
}

/* ----------------------------------------------- shared card surfaces --- */
.cow-tour-card,
.driver-popover.cow-tour-popover {
  background-color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 24px 48px -12px rgba(15, 23, 42, 0.35);
}

html.dark .cow-tour-card,
html.dark .driver-popover.cow-tour-popover {
  background-color: #1b2233;
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.6);
}

.cow-tour-header,
.cow-tour-popover .cow-tour-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px 12px 20px;
}

.cow-tour-title,
.cow-tour-popover .driver-popover-title {
  font-size: 15px;
  font-weight: 500;
  color: #374151;
}

html.dark .cow-tour-title,
html.dark .cow-tour-popover .driver-popover-title {
  color: #e8ebf2;
}

.cow-tour-close,
.cow-tour-popover .driver-popover-close-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  position: static;
  border-radius: 8px;
  color: #6b7280;
  opacity: 1;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.cow-tour-popover .driver-popover-close-btn::before {
  content: "";
  width: 15px;
  height: 15px;
  background-color: currentColor;
  -webkit-mask: var(--cow-tour-close-icon) center / contain no-repeat;
  mask: var(--cow-tour-close-icon) center / contain no-repeat;
}

.cow-tour-popover .driver-popover-close-btn {
  --cow-tour-close-icon: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M18 6 6 18M6 6l12 12'/%3E%3C/svg%3E");
  font-size: 0;
}

.cow-tour-close:hover,
.cow-tour-popover .driver-popover-close-btn:hover {
  background-color: rgba(15, 23, 42, 0.06);
  color: #111827;
}

html.dark .cow-tour-close,
html.dark .cow-tour-popover .driver-popover-close-btn {
  color: #9aa3b2;
}

html.dark .cow-tour-close:hover,
html.dark .cow-tour-popover .driver-popover-close-btn:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.cow-tour-body,
.cow-tour-popover .cow-tour-body {
  margin: 0 12px 12px;
  padding: 24px;
  border-radius: 14px;
  background-color: #f1f3f6;
}

html.dark .cow-tour-body,
html.dark .cow-tour-popover .cow-tour-body {
  background-color: #232b3d;
}

.cow-tour-video {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 20px;
  background-color: #000;
}

.cow-tour-heading {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: #0f172a;
}

html.dark .cow-tour-heading {
  color: #ffffff;
}

.cow-tour-desc,
.cow-tour-popover .driver-popover-description {
  margin: 12px 0 0;
  font-size: 15px;
  line-height: 1.55;
  color: #4b5563;
}

html.dark .cow-tour-desc,
html.dark .cow-tour-popover .driver-popover-description {
  color: #cfd5e1;
}

.cow-tour-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 28px;
}

/* -------------------------------------------------- driver.js popover --- */
.driver-popover.cow-tour-popover {
  max-width: 420px;
  min-width: 360px;
  padding: 0;
  color: inherit;
}

.cow-tour-popover .driver-popover-arrow {
  display: none !important;
}

.cow-tour-popover .driver-popover-progress-text {
  display: block;
  font-size: 15px;
  font-weight: 500;
  color: #6b7280;
}

html.dark .cow-tour-popover .driver-popover-progress-text {
  color: #8b93a5;
}

.cow-tour-popover .cow-tour-actions {
  margin-top: 24px;
}

.cow-tour-popover .driver-popover-next-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 28px;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  text-shadow: none;
  cursor: pointer;
  color: #fff;
  background-color: #a855f7;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 5px 0 0 #7e22ce,
    0 12px 18px -8px rgba(126, 34, 206, 0.45);
  transition: transform 0.08s ease, box-shadow 0.08s ease,
    background-color 0.2s ease;
}

.cow-tour-popover .driver-popover-next-btn:hover {
  background-color: #9f4ff5;
}

.cow-tour-popover .driver-popover-next-btn:active:not(:disabled) {
  transform: translateY(4px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 1px 0 0 #7e22ce,
    0 4px 8px -6px rgba(126, 34, 206, 0.6);
}

/* Gated step: "Next" stays closed until the requirement is met. */
.cow-tour-popover .driver-popover-next-btn.cow-tour-btn-disabled {
  cursor: not-allowed;
  opacity: 0.45;
  transform: none;
}

/* Back — mirrors CowButton's secondary treatment. */
.cow-tour-popover .driver-popover-prev-btn {
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 9999px;
  font-size: 15px;
  font-weight: 600;
  text-shadow: none;
  cursor: pointer;
  color: #0f172a;
  background-color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12), 0 4px 0 0 #cbd5e1,
    0 10px 16px -10px rgba(15, 23, 42, 0.35);
  transition: transform 0.08s ease, box-shadow 0.08s ease,
    background-color 0.2s ease;
}

.cow-tour-popover .driver-popover-prev-btn:hover {
  background-color: #f8fafc;
}

.cow-tour-popover .driver-popover-prev-btn:active {
  transform: translateY(3px);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12), 0 1px 0 0 #cbd5e1;
}

html.dark .cow-tour-popover .driver-popover-prev-btn {
  color: #f8fafc;
  background-color: #1c2433;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 4px 0 0 #0d1320,
    0 10px 16px -10px rgba(0, 0, 0, 0.6);
}

html.dark .cow-tour-popover .driver-popover-prev-btn:hover {
  background-color: #232c3d;
}

html.dark .cow-tour-popover .driver-popover-prev-btn:active {
  transform: translateY(3px);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 1px 0 0 #0d1320;
}

/* Waiting-on-you line shown beside the buttons while a step is gated. */
.cow-tour-popover .cow-tour-hint {
  flex-basis: 100%;
  margin: 0;
  font-size: 13.5px;
  font-weight: 500;
  color: #b45309;
}

html.dark .cow-tour-popover .cow-tour-hint {
  color: #fbbf24;
}

/*
  Interactive steps hand the app back to the operator: driver's `.driver-active *`
  rule freezes everything outside the spotlight, which is wrong for a step that
  asks them to click something. Scoped to the operator shell, and elements that
  opt out of hit-testing for their own reasons are excluded — the Tailwind
  utility, and Quick Actions' animated placeholder, which sits over the search
  input the operator may need to reach.
*/
html.cow-tour-interactive .app-ctn,
html.cow-tour-interactive
  .app-ctn
  *:not(.pointer-events-none):not(.quick-actions-placeholder) {
  pointer-events: auto;
}

/* driver sets `pointer-events: auto` inline on the overlay path, so this has
   to be !important to let clicks reach the app beneath it. */
html.cow-tour-interactive .driver-overlay,
html.cow-tour-interactive .driver-overlay path {
  pointer-events: none !important;
}

/*
  Spotlight ring. Sits above driver's overlay SVG (z-index 10000) and below its
  popover, and is positioned in JS so `overflow: hidden` panels can't clip it.
*/
.cow-tour-ring {
  position: fixed;
  z-index: 10001;
  opacity: 0;
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  pointer-events: none;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
