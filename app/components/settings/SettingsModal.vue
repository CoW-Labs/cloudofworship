<template>
  <UModal
    fullscreen
    v-model="settingsModalOpen"
    @close="$emit('close-modal')"
    :ui="{
      rounded: 'rounded-2xl',
      background: 'bg-transparent dark:bg-transparent',
      ring: '',
      shadow: 'shadow-none',
      base: 'relative text-left rtl:text-right flex flex-col overflow-hidden',
      inner: 'fixed inset-0 overflow-hidden',
      fullscreen:
        'w-[94vw] sm:w-[92vw] lg:w-[80vw] max-w-[900px] h-[85vh] max-h-[680px] rounded-2xl',
      overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
    }"
  >
    <AppSection heading="App Settings" heading-styles="text-lg font-semibold">
      <template #actions>
        <button
          class="grid h-8 w-8 place-items-center rounded-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#222938]"
          aria-label="Close settings"
          @click="$emit('close-modal')"
        >
          <CloseIcon
            class="block h-4 w-4 text-gray-600 dark:text-[#a7afbd]"
          />
        </button>
      </template>

      <div class="flex flex-col lg:flex-row gap-3 w-full h-full">
        <div
          class="lhs w-full lg:w-[230px] shrink-0 flex flex-row lg:flex-col gap-1 h-auto lg:h-full rounded-2xl bg-[#f1f3f6] dark:bg-[#1b212e] p-1.5 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto"
        >
          <button
            v-for="tab in tabs"
            :key="tab.name"
            class="settings-tab w-auto lg:w-full shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors"
            :class="
              activeTab === tab.name
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-white dark:text-[#a7afbd] dark:hover:bg-[#222938]'
            "
            @click="activeTab = tab.name"
          >
            {{ tab?.name }}
          </button>
        </div>
        <div
          class="rhs relative flex-1 min-w-0 min-h-0 rounded-2xl px-1 sm:px-3 lg:px-5 pt-1 h-full overflow-clip"
        >
          <div
            id="settings-modal-device-action"
            class="pointer-events-none absolute bottom-6 right-6 z-50"
          ></div>
          <div class="flex h-full min-h-0 flex-col">
            <!-- SUB-SETTINGS HEADER -->
            <h3
              class="shrink-0 font-semibold text-lg mb-4 text-gray-900 dark:text-white"
            >
              {{ activeTab }}
            </h3>
            <div class="min-h-0 flex-1 overflow-clip">
              <Transition name="fade-sm">
                <!-- ACCOUNT & PROFILE SETTINGS -->
                <ProfileSettings
                  v-if="activeTab === 'Account/Profile Settings'"
                />
                <!-- SUBSCRIPTION SETTINGS -->
                <SubscriptionSettings
                  v-else-if="activeTab === 'Subscription Settings'"
                />
                <!-- DISPLAY SETTINGS -->
                <DisplaySettings v-else-if="activeTab === 'Display Settings'" />
                <!-- CAMERA & MIC SETTINGS -->
                <CameraAndMicSettings
                  v-else-if="activeTab === 'Microphone Settings'"
                />
                <!-- SLIDE SETTINGS -->
                <SlideSettings
                  v-else-if="activeTab === 'Slide Settings'"
                  @select-active-tab="activeTab = $event"
                />
                <!-- OVERLAY SETTINGS -->
                <OverlaySettings v-else-if="activeTab === 'Overlay Settings'" />
                <!-- BACKGROUND SETTINGS -->
                <BackgroundSettings
                  v-else-if="activeTab === 'Slide Background Settings'"
                />
                <!-- BLANK SETTINGS -->
                <IntermissionSettings
                  v-else-if="activeTab === 'Blank Settings'"
                />
                <!-- BIBLE SLIDE SETTINGS -->
                <BibleVersionSettings
                  v-else-if="activeTab === 'Bible Slide Settings'"
                />
                <!-- STORAGE SETTINGS -->
                <StorageSettings v-else-if="activeTab === 'Storage Settings'" />

                <!-- OTHER SETTINGS -->
                <OtherSettings v-else-if="activeTab === 'Other Settings'" />
              </Transition>
            </div>
          </div>
        </div>
      </div>
    </AppSection>
  </UModal>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

const props = defineProps<{
  isOpen: boolean
  page: string
}>()

const appStore = useAppStore()
const { fetchUserSettings, saveSettingsLocally, debouncedSaveSettings } =
  useUserSettings()
const settingsModalOpen = ref(props.isOpen)
const tabs = [
  { name: "Account/Profile Settings", active: false },
  { name: "Subscription Settings", active: false },
  { name: "Display Settings", active: false },
  { name: "Microphone Settings", active: false },
  { name: "Slide Settings", active: false },
  { name: "Overlay Settings", active: false },
  { name: "Slide Background Settings", active: false },
  { name: "Blank Settings", active: false },
  { name: "Bible Slide Settings", active: false },
  { name: "Storage Settings", active: false },
  { name: "Other Settings", active: false },
]
const activeTab = ref(props.page || "Slide Settings")

watch(
  () => props.isOpen,
  async () => {
    settingsModalOpen.value = props.isOpen
    if (props.isOpen) {
      activeTab.value = props.page || "Slide Settings"

      // Fetch latest user settings when modal opens.
      // fetchUserSettings will skip the update if there was a recent local save,
      // preventing stale server data from overwriting in-progress user edits.
      await fetchUserSettings()
    }
  }
)

// Watch for changes in settings and save
watch(
  () => appStore.currentState.settings,
  (newSettings) => {
    if (settingsModalOpen.value) {
      // Save locally immediately so the change is never lost
      saveSettingsLocally(newSettings)
      // Debounce the online save to once every 3 seconds
      debouncedSaveSettings()
    }
  },
  { deep: true }
)
</script>
