<template>
  <div
    class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%] flex flex-col gap-8"
  >
    <SettingsGroup title="Camera">
      <SettingsRow
        label="Keep camera on"
        description="Keep a camera running after its slide leaves the screen, so it is ready the moment you return. Turn off on slower computers or to free a capture card for other apps."
      >
        <CowToggle
          bare
          label="Keep camera on"
          :model-value="currentState.settings.keepCameraOn !== false"
          @update:model-value="setKeepCameraOn($event)"
        />
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia"
import { useAppStore } from "~/store/app"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const setKeepCameraOn = (on: boolean) => {
  appStore.setAppSettings({ ...appStore.currentState.settings, keepCameraOn: on })
  // Each window's camera code watches this and stops its own idle cameras.
  usePosthogCapture("KEEP_CAMERA_ON_CHANGED", { on })
}
</script>
