<template>
  <div
    class="settings-ctn h-[100%] flex flex-col gap-8 overflow-y-auto mb-[2.5%] pb-[10%]"
  >
    <!-- ─── MICROPHONE SECTION ─────────────────────────────────── -->
    <div class="microphone-section flex flex-col gap-2">
      <!-- Active microphone card -->
      <div class="sub-header">
        <h3 class="font-medium">Active Microphone</h3>
        <p class="text-xs opacity-50 mb-2 mt-1">
          The microphone used during sermon transcription.
        </p>
      </div>
      <div
        v-if="selectedMicrophone"
        class="bg-primary-100 dark:bg-primary-800 p-4 px-6 rounded-md flex justify-between items-center"
      >
        <div class="info flex gap-4">
          <IconWrapper name="i-bx-microphone" size="6" class="pt-1" />
          <div class="name-and-type">
            <div class="name text-sm font-semibold">
              {{ selectedMicrophone.label || "Unlabeled Microphone" }}
              <span
                class="bg-primary-300 dark:bg-primary-600 text-xs px-2 py-1 rounded-md ml-1"
                >Default</span
              >
            </div>
            <div class="type text-xs opacity-70 mt-0.5">
              {{
                selectedMicrophone.deviceId === "default"
                  ? "System default"
                  : "Audio input"
              }}
            </div>
          </div>
        </div>
      </div>
      <div
        v-else
        class="bg-primary-100 dark:bg-primary-800 p-4 px-6 rounded-md flex items-center gap-4"
      >
        <IconWrapper name="i-bx-microphone" size="6" />
        <div class="text-sm opacity-70">
          No microphone selected — system default will be used
        </div>
      </div>

      <!-- Available microphones list -->
      <div class="flex items-center justify-between mt-2">
        <h3 class="font-medium">Available Microphones</h3>
        <UButton
          size="sm"
          variant="outline"
          leading-icon="i-bx-refresh"
          :loading="isLoadingMic"
          @click="getMicrophoneList"
        >
          Refresh
        </UButton>
      </div>

      <div v-if="micPermissionDenied">
        <UAlert
          color="amber"
          variant="subtle"
          icon="i-bx-error"
          title="Microphone access denied"
          description="Please allow microphone access in your browser settings, then click Refresh."
        />
      </div>
      <div
        v-else-if="!isLoadingMic && microphones.length === 0"
        class="text-center flex flex-col items-center justify-center max-w-[180px] mx-auto mt-4"
      >
        <IconWrapper name="i-bx-microphone-off" size="7" class="pb-2" />
        <div class="text-sm">No microphones detected</div>
      </div>
      <div
        v-for="(mic, index) in microphones"
        :key="mic.deviceId"
        class="p-4 px-6 rounded-md flex justify-between items-center transition-colors"
        :class="
          currentState.defaultMicrophoneId === mic.deviceId
            ? 'bg-primary-100 dark:bg-primary-800'
            : 'bg-gray-100 dark:bg-gray-800'
        "
      >
        <div class="info flex gap-4">
          <IconWrapper
            :name="
              currentState.defaultMicrophoneId === mic.deviceId
                ? 'i-bx-microphone'
                : 'i-bx-microphone-off'
            "
            size="6"
            class="pt-1"
            :class="
              currentState.defaultMicrophoneId === mic.deviceId
                ? 'text-primary-500'
                : ''
            "
          />
          <div class="name-and-type">
            <div class="name text-sm font-semibold">
              {{ mic.label || `Microphone ${index + 1}` }}
            </div>
            <div class="type text-xs opacity-70 mt-0.5">
              {{
                mic.deviceId === "default" ? "System default" : "Audio input"
              }}
            </div>
          </div>
        </div>
        <UCheckbox
          :ui="{ base: 'h-5 w-5', rounded: 'rounded-full' }"
          label="Use as default"
          :model-value="currentState.defaultMicrophoneId === mic.deviceId"
          @change="($event: any) => handleMicSelect($event, mic)"
        />
      </div>
    </div>

    <UDivider />

    <!-- ─── CAMERA SECTION ────────────────────────────────────── -->
    <div class="camera-section flex flex-col gap-2">
      <!-- Active camera card -->
      <div class="sub-header">
        <h3 class="font-medium">Active Camera</h3>
        <p class="text-xs opacity-50 mb-2 mt-1">
          The camera selected as the default for video input.
        </p>
      </div>
      <div
        v-if="selectedCamera"
        class="bg-primary-100 dark:bg-primary-800 p-4 px-6 rounded-md flex justify-between items-center"
      >
        <div class="info flex gap-4">
          <IconWrapper name="i-bx-camera" size="6" class="pt-1" />
          <div class="name-and-type">
            <div class="name text-sm font-semibold">
              {{ selectedCamera.label || "Unlabeled Camera" }}
              <span
                class="bg-primary-300 dark:bg-primary-600 text-xs px-2 py-1 rounded-md ml-1"
                >Default</span
              >
            </div>
            <div class="type text-xs opacity-70 mt-0.5">
              {{
                selectedCamera.deviceId === "default"
                  ? "System default"
                  : "Video input"
              }}
            </div>
          </div>
        </div>
      </div>
      <div
        v-else
        class="bg-primary-100 dark:bg-primary-800 p-4 px-6 rounded-md flex items-center gap-4"
      >
        <IconWrapper name="i-bx-camera" size="6" />
        <div class="text-sm opacity-70">
          No camera selected — system default will be used
        </div>
      </div>

      <!-- Available cameras list -->
      <div class="flex items-center justify-between mt-2">
        <h3 class="font-medium">Available Cameras</h3>
        <UButton
          size="sm"
          variant="outline"
          leading-icon="i-bx-refresh"
          :loading="isLoadingCam"
          @click="getCameraList"
        >
          Refresh
        </UButton>
      </div>

      <div v-if="camPermissionDenied">
        <UAlert
          color="amber"
          variant="subtle"
          icon="i-bx-error"
          title="Camera access denied"
          description="Please allow camera access in your browser settings, then click Refresh."
        />
      </div>
      <div
        v-else-if="!isLoadingCam && cameras.length === 0"
        class="text-center flex flex-col items-center justify-center max-w-[180px] mx-auto mt-4"
      >
        <IconWrapper name="i-bx-camera-off" size="7" class="pb-2" />
        <div class="text-sm">No cameras detected</div>
      </div>
      <div
        v-for="(cam, index) in cameras"
        :key="cam.deviceId"
        class="p-4 px-6 rounded-md flex justify-between items-center transition-colors"
        :class="
          currentState.defaultCameraId === cam.deviceId
            ? 'bg-primary-100 dark:bg-primary-800'
            : 'bg-gray-100 dark:bg-gray-800'
        "
      >
        <div class="info flex gap-4">
          <IconWrapper
            :name="
              currentState.defaultCameraId === cam.deviceId
                ? 'i-bx-camera'
                : 'i-bx-camera-off'
            "
            size="6"
            class="pt-1"
            :class="
              currentState.defaultCameraId === cam.deviceId
                ? 'text-primary-500'
                : ''
            "
          />
          <div class="name-and-type">
            <div class="name text-sm font-semibold">
              {{ cam.label || `Camera ${index + 1}` }}
            </div>
            <div class="type text-xs opacity-70 mt-0.5">
              {{
                cam.deviceId === "default" ? "System default" : "Video input"
              }}
            </div>
          </div>
        </div>
        <UCheckbox
          :ui="{ base: 'h-5 w-5', rounded: 'rounded-full' }"
          label="Use as default"
          :model-value="currentState.defaultCameraId === cam.deviceId"
          @change="($event: any) => handleCamSelect($event, cam)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store/app"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

