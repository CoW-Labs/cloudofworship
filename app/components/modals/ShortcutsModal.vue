<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        rounded: 'rounded-2xl',
        background: 'bg-transparent dark:bg-transparent',
        ring: '',
        shadow: 'shadow-none',
        width: 'w-[94vw] sm:max-w-[600px]',
        overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
      }"
    >
      <div
        class="shortcuts-card rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden"
      >
        <!-- HEADER -->
        <div class="flex items-center justify-between gap-3 px-5 py-4">
          <div class="text-and-link">
            <h2 class="font-semibold text-base text-gray-900 dark:text-white">
              Shortcuts & Hotkeys
            </h2>
            <p class="text-sm text-gray-400 dark:text-[#9aa3b2] mt-0.5">
              Speed up your workflow, get full Ctrl.
            </p>
          </div>
          <button
            class="grid h-8 w-8 place-items-center rounded-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#222938] shrink-0"
            aria-label="Close shortcuts modal"
            @click="visible = false"
          >
            <CloseIcon class="block h-4 w-4 text-gray-600 dark:text-[#a7afbd]" />
          </button>
        </div>

        <!-- BODY -->
        <div class="shortcuts-content px-5 pb-5">
          <ul class="flex flex-col gap-2">
            <li
              class="stuff flex items-center gap-4 rounded-2xl px-4 py-3 bg-white dark:bg-[#131a27] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.07)]"
              v-for="shortcut in shortcuts"
              :key="shortcut?.cmd"
            >
              <div class="col min-w-[110px] whitespace-nowrap">
                <span
                  class="text-sm mono font-bold bg-gray-100 dark:bg-[#222938] text-gray-500 dark:text-[#9aa3b2] inline-grid place-items-center p-1 px-2 min-w-[30px] rounded-md"
                >
                  {{ shortcut?.cmd }}
                </span>
              </div>
              <div class="col text-sm text-gray-700 dark:text-[#c5cbd6]">
                {{ shortcut?.name }}
              </div>
            </li>
          </ul>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"
const visible = ref<boolean>(false)

defineProps<{
  visible: Boolean
}>()

const emitter = useNuxtApp().$emitter as Emitter<any>
const appStore = useAppStore()

const shortcuts = ref([
  {
    cmd: `/`,
    name: "Quick actions tab - Search actions or anything else",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + K`,
    name: "Quick actions tab - Search actions or anything else",
  },
  {
    cmd: `Cmd + H`,
    name: "Open Shortcut & Hotkeys Modal",
  },
  {
    cmd: "→",
    name: "Go to next verse (scriptures, songs, hymns)",
  },
  {
    cmd: "←",
    name: "Go to previous verse (scriptures, songs, hymns)",
  },
  {
    cmd: "↑",
    name: "Promote slide before current slide in schedule to LIVE display",
  },
  {
    cmd: "↓",
    name: "Promote slide before current slide in schedule to LIVE display",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + 0`,
    name: "Promote last slide to LIVE display",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + Num`,
    name: "Promote slide based on number to LIVE display",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + P`,
    name: "Promote active slide (in preview and edit content) to LIVE display",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + F`,
    name: "[Works only on live display] Use to take display fullscreen",
  },
  // {
  //   cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + Z`,
  //   name: "Undo previous action",
  // },
  // {
  //   cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + Y`,
  //   name: "Redo previous action",
  // },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + ,`,
    name: "Open App Settings",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + +`,
    name: "Zoom in / Increase display size",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + -`,
    name: "Zoom out / Decrease display size",
  },
])

emitter.on("open-shortcuts", () => {
  visible.value = true
})
</script>
