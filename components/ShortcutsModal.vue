<template>
  <div class="flex">
    <UModal v-model="visible">
      <UCard
        :ui="{
          ring: '',
          divide: 'divide-y divide-gray-100 dark:divide-gray-800',
        }"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <div class="text-and-link">
              <h2 class="font-semibold text-md">Shortcuts & Hotkeys</h2>
              <p class="text-sm text-gray-800 dark:text-gray-200">
                Speed up your workflow, get full Ctrl.
              </p>
            </div>
            <UButton
              icon="i-mdi-close"
              variant="ghost"
              @click="visible = false"
            ></UButton>
          </div>
        </template>
        <div class="changelog-content">
          <ul class="px-4 leading-7">
            <li
              class="stuff py-3 border-b border-gray-100 dark:border-gray-800 flex"
              v-for="shortcut in shortcuts"
              :key="shortcut?.cmd"
            >
              <div class="col min-w-[110px] whitespace-nowrap">
                <span
                  class="text-sm mono font-bold bg-gray-200 text-gray-500 inline-grid place-items-center p-1 px-2 min-w-[30px] rounded-md"
                >
                  {{ shortcut?.cmd }}
                </span>
              </div>
              <div class="col text-sm">
                {{ shortcut?.name }}
              </div>
            </li>
          </ul>
        </div>
      </UCard>
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
  value: string
  user: User
  church: Church
}>()

const emitter = useNuxtApp().$emitter as Emitter<any>
const appStore = useAppStore()

const shortcuts = ref([
  {
    cmd: `/`,
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
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + Z`,
    name: "Undo previous action",
  },
  {
    cmd: `${useClientOS() === "macOS" ? "Cmd" : "Ctrl"} + Y`,
    name: "Redo previous action",
  },
])

emitter.on("open-shortcuts", () => {
  visible.value = true
})
</script>
