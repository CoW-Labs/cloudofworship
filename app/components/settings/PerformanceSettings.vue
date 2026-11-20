<template>
  <div
    class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%] flex flex-col gap-8"
  >
    <SettingsGroup title="Lite mode">
      <SettingsRow
        label="Lite mode"
        description="One switch for slower computers. Turns on the effects, preview and camera options below that save the most. Switch it off to put them back."
      >
        <CowToggle
          bare
          label="Lite mode"
          :model-value="lite"
          @update:model-value="onLiteChange($event)"
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup title="Screen">
      <SettingsRow
        label="Reduce visual effects"
        description="Drops the blur behind your words and the frosted glass on panels. Slides look a touch flatter and the computer works a lot less."
      >
        <CowToggle
          bare
          label="Reduce visual effects"
          :model-value="settings.reduceEffects"
          @update:model-value="onReduceEffectsChange($event)"
        />
      </SettingsRow>

      <SettingsRow
        label="Still video in preview"
        description="The small preview shows one frame of a video while the projector plays it. Your computer decodes the video once, not twice."
      >
        <CowToggle
          bare
          label="Still video in preview"
          :model-value="settings.stillPreviewVideo"
          @update:model-value="onStillPreviewChange($event)"
        />
      </SettingsRow>
    </SettingsGroup>

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

      <SettingsRow
        label="Camera quality"
        description="Auto uses up to 1080p. 720p is a quarter of the work for the camera, the screen and anyone watching it, and still looks sharp on a projector."
      >
        <SettingsSelect
          :options="cameraQualityOptions"
          value-attribute="key"
          option-attribute="label"
          :model-value="settings.cameraResolution"
          @change="onCameraResolutionChange($event)"
        />
      </SettingsRow>

      <SettingsRow
        label="Share cameras with teammates"
        description="Lets teammates see this computer's cameras on their own screens. Each person watching costs this computer a little more work, so switch it off if it is struggling."
      >
        <CowToggle
          bare
          label="Share cameras with teammates"
          :model-value="settings.shareCameraWithTeam"
          @update:model-value="onShareCameraChange($event)"
        />
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia"
import { useAppStore } from "~/store/app"
import type { CameraResolutionSetting } from "~/utils/performanceSettings"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const { settings, lite, update, setLite } = usePerformanceSettings()

const cameraQualityOptions = [
  { key: "auto", label: "Auto (up to 1080p)" },
  { key: "720p", label: "720p" },
]

onMounted(() => {
  usePosthogCapture("PERFORMANCE_SETTINGS_OPENED", { lite: lite.value })
})

const setKeepCameraOn = (on: boolean) => {
  appStore.setAppSettings({ ...appStore.currentState.settings, keepCameraOn: on })
  // Each window's camera code watches this and stops its own idle cameras.
  usePosthogCapture("KEEP_CAMERA_ON_CHANGED", { on })
}

const onLiteChange = (on: boolean) => {
  if (on === lite.value) return
  setLite(on)
  usePosthogCapture("LITE_MODE_CHANGED", { on })
}

const onReduceEffectsChange = (on: boolean) => {
  if (on === settings.value.reduceEffects) return
  update({ reduceEffects: on })
  usePosthogCapture("REDUCE_EFFECTS_CHANGED", { on })
}

const onStillPreviewChange = (on: boolean) => {
  if (on === settings.value.stillPreviewVideo) return
  update({ stillPreviewVideo: on })
  usePosthogCapture("STILL_PREVIEW_VIDEO_CHANGED", { on })
}

const onCameraResolutionChange = (resolution: CameraResolutionSetting) => {
  if (resolution === settings.value.cameraResolution) return
  update({ cameraResolution: resolution })
  usePosthogCapture("CAMERA_RESOLUTION_CHANGED", { resolution })
}

const onShareCameraChange = (on: boolean) => {
  if (on === settings.value.shareCameraWithTeam) return
  update({ shareCameraWithTeam: on })
  usePosthogCapture("CAMERA_SHARING_CHANGED", { on })
}
</script>
