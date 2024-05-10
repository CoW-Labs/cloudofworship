<template>
  <Transition>
    <div
      class="navbar-ctn h-[50px] w-[100%] border-b border-gray-100 dark:border-primary-950 flex justify-between items-center px-4 dark:border-primary-900"
      v-if="route.name !== 'live'"
    >
      <div class="logo flex items-center gap-2">
        <Logo class="w-[32px]" />
        <h1 class="text-md font-semibold">Cloud of Worshippers</h1>
        <span
          class="version-chip flex text-xs font-semibold bg-gray-100 dark:bg-primary-900 p-2 py-1 rounded-full dark:bg-primary-900"
        >
          v{{ appVersion }}
        </span>
      </div>
      <div class="actions text-sm flex gap-2 items-center">
        <ClientOnly>
          <UButton
            :icon="isDark ? 'i-tabler-moon-filled' : 'i-tabler-sun-filled'"
            color="primary"
            variant="ghost"
            aria-label="Theme"
            @click="isDark = !isDark"
            >{{ isDark ? "Light" : "Dark" }}</UButton
          >
          <template #fallback>
            <div class="w-8 h-8" />
          </template>
        </ClientOnly>

        <UPopover
          v-model:open="bgImagePopoverOpen"
          :ui="{
            ring: 'ring-0',
            background: 'bg-white dark-bg-gray-900 border-0',
          }"
        >
          <UButton
            variant="ghost"
            trailing-icon="i-bx-chevron-down"
            class="p-1"
          >
            <UAvatar
              :alt="user?.fullname"
              size="sm"
              class="border-primary-500"
              :ui="{
                background: 'bg-primary-100 ring-0',
                wrapper: 'bg-red-500',
              }"
            />
          </UButton>
          <template #panel>
            <ProfileMiniModal :user="user" :church="church" />
          </template>
        </UPopover>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useAuthStore } from "~/store/auth"
const route = useRoute()
const darkMode = ref(false)
const colorMode = useColorMode()
const authStore = useAuthStore()

const { user, church } = storeToRefs(authStore)
defineProps({
  appVersion: String,
})
const isDark = computed({
  get() {
    return colorMode.value === "dark"
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark"
  },
})
</script>

<style scoped></style>
