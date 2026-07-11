<template>
  <Transition>
    <div
      class="navbar-ctn relative h-[50px] w-[100%] flex justify-between items-center px-4"
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
        <!-- TEST-ONLY: trigger the upgrade/plan modal -->
        <UButton
          variant="soft"
          color="primary"
          size="2xs"
          class="ml-1"
          @click="useGlobalEmit('show-upgrade-modal')"
        >
          Test modal
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
        <div
          v-if="onlineUsersExcludingSelf.length > 0"
          class="online-users-ctn flex items-center relative left-6"
        >
          <UTooltip>
            <template #text>
              <div class="text-sm">
                <div
                  v-for="user in onlineUsersExcludingSelf"
                  :key="user.userId"
                  class="py-0.5"
                >
                  {{ user.userName }}
                </div>
              </div>
            </template>
            <div class="flex items-center gap-1 mr-2">
              <div class="flex -space-x-2">
                <div
                  class="relative h-8 w-8 grid place-items-center transition-all duration-200 ease-out hover:z-50 hover:translate-x-1"
                  v-for="(user, index) in displayOnlineUsers"
                  :key="user.userId"
                  :style="{
                    zIndex: displayOnlineUsers.length - index,
                  }"
                >
                  <UAvatar
                    :src="user.avatar"
                    :alt="user.userName"
                    :text="
                      !user.avatar
                        ? user.userName?.charAt(0)?.toUpperCase()
                        : undefined
                    "
                    size="sm"
                    class="ring-2 transition-all duration-200 cursor-pointer hover:scale-110"
                    :class="{ 'grayscale opacity-50': !online }"
                    :style="{
                      '--tw-ring-color': user?.theme || '#6366f1',
                      backgroundColor: user?.theme || '#6366f1',
                      color: !user.avatar
                        ? user?.theme || '#6366f1'
                        : undefined,
                    }"
                  />
                  <span
                    v-if="online"
                    class="animate-ping absolute inline-flex h-[70%] w-[70%] rounded-full bg-green-400 opacity-75"
                  ></span>
                </div>
              </div>
              <span
                v-if="onlineUsersExcludingSelf.length > 3"
                class="text-xs text-gray-500 ml-1"
              >
                +{{ onlineUsersExcludingSelf.length - 3 }}
              </span>
            </div>
          </UTooltip>
        </div>
        <UTooltip v-else-if="!online" text="You are offline">
          <UButton
            variant="ghost"
            class="h-10 w-48 opacity-65 transition-all"
            :class="{ 'w-12': !online }"
          >
            <IconWrapper
              v-show="!online"
              name="i-tabler-cloud-off"
            ></IconWrapper>
          </UButton>
        </UTooltip>

        <!-- INVITE PEOPLE BUTTON -->
        <UTooltip text="Invite church media team">
          <CowButton
            variant="primary"
            size="sm"
            class="!px-4 gap-1.5"
            @click="handleInviteClick"
          >
            <UserIcon class="w-4 h-4" />
            Invite
          </CowButton>
        </UTooltip>

        <!-- DARK / LIGHT MODE TOGGLE (sliding switch) -->
        <ClientOnly>
          <button
            type="button"
            class="theme-toggle relative flex items-center w-[60px] h-8 rounded-full bg-gray-100 dark:bg-[#171d2b] transition-colors"
            role="switch"
            :aria-checked="isDark"
            aria-label="Toggle dark mode"
            @click="setDark(!isDark)"
          >
            <span
              class="theme-toggle__thumb absolute top-[3px] left-[3px] w-[26px] h-[26px] rounded-full grid place-items-center transition-transform duration-300 ease-out"
              :class="isDark ? 'translate-x-[28px] bg-white' : 'translate-x-0 bg-gray-900'"
            >
              <LightModeIcon v-if="!isDark" class="w-3.5 h-3.5 text-white" />
              <DarkModeIcon v-else class="w-3.5 h-3.5 text-gray-900" />
            </span>
            <LightModeIcon
              class="absolute left-[8px] w-3.5 h-3.5 transition-opacity duration-200"
              :class="isDark ? 'opacity-40 text-gray-400' : 'opacity-0'"
            />
            <DarkModeIcon
              class="absolute right-[8px] w-3.5 h-3.5 transition-opacity duration-200"
              :class="isDark ? 'opacity-0' : 'opacity-40 text-gray-400'"
            />
          </button>
          <template #fallback>
            <div class="w-[60px] h-8" />
          </template>
        </ClientOnly>

        <!-- ACCOUNT PROFILE + MENU -->
        <UPopover
          mode="click"
          :ui="{
            ring: 'ring-0',
            background: 'bg-white dark-bg-gray-900 border-0',
          }"
        >
          <button class="flex items-center gap-1.5 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#171d2b] transition-colors">
            <UAvatar
              :src="user?.avatar"
              :text="user?.fullname?.split(' ')?.[0]?.[0]"
              size="sm"
              :ui="{
                text: `text-[${user?.theme}] dark:text-[${user?.theme}] font-semibold`,
              }"
              :class="`border-[${user?.theme}] bg-[${user?.theme}20] dark:bg-[${user?.theme}20]`"
            />
            <UIcon name="i-bx-menu" class="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </button>
          <template #panel>
            <ProfileMiniModal
              :user="user"
              :church="church"
              @open-settings="settingsModalOpen = true"
            />
          </template>
        </UPopover>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"

