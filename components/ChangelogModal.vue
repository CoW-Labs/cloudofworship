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
            <h2 class="font-semibold text-md">
              What's new in Version {{ appVersion }} 🎉
            </h2>
            <UButton
              icon="i-mdi-close"
              variant="ghost"
              @click="visible = false"
            ></UButton>
          </div>
        </template>
        <div class="changelog-content">
          <ul class="list-disc px-4 leading-7">
            <li
              class="stuff"
              v-for="item in changelog.trim().split('\n')"
              :key="item"
            >
              {{ item?.replace("-", "")?.trim() }}
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
  appVersion: string
  value: string
  user: User
  church: Church
}>()

const emitter = useNuxtApp().$emitter as Emitter<any>
const changelog = `
- You can now add your own images and videos as backgrounds for your slides.
- We've added support for your audio-only files for media slides. Just go ahead and create a media slide and see the customizations you can add to your media(audio) slide.
- You can now play, pause and restart your media files with the Media slide controls.
- One alert is not enough, we added an alert scheduler so you can store alerts and take any one live as you wish.
- This one is exciting! We added a countdown timer for your convenience. Now you can let your congregation know what how soon an event starts or finish in an exciting manner.
- Sharing is caring; now other people can use the songs you upload—but only if you want.
- We don't want you to ever make a mistake taking slides LIVE. So we added a two-step feature to the "Display Bible" action on the quick actions pane.
- Want to edit a live slide quickly, double tap the slide in the Live Output pane and make your quick adjustments ;)`

const appStore = useAppStore()

emitter.on("show-changelog", () => {
  visible.value = true
})
</script>
