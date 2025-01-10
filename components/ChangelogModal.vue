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
                What's new in {{ appVersion }} 🎉
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
import { settings } from "firebase/analytics"
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
const changelog = `- See what's new in "View full changelog" link above`

const appStore = useAppStore()

emitter.on("show-changelog", () => {
  visible.value = true
})
</script>
