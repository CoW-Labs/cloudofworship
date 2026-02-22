<template>
  <UModal
    fullscreen
    v-model="settingsModalOpen"
    @close="$emit('close-modal')"
    :ui="{
      rounded: 'rounded-xl',
      fullscreen: 'w-[80vw] max-w-[900px] h-auto rounded-xl',
      // width: 'w-[1000px] sm:max-w-lg',
    }"
  >
    <AppSection
      heading="App Settings"
      class="border-0"
      heading-styles="text-lg font-semibold"
      :secondary-buttons="[
        {
          label: '',
          action: 'close-modal',
          icon: 'i-mdi-close',
          color: 'primary',
          confirmAction: false,
          visible: true,
          variant: 'ghost',
        },
      ]"
    >
      <div class="flex gap-2 w-[100%] h-[100%]">
        <div class="lhs min-w-[220px] flex flex-col gap-1 h-[100%]">
          <UButton
            v-for="tab in tabs"
            variant="ghost"
            block
            size="lg"
            class="justify-start text-black dark:text-white"
            :class="[
              {
                'text-white bg-primary-500 hover:bg-primary-500':
                  activeTab === tab.name,
              },
            ]"
            @click="activeTab = tab.name"
          >
            {{ tab?.name }}
          </UButton>
        </div>
        <div class="rhs w-[100%] rounded-lg p-6 pt-2 h-[600px]">
          <!-- SUB-SETTINGS HEADER -->
          <h3 class="font-semibold text-lg mb-4">
            {{ activeTab }}
          </h3>
          <Transition name="fade-sm">
            <!-- ACCOUNT & PROFILE SETTINGS -->
            <ProfileSettings v-if="activeTab === 'Account/Profile Settings'" />
            <!-- SUBSCRIPTION SETTINGS -->
            <SubscriptionSettings
              v-else-if="activeTab === 'Subscription Settings'"
            />
            <!-- DISPLAY SETTINGS -->
            <DisplaySettings v-else-if="activeTab === 'Display Settings'" />
            <!-- SLIDE SETTINGS -->
            <SlideSettings
              v-else-if="activeTab === 'Slide Settings'"
              @select-active-tab="activeTab = $event"
            />
            <!-- BACKGROUND SETTINGS -->
            <BackgroundSettings
              v-else-if="activeTab === 'Slide Background Settings'"
            />
            <!-- BIBLE VERSION SETTINGS -->
            <BibleVersionSettings
              v-else-if="activeTab === 'Bible Version Settings'"
            />
            <!-- STORAGE SETTINGS -->
            <StorageSettings v-else-if="activeTab === 'Storage Settings'" />

            <!-- OTHER SETTINGS -->
            <OtherSettings v-else-if="activeTab === 'Other Settings'" />
          </Transition>
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
const { fetchUserSettings, saveSettingsLocally, debouncedSaveSettings } = useUserSettings()
const settingsModalOpen = ref(props.isOpen)
const tabs = [
  { name: "Account/Profile Settings", active: false },
  { name: "Subscription Settings", active: false },
  { name: "Display Settings", active: false },
  { name: "Slide Settings", active: false },
  { name: "Slide Background Settings", active: false },
  { name: "Bible Version Settings", active: false },
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