// ── Microphone state ────────────────────────────────────────────
const microphones = ref<MediaDeviceInfo[]>([])
const isLoadingMic = ref(false)
const micPermissionDenied = ref(false)

const selectedMicrophone = computed(
  () =>
    microphones.value.find(
      (m) => m.deviceId === currentState.value.defaultMicrophoneId
    ) ?? null
)

const getMicrophoneList = async () => {
  isLoadingMic.value = true
  micPermissionDenied.value = false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    const devices = await navigator.mediaDevices.enumerateDevices()
    microphones.value = devices.filter((d) => d.kind === "audioinput")
    // Clear stale selection
    if (
      currentState.value.defaultMicrophoneId &&
      !microphones.value.find(
        (m) => m.deviceId === currentState.value.defaultMicrophoneId
      )
    ) {
      appStore.setDefaultMicrophone("")
    }
  } catch (err: any) {
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      micPermissionDenied.value = true
    } else {
      useToast().add({
        title: "Failed to detect microphones",
        icon: "i-bx-error-circle",
        color: "red",
      })
    }
  }
  isLoadingMic.value = false
}

const handleMicSelect = (checked: boolean, mic: MediaDeviceInfo) => {
  if (checked) {
    appStore.setDefaultMicrophone(mic.deviceId)
    useToast().add({
      title: `"${mic.label || "Microphone"}" set as default`,
      icon: "i-bx-microphone",
    })
  } else {
    appStore.setDefaultMicrophone("")
    useToast().add({ title: "Default microphone cleared", icon: "i-bx-microphone-off" })
  }
}

// ── Camera state ────────────────────────────────────────────────
const cameras = ref<MediaDeviceInfo[]>([])
const isLoadingCam = ref(false)
const camPermissionDenied = ref(false)

const selectedCamera = computed(
  () =>
    cameras.value.find(
      (c) => c.deviceId === currentState.value.defaultCameraId
    ) ?? null
)

const getCameraList = async () => {
  isLoadingCam.value = true
  camPermissionDenied.value = false
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    stream.getTracks().forEach((t) => t.stop())
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices.filter((d) => d.kind === "videoinput")
    // Clear stale selection
    if (
      currentState.value.defaultCameraId &&
      !cameras.value.find(
        (c) => c.deviceId === currentState.value.defaultCameraId
      )
    ) {
      appStore.setDefaultCamera("")
    }
  } catch (err: any) {
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      camPermissionDenied.value = true
    } else {
      useToast().add({
        title: "Failed to detect cameras",
        icon: "i-bx-error-circle",
        color: "red",
      })
    }
  }
  isLoadingCam.value = false
}

const handleCamSelect = (checked: boolean, cam: MediaDeviceInfo) => {
  if (checked) {
    appStore.setDefaultCamera(cam.deviceId)
    useToast().add({
      title: `"${cam.label || "Camera"}" set as default`,
      icon: "i-bx-camera",
    })
  } else {
    appStore.setDefaultCamera("")
    useToast().add({ title: "Default camera cleared", icon: "i-bx-camera-off" })
  }
}

// ── Lifecycle ───────────────────────────────────────────────────
const onDeviceChange = () => {
  getMicrophoneList()
  getCameraList()
}

onMounted(async () => {
  await Promise.all([getMicrophoneList(), getCameraList()])
  navigator.mediaDevices.addEventListener("devicechange", onDeviceChange)
})

onBeforeUnmount(() => {
  navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange)
})
</script>
