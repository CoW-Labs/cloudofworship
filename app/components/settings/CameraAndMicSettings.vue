<template>
  <div
    class="settings-ctn h-[100%] flex flex-col gap-8 overflow-y-auto mb-[2.5%] p-1 pb-[10%]"
  >
    <!-- ─── MICROPHONE SECTION ─────────────────────────────────── -->
    <SettingsGroup
      title="Microphone"
      note="The microphone used during sermon transcription."
    >
      <template #actions>
        <CowButton
          variant="secondary"
          size="2xs"
          class="!px-3.5 !py-1.5 text-xs gap-1.5"
          :loading="isLoadingMic"
          @click="getMicrophoneList"
        >
          <RefreshIcon class="w-3.5 h-3.5" />
          Refresh
        </CowButton>
      </template>

      <div v-if="micPermissionDenied">
        <UAlert
          color="amber"
          variant="subtle"
          icon="i-bx-error"
          title="Microphone access denied"
          description="Please allow microphone access in your browser settings, then click Refresh."
          :ui="{ rounded: 'rounded-2xl' }"
        />
      </div>
      <div
        v-else-if="!isLoadingMic && microphones.length === 0"
        class="text-center flex flex-col items-center justify-center max-w-[180px] mx-auto mt-4"
      >
        <IconWrapper name="i-bx-microphone-off" size="7" class="pb-2" />
        <div class="text-sm text-gray-500 dark:text-[#9aa3b2]">
          No microphones detected
        </div>
      </div>
      <SettingsRow v-else label="Default microphone">
        <SettingsSelect
          :options="microphoneOptions"
          value-attribute="value"
          option-attribute="label"
          :model-value="selectedMicrophoneValue"
          @change="handleMicSelect"
        >
          <template #label>
            <IconWrapper name="i-bx-microphone" size="4" />
            <span class="truncate">{{ selectedMicrophoneLabel }}</span>
          </template>
        </SettingsSelect>
      </SettingsRow>
    </SettingsGroup>

    <!-- ─── CAMERA SECTION ─────────────────────────────────────── -->
    <!-- Read-only: each camera slide stores its own device. This is here so
         an operator can check permission and devices before a service. -->
    <SettingsGroup
      title="Video Inputs"
      note="Video inputs you can show full screen. Each slide picks its own."
    >
      <template #actions>
        <CowButton
          variant="secondary"
          size="2xs"
          class="!px-3.5 !py-1.5 text-xs gap-1.5"
          :loading="isLoadingCameras"
          @click="getCameraList"
        >
          <RefreshIcon class="w-3.5 h-3.5" />
          Refresh
        </CowButton>
      </template>

      <div v-if="cameraPermissionDenied">
        <UAlert
          color="amber"
          variant="subtle"
          icon="i-bx-error"
          title="Video access denied"
          description="Please allow camera access in your browser settings, then click Refresh."
          :ui="{ rounded: 'rounded-2xl' }"
        />
      </div>
      <div
        v-else-if="!isLoadingCameras && cameras.length === 0"
        class="text-center flex flex-col items-center justify-center max-w-[180px] mx-auto mt-4"
      >
        <IconWrapper name="i-bx-video-off" size="7" class="pb-2" />
        <div class="text-sm text-gray-500 dark:text-[#9aa3b2]">
          No video inputs found
        </div>
      </div>

      <SettingsRow v-else label="Inputs on this computer">
        <SettingsSelect
          :options="cameraOptions"
          value-attribute="value"
          option-attribute="label"
          :model-value="viewedCameraId"
          @change="viewedCameraId = $event"
        >
          <template #label>
            <IconWrapper name="i-bx-video" size="4" />
            <span class="truncate">{{ viewedCameraLabel }}</span>
          </template>
        </SettingsSelect>
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store/app"
import useCameraStream, {
  cameraCaptureIsExclusive,
  cameraErrorState,
} from "~/composables/useCameraStream"
import useCameraOnAir from "~/composables/useCameraOnAir"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

// ── Microphone state ────────────────────────────────────────────
const microphones = ref<MediaDeviceInfo[]>([])
const isLoadingMic = ref(false)
const micPermissionDenied = ref(false)

// The select needs a real value for "no choice", so the system default gets a
// sentinel that maps back to the empty id the store uses.
const SYSTEM_DEFAULT = "__system_default__"

const microphoneOptions = computed(() => [
  { value: SYSTEM_DEFAULT, label: "System default" },
  ...microphones.value.map((mic, index) => ({
    value: mic.deviceId,
    label: mic.label || `Microphone ${index + 1}`,
  })),
])

const selectedMicrophoneValue = computed(
  () => currentState.value.defaultMicrophoneId || SYSTEM_DEFAULT
)

const selectedMicrophoneLabel = computed(
  () =>
    microphoneOptions.value.find(
      (option) => option.value === selectedMicrophoneValue.value
    )?.label ?? "System default"
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
    if (
      err?.name === "NotAllowedError" ||
      err?.name === "PermissionDeniedError"
    ) {
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

const handleMicSelect = (value: string) => {
  if (value === (currentState.value.defaultMicrophoneId || SYSTEM_DEFAULT)) {
    return
  }
  if (value === SYSTEM_DEFAULT) {
    appStore.setDefaultMicrophone("")
    useToast().add({
      title: "Using the system default microphone",
      icon: "i-bx-microphone",
    })
    return
  }
  const mic = microphones.value.find((m) => m.deviceId === value)
  appStore.setDefaultMicrophone(value)
  useToast().add({
    title: `"${mic?.label || "Microphone"}" set as default`,
    icon: "i-bx-microphone",
  })
}

// ── Camera state ────────────────────────────────────────────────
const { listCameras } = useCameraStream()
// Where only one page may hold the camera, opening it to read names would
// mute a camera slide that is on the projector.
const cameraOnAir = useCameraOnAir()
const cameras = ref<MediaDeviceInfo[]>([])
const isLoadingCameras = ref(false)
const cameraPermissionDenied = ref(false)

const cameraOptions = computed(() =>
  cameras.value.map((camera, index) => ({
    value: camera.deviceId,
    label: camera.label || `Camera ${index + 1}`,
  }))
)

// Nothing is saved from this list: each camera slide stores its own camera.
// Picking one only lets the operator look through what is connected.
const viewedCameraId = ref("")
const viewedCameraLabel = computed(
  () =>
    cameraOptions.value.find((option) => option.value === viewedCameraId.value)
      ?.label ??
    cameraOptions.value[0]?.label ??
    "No camera"
)

const getCameraList = async () => {
  isLoadingCameras.value = true
  cameraPermissionDenied.value = false
  try {
    cameras.value = await listCameras({
      probe: !(cameraCaptureIsExclusive() && cameraOnAir.value),
    })
  } catch (err) {
    cameras.value = []
    if (cameraErrorState(err) === "denied") {
      cameraPermissionDenied.value = true
    } else {
      console.warn("Failed to detect cameras:", err)
    }
  }
  isLoadingCameras.value = false
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
