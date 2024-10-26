<template>
  <div class="profile-modal-ctn flex">
    <div class="profile-modal text-center w-52">
      <div class="avatar-ctn bg-primary-100 dark:bg-slate-800 p-4">
        <UAvatar
          :src="user?.avatar"
          :text="user?.fullname?.split(' ')?.[0]?.[0]"
          size="xl"
          :ui="{
            text: `text-[${user?.theme}] dark:text-[${user?.theme}] font-semibold`,
          }"
          :class="`dark:border border-[${user?.theme}] bg-[${user?.theme}20] dark:bg-[${user?.theme}20]`"
        />

        <h5 class="name font-medium text-md mt-4">{{ user?.fullname }}</h5>
      </div>
      <div
        v-if="church?.name && church?.type"
        class="texts text-center p-4 dark:border-primary-950"
      >
        <div class="church flex gap-2">
          <div class="text-left">
            <p class="text-md font-semibold">
              {{ church?.type }}
              <span class="text-gray-500 text-xs font-normal block">{{
                church?.name
              }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="actions flex flex-col border-t dark:border-slate-800">
        <UButton
          size="xl"
          variant="ghost"
          color="gray"
          class="px-5 py-3 text-md rounded-none justify-start items-start"
          block
          @click="$emit('open-settings')"
          >App Settings
        </UButton>
        <UButton
          size="xl"
          variant="ghost"
          color="gray"
          class="px-5 py-3 text-md rounded-none justify-start items-start"
          block
          @click="useGlobalEmit('open-shortcuts')"
          >Shortcut & Hotkeys
        </UButton>
        <UButton
          to="https://chat.whatsapp.com/DeQX11igCSU6YaOoTqY7GY"
          target="_blank"
          size="xl"
          variant="ghost"
          class="px-5 py-3 text-md rounded-none justify-start items-start"
          color="gray"
          block
          >Join the Community 💜
        </UButton>
        <ConfirmDialog
          button-label="Sign out"
          button-icon="i-bx-log-out"
          button-color="red"
          button-variant="ghost"
          button-size="xl"
          no-tooltip
          header="Sign out"
          button-styles="py-4 px-6 text-md rounded-none border-t dark:border-slate-800"
          label="Are you sure you want to sign out of your account?"
          @confirm="authStore.signOut()"
        />
      </div>
    </div>
    <!-- <div class="advert bg-primary-900 p-4 w-20"></div> -->
  </div>
</template>

<script setup lang="ts">
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"

defineProps<{
  value: string
  user: User
  church: Church
}>()

const authStore = useAuthStore()
</script>
