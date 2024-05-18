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
            class="justify-start text-black"
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
        <div
          class="rhs w-[100%] border border-gray-100 rounded-lg p-6 min-h-[600px]"
        >
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
            <div
              class="settings-ctn h-[100%]"
              v-else-if="activeTab === 'Profile Settings'"
            >
              <EmptyState
                icon="i-mdi-timer-sand-empty"
                sub="Nothing to see for now"
                action=""
                action-text=""
                class="pb-4"
              />
            </div>
            <!-- SLIDE SETTINGS -->
            <div
              class="settings-ctn h-[100%]"
              v-else-if="activeTab === 'Slide Settings'"
            >
              <UForm>
                <UFormGroup label="Set default font">
                  <USelectMenu
                    class="border-0 shadow-none w-[200px]"
                    searchable
                    searchable-placeholder="Search fonts"
                    select-class="w-[200px] bg-primary-100 dark:bg-primary-800 dark:text-white"
                    size="md"
                    :options="appFonts"
                    :model-value="appStore.settings.defaultFont"
                    variant="none"
                    color="primary"
                    clear-search-on-close
                    :ui="selectUI"
                    :ui-menu="selectMenuUI"
                    @change="appStore.setDefaultFont($event)"
                  >
                    <template #label>
                      <IconWrapper name="i-bx-font-family" size="4">
                      </IconWrapper>
                      <span
                        v-if="font?.length"
                        class="truncate"
                        :class="
                          useURLFriendlyString(appStore.settings.defaultFont)
                        "
                        >{{ appStore.settings.defaultFont }}</span
                      >
                      <span v-else>Select font</span>
                    </template>
                    <template #option="{ option: font }">
                      <span
                        v-if="font?.length"
                        class="truncate"
                        :class="useURLFriendlyString(font)"
                        >{{ font }}</span
                      >
                      <span v-else>Select font</span>
                    </template>
                  </USelectMenu>
                </UFormGroup>
                <UFormGroup label="Set default Bible Version" class="mt-4">
                  <USelectMenu
                    class="border-0 shadow-none max-w-[200px]"
                    searchable
                    searchable-placeholder="Search version"
                    select-class="w-[200px] bg-primary-100 dark:bg-primary-800 dark:text-white"
                    size="md"
                    :options="bibleVersions"
                    :model-value="appStore.settings.defaultBibleVersion"
                    variant="none"
                    color="primary"
                    clear-search-on-close
                    :ui="selectUI"
                    :ui-menu="selectMenuUI"
                    @change="appStore.setDefaultBibleVersion($event)"
                  />
                </UFormGroup>
              </UForm>
            </div>
            <!-- STORAGE SETTINGS -->
            <div
              class="settings-ctn h-[100%]"
              v-else-if="activeTab === 'Storage Settings'"
            >
              <EmptyState
                icon="i-mdi-timer-sand-empty"
                sub="Nothing to see for now"
                action=""
                action-text=""
                class="pb-4"
              />
            </div>
          </Transition>
        </div>
      </div>
    </AppSection>
  </UModal>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"

const props = defineProps<{
  isOpen: boolean
}>()

const appStore = useAppStore()
const settingsModalOpen = ref(props.isOpen)
const tabs = [
  { name: "Account Settings", active: false },
  { name: "Profile Settings", active: false },
  { name: "Slide Settings", active: false },
  { name: "Storage Settings", active: false },
]
const activeTab = ref("Slide Settings")
const font = ref(appStore.settings.defaultFont)
const bibleVersion = ref(appStore.settings.defaultBibleVersion)
const selectUI = {
  base: "bg-primary-500",
  input: "bg-primary-500",
  color: {
    primary: {
      outline: "shadow-sm bg-primary-500 ",
    },
  },
}
const selectMenuUI = {
  width: "w-[200px]",
  input: "text-xs",
  empty: "text-xs",
  option: {
    size: "text-xs",
  },
}

watch(
  () => props.isOpen,
  () => {
    settingsModalOpen.value = props.isOpen
  }
)
</script>
