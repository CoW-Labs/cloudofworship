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
              <h2 class="font-semibold text-md">
                What's new in Version {{ appVersion }} 🎉
              </h2>
              <a
                href="https://www.cloudofworship.com/changelog"
                target="_blank"
                class="border-b border-primary-200 text-primary-900 dark:text-primary-100 hover:text-primary-700 dark:hover:text-primary-300"
                >View full changelog</a
              >
            </div>
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
const changelog = `- Added a feature to display download percentages during the initial setup, providing users with progress feedback.
- Fixed issues with keyboard arrow actions in QuickActions for smoother navigation and control.
- Resolved problems where users remained on saved slides unintentionally.
- Fixed the clearing of saved slides after they have been added, ensuring they remain accessible.
- Fixed an issue preventing the upload of batch media slides, improving the media management workflow.
- Introduced the New Living Translation (NLT) Bible version, expanding scripture options for users.
- Fixed an issue where banner links incorrectly opened in new tabs, ensuring proper link behavior.
- Resolved slight issues related to banner notifications, enhancing overall user experience and reliability.`

const appStore = useAppStore()

emitter.on("show-changelog", () => {
  visible.value = true
})
</script>
