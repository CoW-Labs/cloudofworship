<template>
  <div
    class="settings-ctn h-[100%] flex flex-col gap-8 overflow-y-auto mb-[2.5%] p-1 pb-[10%]"
  >
    <!-- ─── MICROPHONE SECTION ─────────────────────────────────── -->
    <SettingsGroup
      title="Active Microphone"
      note="The microphone used during sermon transcription."
    >
      <div
        v-if="selectedMicrophone"
        class="rounded-2xl bg-primary-100 dark:bg-primary-900/40 px-4 py-3.5 flex justify-between items-center gap-4"
      >
        <div class="info flex gap-3 min-w-0">
          <IconWrapper
            name="i-bx-microphone"
            size="6"
            class="pt-1 shrink-0"
          />
          <div class="name-and-type min-w-0">
            <div class="name text-sm font-semibold flex items-center gap-2">
              <span class="truncate">
                {{ selectedMicrophone.label || "Unlabeled Microphone" }}
              </span>
              <span
                class="shrink-0 bg-primary-300 dark:bg-primary-700 text-xs px-2 py-0.5 rounded-full"
                >Default</span
              >
            </div>
            <div class="type text-xs text-gray-600 dark:text-[#9aa3b2] mt-0.5">
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
        class="rounded-2xl bg-primary-100 dark:bg-primary-900/40 px-4 py-3.5 flex items-center gap-3"
      >
        <IconWrapper name="i-bx-microphone" size="6" class="shrink-0" />
        <div class="text-sm text-gray-600 dark:text-[#a7afbd]">
          No microphone selected — system default will be used
        </div>
      </div>
    </SettingsGroup>

    <!-- Available microphones list -->
    <SettingsGroup title="Available Microphones">
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

      <div
        v-for="(mic, index) in microphones"
        :key="mic.deviceId"
        class="rounded-2xl bg-white dark:bg-[#131a27] px-4 py-3.5 flex justify-between items-center gap-4 transition-shadow"
        :class="
          currentState.defaultMicrophoneId === mic.deviceId
            ? 'ring-2 ring-primary-500'
            : 'ring-1 ring-gray-200 dark:ring-white/10'
        "
      >
        <div class="info flex gap-3 min-w-0">
          <IconWrapper
            :name="
              currentState.defaultMicrophoneId === mic.deviceId
                ? 'i-bx-microphone'
                : 'i-bx-microphone-off'
            "
            size="6"
            class="pt-1 shrink-0"
            :class="
              currentState.defaultMicrophoneId === mic.deviceId
                ? 'text-primary-500'
                : ''
            "
          />
          <div class="name-and-type min-w-0">
            <div class="name text-sm font-semibold truncate">
              {{ mic.label || `Microphone ${index + 1}` }}
            </div>
            <div class="type text-xs text-gray-500 dark:text-[#9aa3b2] mt-0.5">
              {{
                mic.deviceId === "default" ? "System default" : "Audio input"
              }}
            </div>
          </div>
        </div>
        <div class="shrink-0 flex items-center gap-2.5">
          <span class="text-xs font-semibold text-gray-600 dark:text-[#a7afbd]">
            Use as default
          </span>
          <CowToggle
            bare
            label="Use as default"
            :model-value="currentState.defaultMicrophoneId === mic.deviceId"
            @update:model-value="($event: boolean) => handleMicSelect($event, mic)"
          />
        </div>
      </div>
    </SettingsGroup>

    <!-- ─── CAMERA SECTION ─────────────────────────────────────── -->
    <!-- Read-only: each camera slide stores its own device. This is here so
         an operator can check permission and devices before a service. -->
    <SettingsGroup
      title="Available Cameras"
      note="Cameras you can show with a camera slide. Each slide picks its own camera."
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
          title="Camera access denied"
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
          No cameras detected
        </div>
      </div>

      <div
        v-for="(camera, index) in cameras"
        :key="camera.deviceId"
        class="rounded-2xl bg-white dark:bg-[#131a27] px-4 py-3.5 flex items-center gap-3 ring-1 ring-gray-200 dark:ring-white/10"
      >
        <IconWrapper name="i-bx-video" size="6" class="shrink-0" />
        <div class="name text-sm font-semibold truncate">
          {{ camera.label || `Camera ${index + 1}` }}
        </div>
      </div>
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

const handleMicSelect = (checked: boolean, mic: MediaDeviceInfo) => {
  if (checked) {
    appStore.setDefaultMicrophone(mic.deviceId)
    useToast().add({
      title: `"${mic.label || "Microphone"}" set as default`,
      icon: "i-bx-microphone",
    })
  } else {
    appStore.setDefaultMicrophone("")
    useToast().add({
      title: "Default microphone cleared",
      icon: "i-bx-microphone-off",
    })
  }
}

// ── Camera state ────────────────────────────────────────────────
const { listCameras } = useCameraStream()
// Where only one page may hold the camera, opening it to read names would
// mute a camera slide that is on the projector.
const cameraOnAir = useCameraOnAir()
const cameras = ref<MediaDeviceInfo[]>([])
const isLoadingCameras = ref(false)
const cameraPermissionDenied = ref(false)

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
