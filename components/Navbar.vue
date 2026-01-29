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
                <TransitionGroup name="user-joined">
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
                </TransitionGroup>
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

        <!-- ACCOUNT PROFILE BUTTON -->
        <UPopover
          mode="click"
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
            @click="handleInviteClick"
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

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { appWideActions } from "~/utils/constants"

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

// Online users (excluding current user)
const onlineUsersExcludingSelf = computed(
  () =>
    currentState.value.onlineUsers?.filter(
      (u) => u.userId !== user.value?._id
    ) || []
)

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
