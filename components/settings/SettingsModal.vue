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
            <!-- ACCOUNT SETTINGS -->
            <div
              class="settings-ctn h-[100%]"
              v-if="activeTab === 'Account Settings'"
            >
              <EmptyState
                icon="i-mdi-timer-sand-empty"
                sub="Nothing to see for now"
                action=""
                action-text=""
                class="pb-4"
              />
            </div>
            <!-- PROFILE SETTINGS -->
            <ProfileSettings v-else-if="activeTab === 'Profile Settings'" />
            <!-- DISPLAY SETTINGS -->
            <DisplaySettings v-else-if="activeTab === 'Display Settings'" />
            <!-- SLIDE SETTINGS -->
            <SlideSettings
              v-else-if="activeTab === 'Slide Settings'"
              @select-active-tab="activeTab = $event"
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
const props = defineProps<{
  isOpen: boolean
  page: string
}>()

const settingsModalOpen = ref(props.isOpen)
const tabs = [
  { name: "Account Settings", active: false },
  { name: "Profile Settings", active: false },
  { name: "Display Settings", active: false },
  { name: "Slide Settings", active: false },
  { name: "Bible Version Settings", active: false },
  { name: "Storage Settings", active: false },
  { name: "Other Settings", active: false },
]
const activeTab = ref(props.page || "Slide Settings")

watch(
  () => props.isOpen,
  () => {
    settingsModalOpen.value = props.isOpen
    if (props.isOpen) {
      activeTab.value = props.page || "Slide Settings"
    }
  }
)
</script>
