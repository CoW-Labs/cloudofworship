<template>
  <div
    class="profile-modal w-[220px] overflow-hidden rounded-xl bg-white text-left dark:bg-[#222838]"
  >
    <!-- IDENTITY -->
    <div class="px-4 pb-4 pt-6 text-center">
      <UAvatar
        :src="user?.avatar"
        :text="user?.fullname?.split(' ')?.[0]?.[0]"
        size="md"
        :ui="{
          text: `text-[${user?.theme}] dark:text-[${user?.theme}] font-semibold`,
        }"
        :class="`mx-auto bg-[${user?.theme}20] dark:bg-[${user?.theme}20]`"
      />
      <h5
        class="mt-2 truncate text-sm leading-[18px] text-gray-900 dark:text-[#F8F9FB]"
      >
        {{ user?.fullname }}
      </h5>
      <p class="truncate text-xs leading-4 text-gray-500 dark:text-[#9BA3B2]">
        {{ user?.email }}
      </p>
    </div>

    <!-- CHURCH -->
    <div
      v-if="church?.name"
      class="flex items-center gap-1.5 border-t border-gray-100 px-4 py-3 dark:border-white/[0.06]"
    >
      <UAvatar
        :src="church?.logo"
        :text="church?.name?.[0]"
        size="2xs"
        class="shrink-0"
      />
      <div class="min-w-0">
        <p class="text-xs leading-[14px] text-gray-900 dark:text-[#F8F9FB]">
          {{ church?.name }}
        </p>
        <p
          v-if="church?.type"
          class="text-xs leading-4 text-gray-500 dark:text-[#9BA3B2]"
        >
          {{ church?.type }}
        </p>
      </div>
    </div>

    <!-- ACTIONS -->
    <div
      class="flex flex-col border-t border-gray-100 py-1.5 dark:border-white/[0.06]"
    >
      <button :class="rowStyles" @click="$emit('open-settings')">
        <GearIcon class="h-5 w-5 shrink-0" />
        Settings
      </button>
      <button :class="rowStyles" @click="useGlobalEmit('open-shortcuts')">
        <QuestionIcon class="h-5 w-5 shrink-0" />
        Shortcut &amp; Hotkeys
      </button>
      <a
        href="https://chat.whatsapp.com/DeQX11igCSU6YaOoTqY7GY"
        target="_blank"
        rel="noopener noreferrer"
        :class="rowStyles"
      >
        <HeartIcon class="h-5 w-5 shrink-0" />
        Join the Community
      </a>
    </div>

    <!-- SIGN OUT -->
    <div class="border-t border-gray-100 py-1.5 dark:border-white/[0.06]">
      <ConfirmDialog
        button-label="Sign out"
        button-icon=""
        button-color="gray"
        button-variant="ghost"
        no-tooltip
        header="Sign out"
        :button-styles="signOutStyles"
        label="Are you sure you want to sign out of your account?"
        @confirm="navigateTo('/logout')"
      >
        <template #icon>
          <SignOutIcon class="h-5 w-5 shrink-0" />
        </template>
      </ConfirmDialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Church, User } from "~/store/auth"

defineProps<{
  user: User
  church: Church
}>()

defineEmits<{ (e: "open-settings"): void }>()

// Every menu row is a 37px tall icon + label pair, so keep the styling in one
// place — the sign-out row reuses it through ConfirmDialog's `button-styles`.
const rowBase =
  "flex h-[37px] w-full items-center justify-start gap-1.5 rounded-none px-4 text-sm font-normal transition-colors hover:bg-gray-50 dark:hover:bg-[#2b3140]"
const rowStyles = `${rowBase} text-gray-600 dark:text-[#9BA3B2]`
// Sign out sits apart from the rest of the menu and reads at full contrast.
const signOutStyles = `${rowBase} text-gray-900 dark:text-[#F8F9FB]`
</script>
