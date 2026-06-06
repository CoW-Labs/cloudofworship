<template>
  <div class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] pb-[15%]">
    <!-- ALERT SETTINGS -->
    <div class="settings-group">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">Alert Settings</h3>
      </div>
      <UFormGroup
        label="Set default alert limit"
        class="flex items-center justify-between px-2 py-1 hover:bg-primary/10"
      >
        <div
          class="flex px-0 items-center gap-2 font-semibold max-w-[200px] mt-2"
        >
          <span class="text-sm whitespace-nowrap">5</span>
          <URange
            :model-value="currentState.settings.alertLimit ?? 5"
            :min="5"
            :max="30"
            :step="1"
            @change="updateSetting('alertLimit', Number($event))"
          />
          <span class="text-sm whitespace-nowrap"> 30</span>
        </div>
        <div class="text-xs mt-2 text-gray-500">
          Current Alert Limit:
          {{ currentState.settings.alertLimit }} alerts
        </div>
      </UFormGroup>
    </div>

    <UDivider class="my-6" />

    <!-- TRANSCRIPTION SETTINGS -->
    <div class="settings-group">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">Transcription Settings</h3>
      </div>
      <UFormGroup
        label="Allow automatic transcription actions"
        class="flex flex-col justify-between px-2 py-2 hover:bg-primary/10"
      >
        <div class="flex justify-between w-full">
          <div class="text-xs mt-0 text-gray-500 max-w-[420px]">
            Automatically open detected Bible references and respond to sermon
            voice navigation commands while transcribing.
          </div>
          <UToggle
            size="lg"
            :model-value="
              currentState.settings.transcriptionAutoActions ?? true
            "
            @change="updateSetting('transcriptionAutoActions', $event)"
          />
        </div>
      </UFormGroup>
      <UFormGroup
        label="Allow voice Bible version changes"
        class="flex flex-col justify-between px-2 py-2 hover:bg-primary/10 mt-4"
      >
        <div class="flex justify-between w-full">
          <div class="text-xs mt-0 text-gray-500 max-w-[420px]">
            Let commands like “switch to NIV” change the active Bible slide to a
            downloaded Bible version.
          </div>
          <UToggle
            size="lg"
            :disabled="
              !(currentState.settings.transcriptionAutoActions ?? true)
            "
            :model-value="
              currentState.settings.transcriptionVoiceBibleVersionCommands ??
              true
            "
            @change="
              updateSetting('transcriptionVoiceBibleVersionCommands', $event)
            "
          />
        </div>
      </UFormGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { AppSettings } from "~/types"
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const updateSetting = <K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K]
) => {
  appStore.setAppSettings({
    ...appStore.currentState.settings,
    [key]: value,
  })
}
</script>
