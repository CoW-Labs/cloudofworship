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
- You can now access all your slides and schedules from another device
- Have just one computer? No problem! You can now sync your slides and schedules across other devices in your tech team. Just ensure those accounts are linked to the same church.
- Added new hymns for your convenience. Enjoy!
- Fixed plausible issue with Bible version lag—might reoccur. Please report if you see this.
- Fixed minor bugs and issues for improved experience`

const appStore = useAppStore()

emitter.on("show-changelog", () => {
  visible.value = true
})
</script>
