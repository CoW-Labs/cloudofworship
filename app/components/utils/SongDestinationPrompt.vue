<template>
  <div
    v-if="isPromptOpen"
    class="fixed top-[58px] right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]"
    role="alert"
    aria-labelledby="song-destination-prompt"
  >
    <!-- Same card shell as UpdateNotification, anchored top-right. -->
    <div
      class="rounded-2xl bg-white dark:bg-[#1b2233] shadow-[0_24px_48px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
    >
      <div class="flex items-center justify-between gap-4 pt-3.5 pb-3 pl-5 pr-4">
        <span class="text-[15px] font-medium text-gray-700 dark:text-[#e8ebf2]">
          Add song
        </span>
        <button
          type="button"
          class="grid place-items-center w-7 h-7 rounded-lg text-gray-500 hover:bg-black/[0.06] hover:text-gray-900 dark:text-[#9aa3b2] dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
          aria-label="Dismiss"
          @click="answer(null)"
        >
          <CloseIcon class="w-4 h-4" />
        </button>
      </div>

      <div class="mx-3 mb-3 p-4 rounded-[14px] bg-[#f1f3f6] dark:bg-[#232b3d]">
        <h2
          id="song-destination-prompt"
          class="text-[16px] font-bold leading-[1.3] tracking-[-0.01em] text-slate-900 dark:text-white"
        >
          Where should “{{ pendingSong?.title }}” go?
        </h2>

        <UCheckbox
          v-model="dontAskAgain"
          name="song-destination-remember"
          label="Remember my choice for this session"
          class="mt-4"
          :ui="{ label: 'text-[13px] text-gray-600 dark:text-[#cfd5e1]' }"
        />

        <div class="flex items-center justify-end gap-2.5 mt-4">
          <CowButton variant="secondary" size="sm" @click="answer('separate')">
            New slide
          </CowButton>
          <CowButton size="sm" @click="answer('setlist')">
            Active setlist
          </CowButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CloseIcon from "~/components/svgs/CloseIcon.vue"

const { pendingSong, isPromptOpen, dontAskAgain, answer } =
  useSongDestinationPrompt()
</script>
