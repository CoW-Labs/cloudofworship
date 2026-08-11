<template>
  <div
    class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%] flex flex-col gap-8"
  >
    <!-- ALERT SETTINGS -->
    <SettingsGroup title="Alert Settings">
      <SettingsSlider
        label="Default alert limit"
        :description="`Currently ${currentState.settings.alertLimit ?? 5} alerts.`"
        :model-value="currentState.settings.alertLimit ?? 5"
        :min="5"
        :max="30"
        :step="1"
        @change="updateSetting('alertLimit', Number($event))"
      />
    </SettingsGroup>

    <!-- TRANSCRIPTION SETTINGS -->
    <SettingsGroup title="Transcription Settings">
      <SettingsRow
        label="Automatic transcription actions"
        description="Automatically open detected Bible references and respond to sermon voice navigation commands while transcribing."
      >
        <CowToggle
          bare
          label="Automatic transcription actions"
          :model-value="currentState.settings.transcriptionAutoActions ?? true"
          @update:model-value="updateSetting('transcriptionAutoActions', $event)"
        />
      </SettingsRow>

      <SettingsRow
        label="Voice Bible version changes"
        description="Let commands like “switch to NIV” change the active Bible slide to a downloaded Bible version."
        :disabled="!(currentState.settings.transcriptionAutoActions ?? true)"
      >
        <CowToggle
          bare
          label="Voice Bible version changes"
          :disabled="!(currentState.settings.transcriptionAutoActions ?? true)"
          :model-value="
            currentState.settings.transcriptionVoiceBibleVersionCommands ?? true
          "
          @update:model-value="
            updateSetting('transcriptionVoiceBibleVersionCommands', $event)
          "
        />
      </SettingsRow>
    </SettingsGroup>
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