const route = useRoute()
const settingsModalOpen = ref(false)
const settingsPage = ref("")
const colorMode = useColorMode()
const authStore = useAuthStore()
const appStore = useAppStore()
const inviteModalVisible = ref(false)
const scheduleModalVisible = ref(false)
const shortcutsModalVisible = ref(false)

// Subscription check
const { hasAccessToFeature } = useSubscription()
const { isEnabled: isPremiumFeatureEnabled } = useFeatureFlags("teams")

const { user, church } = storeToRefs(authStore)
const { currentState } = storeToRefs(appStore)

// Online users in the SAME schedule, excluding the current user.
// Users collaborating on a different schedule must not appear here. We only
// drop a user when they carry a scheduleId that differs from the active one,
// so a missing/blank scheduleId from the server falls back to showing them.
const onlineUsersExcludingSelf = computed(() => {
  const activeScheduleId = currentState.value.activeSchedule?._id
  return (
    currentState.value.onlineUsers?.filter((u) => {
      if (u.userId === user.value?._id) return false
      if (u.scheduleId && activeScheduleId) {
        return u.scheduleId === activeScheduleId
      }
      return true
    }) || []
  )
})

// Show max 5 avatars in the navbar
const displayOnlineUsers = computed(() =>
  onlineUsersExcludingSelf.value
    .map((user) => ({
      ...user,
      theme: user.theme?.replace("##", "#"),
    }))
    .slice(0, 5)
)

const handleInviteClick = () => {
  if (isPremiumFeatureEnabled.value) {
    if (hasAccessToFeature("open-invite-modal")) {
      inviteModalVisible.value = true
    } else {
      // Show upgrade modal
      useGlobalEmit("show-upgrade-modal")
      usePosthogCapture("UPGRADE_PROMPT_SHOWN", {
        feature: "Invite to Workspace",
        location: "navbar",
      })
    }
  } else {
    inviteModalVisible.value = true
    usePosthogCapture("OPEN_INVITE_MODAL")
  }
}

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

// Explicit theme setter for the segmented toggle (each half targets one mode)
const setDark = (dark: boolean) => {
  colorMode.preference = dark ? "dark" : "light"
}

onMounted(() => {
  if (!currentState.value?.activeSchedule) {
    scheduleModalVisible.value = true
  }
})

const emitter = (useNuxtApp().$emitter || appStore.currentState.emitter) as
  | Emitter<any>
  | undefined

emitter?.on("close-modal", () => {
  settingsModalOpen.value = false
  settingsPage.value = ""
})

emitter?.on("open-settings", (data) => {
  settingsModalOpen.value = true
  settingsPage.value = data
  usePosthogCapture("OPEN_SETTINGS_MODAL")
})

emitter?.on("open-shortcuts", (data) => {
  shortcutsModalVisible.value = true
})

emitter?.on("open-schedule-modal", (data) => {
  scheduleModalVisible.value = true
})

emitter?.on("open-invite-modal", () => {
  inviteModalVisible.value = true
  usePosthogCapture("OPEN_INVITE_MODAL")
})

emitter?.on("toggle-dark-mode", () => {
  isDark.value = !isDark.value
  usePosthogCapture("TOGGLE_DARK_MODE", {
    mode: isDark.value ? "dark" : "light",
  })
})

emitter?.on("join-community", () => {
  window.open("https://chat.whatsapp.com/DeQX11igCSU6YaOoTqY7GY", "_blank")
})

emitter?.on("sign-out", () => {
  authStore.signOut()
})
</script>

<style scoped>
/* User joined popup zoom-in animation */
.user-joined-enter-active {
  animation: zoom-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.user-joined-leave-active {
  animation: zoom-out 0.2s ease-out;
}

@keyframes zoom-in {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes zoom-out {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  100% {
    opacity: 0;
    transform: scale(0.8) translateY(-10px);
  }
}

/* Dark/light toggle — CowButton-style solid ledge that compresses on press.
   Ledge depth (5px) and press travel (4px) match CowButton's primary/sm
   variant (the Invite button) so the two feel like the same height. */
.theme-toggle {
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12), 0 5px 0 0 #cbd5e1,
    0 10px 16px -10px rgba(15, 23, 42, 0.35);
  transition: transform 0.08s ease, box-shadow 0.08s ease,
    background-color 0.2s ease;
  will-change: transform;
}

.theme-toggle:active {
  transform: translateY(4px);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.12), 0 1px 0 0 #cbd5e1;
}

html.dark .theme-toggle {
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 5px 0 0 #0d1320,
    0 10px 16px -10px rgba(0, 0, 0, 0.6);
}

html.dark .theme-toggle:active {
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 1px 0 0 #0d1320;
}

/* Avatar zoom-in animation for the avatar list */
.avatar-zoom-enter-active {
  animation: avatar-zoom-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.avatar-zoom-leave-active {
  animation: avatar-zoom-out 0.2s ease-out;
}

@keyframes avatar-zoom-in {
  0% {
    opacity: 0;
    transform: scale(0);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes avatar-zoom-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0);
  }
}
</style>
