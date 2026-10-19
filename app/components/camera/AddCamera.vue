<template>
  <!-- Asking for camera permission here, in the operator window, means the
       /live window (same origin) never shows a prompt on the projector. -->
  <div class="add-camera-main">
    <div class="flex flex-col gap-4 px-1.5 pt-3">
      <p class="text-xs text-gray-500 dark:text-[#7d8695]">
        Shows a webcam or capture card full screen on the Live Output.
      </p>

      <CameraForm v-model="form" show-preview />

      <div class="sticky bottom-0 z-10 pb-6">
        <CowButton
          variant="primary"
          block
          size="lg"
          :disabled="!form.deviceId"
          @click="createCamera"
        >
          Add to schedule
        </CowButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defaultCameraData } from "~/utils/camera"

const emit = defineEmits(["close"])

const form = ref(defaultCameraData())

const createCamera = () => {
  if (!form.value.deviceId) return
  useGlobalEmit(appWideActions.newCamera, { ...form.value })
  emit("close")
}
</script>
