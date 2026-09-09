<template>
  <div
    v-if="showBanner"
    class="fixed bottom-4 right-4 z-50 w-[400px] max-w-[calc(100vw-2rem)]"
    role="alert"
    aria-labelledby="update-notification"
  >
    <!-- Same card shell as SatisfactionPromptModal, anchored bottom-right
         instead of centred behind an overlay. -->
    <div
      class="rounded-2xl bg-white dark:bg-[#1b2233] shadow-[0_24px_48px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
    >
      <div class="flex items-center justify-between gap-4 pt-3.5 pb-3 pl-5 pr-4">
        <span class="text-[15px] font-medium text-gray-700 dark:text-[#e8ebf2]">
          Update ready
        </span>
        <button
          type="button"
          class="grid place-items-center w-7 h-7 rounded-lg text-gray-500 hover:bg-black/[0.06] hover:text-gray-900 dark:text-[#9aa3b2] dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
          aria-label="Dismiss"
          @click="useGlobalEmit(appWideActions.dismissUpdate)"
        >
          <CloseIcon class="w-4 h-4" />
        </button>
      </div>

      <div class="mx-3 mb-3 p-5 rounded-[14px] bg-[#f1f3f6] dark:bg-[#232b3d]">
        <h2
          id="update-notification"
          class="text-[20px] font-bold leading-[1.25] tracking-[-0.01em] text-slate-900 dark:text-white"
        >
          {{
            availableVersion
              ? `Version ${availableVersion} is ready`
              : "A new version is ready"
          }}
        </h2>
        <p
          class="mt-2 text-[14px] leading-[1.55] text-gray-600 dark:text-[#cfd5e1]"
        >
          {{ installHint }}
        </p>

        <div class="flex flex-wrap items-center justify-end gap-3 mt-6">
          <CowButton
            variant="secondary"
            :disabled="status === 'installing'"
            @click="useGlobalEmit(appWideActions.dismissUpdate)"
          >
            Later
          </CowButton>
          <CowButton
            :loading="status === 'installing'"
            @click="useGlobalEmit(appWideActions.installUpdate)"
          >
            {{ installLabel }}
          </CowButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue"
import type { Emitter } from "mitt"
import CloseIcon from "~/components/svgs/CloseIcon.vue"
import { appWideActions } from "~/utils/constants"

/**
 * Renders only once an update is downloaded and staged — the check and the
 * download itself are silent and live in useAppUpdater. If the operator picks
 * "Later" the update still installs when they close the app.
 */
const {
  status,
  availableVersion,
  showBanner,
  installLabel,
  installHint,
  installNow,
  dismissBanner,
  revealBanner,
} = useAppUpdater()

const emitter = useNuxtApp().$emitter as Emitter<any>

const onInstall = () => installNow()
const onDismiss = () => dismissBanner()
const onReveal = () => revealBanner()

onMounted(() => {
  emitter.on(appWideActions.installUpdate, onInstall)
  emitter.on(appWideActions.dismissUpdate, onDismiss)
  emitter.on(appWideActions.revealUpdate, onReveal)
})

onUnmounted(() => {
  emitter.off(appWideActions.installUpdate, onInstall)
  emitter.off(appWideActions.dismissUpdate, onDismiss)
  emitter.off(appWideActions.revealUpdate, onReveal)
})
</script>
