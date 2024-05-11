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
              What's new in Version 0.6.2 🎉
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
  value: string
  user: User
  church: Church
}>()

const emitter = useNuxtApp().$emitter as Emitter<any>
const changelog = `
Updated hymns data
- Added preview component to see Bible verses in a chapter
- Added loop settings feature for media slides (video type)
- Added timestamps for media files in DB
- Fixed issues with adding songs
- Fixed few issues when saving a Slide; still on the lookout for more issues here
- Updated signup UI, added more churches and church abbreviations
- Fixed fade animation between slides
- Added feature to increase and decrease font size of Bible, Hymn and Song slides
- Updated videos to cache on the browser; videos can now play without an internet connection after initial load.`

const appStore = useAppStore()

emitter.on("show-changelog", () => {
  visible.value = true
})
</script>
