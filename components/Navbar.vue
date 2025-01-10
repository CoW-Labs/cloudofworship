<template>
  <Transition>
    <div
      class="navbar-ctn relative h-[50px] w-[100%] border-b border-gray-100 dark:border-primary-950 flex justify-between items-center px-4 dark:border-primary-900"
      v-if="route.name !== 'live'"
    >
      <UProgress
        class="absolute inset-0 top-auto rounded-none opacity-0"
        :class="{ 'opacity-1': currentState.slidesLoading && online }"
        size="xs"
      />
      <div class="logo flex items-center gap-2 w-[310px]">
        <Logo class="w-[38px]" />
        <h1 class="text-md font-semibold">Cloud of Worship</h1>
        <UButton
          class="version-chip flex text-xs font-semibold bg-primary-200 p-2 py-1 rounded-full border border-transparent hover:bg-primary-300 hover:border-primary-900 transition-all text-primary-900"
          @click="useGlobalEmit(appWideActions.showChangelog)"
        >
          {{ appVersion }}
        </UButton>
      </div>
      <div class="projects-ctn">
        <!-- <IconWrapper name="i-bx-spinner-dots" v-if="slidesAndScheduleLoading" /> -->
        <UButton
          variant="ghost"
          color="gray"
          size="xs"
          trailing-icon="i-bx-chevron-down"
          @click="scheduleModalVisible = true"
        >
          {{ currentState.activeSchedule?.name || "Untitled" }}
        </UButton>
      </div>
      <div
        class="actions text-sm flex gap-2 items-center justify-end w-[310px]"
      >
        <SettingsModal
          :is-open="settingsModalOpen"
          :page="settingsPage"
          @close-modal="settingsModalOpen = false"
        />

        <ScheduleModal
          :visible="scheduleModalVisible"
          :active-schedule="currentState.activeSchedule"
          @close="scheduleModalVisible = false"
        />

        <InviteUsersModal
          :visible="inviteModalVisible"
          @close="inviteModalVisible = false"
        />

        <ChangelogModal :app-version="appVersion" />

        <ShortcutsModal
          :visible="shortcutsModalVisible"
          @close="shortcutsModalVisible = false"
        />

        <!-- ONLINE/OFFLINE NOTIFIER currently just based on network connected status -->
        <UTooltip :text="online ? 'Force sync' : 'You are offline'">
          <UButton
            variant="ghost"
            class="h-10 w-48 opacity-65 transition-all"
            :class="{ 'w-12': !online }"
            @click="useGlobalEmit(appWideActions.refreshSlides)"
          >
            <div v-show="online" class="last-synced-ctn flex">
              <UButton variant="ghost" class="h-10">
                <IconWrapper
                  name="i-tabler-refresh"
                  :class="{ 'animate-spin': currentState.slidesLoading }"
                />
                <span class="text-xs">
                  Last sync:
                  <span class="font-bold capitalize">
                    {{ new Date(currentState.lastSynced).toLocaleTimeString() }}
                  </span>
                </span>
              </UButton>
            </div>
            <IconWrapper
              v-show="!online"
              name="i-tabler-cloud-off"
            ></IconWrapper>
          </UButton>
        </UTooltip>

        <!-- ACCOUNT PROFILE BUTTON -->
        <UPopover
          mode="click"
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
              :src="user?.avatar"
              :text="user?.fullname?.split(' ')?.[0]?.[0]"
              size="sm"
              :ui="{
                text: `text-[${user?.theme}] dark:text-[${user?.theme}] font-semibold`,
              }"
              :class="`border-[${user?.theme}] bg-[${user?.theme}20] dark:bg-[${user?.theme}20]`"
            />
          </UButton>
          <template #panel>
            <ProfileMiniModal
              :user="user"
              :church="church"
              @open-settings="settingsModalOpen = true"
            />
          </template>
        </UPopover>

        <!-- INVITE PEOPLE BUTTON -->
        <UTooltip text="Invite church media team">
          <UButton
            variant="outline"
            class="h-8"
            icon="i-bx-user-plus"
            @click="inviteModalVisible = true"
          >
            Invite
          </UButton>
        </UTooltip>

        <!-- DARK / LIGHT MODE TOGGLE -->
        <ClientOnly>
          <UButton
            :icon="isDark ? 'i-tabler-moon-filled' : 'i-tabler-sun-filled'"
            color="primary"
            variant="ghost"
            aria-label="Theme"
            class="h-10"
            @click="isDark = !isDark"
            >{{ isDark ? "Light" : "Dark" }}</UButton
          >
          <template #fallback>
            <div class="w-8 h-8" />
          </template>
        </ClientOnly>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { appWideActions } from "~/utils/constants"
const route = useRoute()
const darkMode = ref(false)
const settingsModalOpen = ref(false)
const settingsPage = ref("")
const colorMode = useColorMode()
const authStore = useAuthStore()
const appStore = useAppStore()
const inviteModalVisible = ref(false)
const scheduleModalVisible = ref(false)
const shortcutsModalVisible = ref(false)

const { user, church } = storeToRefs(authStore)
const { currentState } = storeToRefs(appStore)

defineProps({
  appVersion: String,
  online: Boolean,
})

const isDark = computed({
  get() {
    return colorMode.value === "dark"
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark"
  },
})

onMounted(() => {
  if (!currentState.value?.activeSchedule) {
    scheduleModalVisible.value = true
  }
})

const emitter = useNuxtApp().$emitter || appStore.currentState.emitter

emitter?.on("close-modal", () => {
  settingsModalOpen.value = false
  settingsPage.value = ""
})

emitter?.on("open-settings", (data) => {
  settingsModalOpen.value = true
  settingsPage.value = data
})

emitter?.on("open-shortcuts", (data) => {
  shortcutsModalVisible.value = true
})

emitter?.on("open-schedule-modal", (data) => {
  scheduleModalVisible.value = true
})

emitter?.on("open-invite-modal", () => {
  inviteModalVisible.value = true
})

emitter?.on("toggle-dark-mode", () => {
  isDark.value = !isDark.value
})
</script>

<style scoped></style>
