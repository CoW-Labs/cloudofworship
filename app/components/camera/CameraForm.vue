<template>
  <div class="camera-form flex flex-col gap-4">
    <!-- Only the Add Camera panel shows a live preview. The editor keeps to
         the placeholder so editing a slide never opens a stream. -->
    <div
      v-if="showPreview"
      class="relative w-full overflow-hidden rounded-xl bg-black"
      style="aspect-ratio: 16 / 9"
    >
      <!-- Released the moment the operator picks another camera, so clicking
           through the list never leaves several cameras running. -->
      <CameraFeed
        v-if="modelValue.deviceId && !holdCamera"
        :data="previewData"
        quality="preview"
        release-immediately
      />
      <CameraPlaceholder
        v-else
        :title="
          holdCamera
            ? 'Preview paused'
            : permissionDenied
            ? 'Camera access needed'
            : 'No camera selected'
        "
        :subtitle="holdCamera ? 'A camera slide is on the projector' : ''"
      />
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <h4 class="text-xs font-semibold text-gray-700 dark:text-[#c3cad6]">
          Camera
        </h4>
        <CowButton
          variant="secondary"
          size="2xs"
          class="!px-3 !py-1 text-xs gap-1.5"
          :loading="loading"
          @click="refresh"
        >
          <RefreshIcon class="w-3.5 h-3.5" />
          Refresh
        </CowButton>
      </div>

      <UAlert
        v-if="permissionDenied"
        color="amber"
        variant="subtle"
        icon="i-bx-error"
        title="Camera access denied"
        :description="deniedHelp"
        :ui="{ rounded: 'rounded-2xl' }"
      />
      <p
        v-else-if="unsupported"
        class="text-xs text-gray-500 dark:text-[#9aa3b2]"
      >
        This browser cannot use cameras. Try Chrome, Edge or the desktop app.
      </p>
      <p
        v-else-if="holdCamera"
        class="text-xs text-gray-500 dark:text-[#9aa3b2]"
      >
        {{
          cameras.length
            ? "This browser shows one camera view at a time and the projector is using it, so there is no preview until the camera slide leaves the screen."
            : "This browser shows one camera view at a time and the projector is using it. Cameras will be listed once the camera slide leaves the screen."
        }}
      </p>
      <p
        v-else-if="!loading && cameras.length === 0"
        class="text-xs text-gray-500 dark:text-[#9aa3b2]"
      >
        No cameras detected. Plug one in, then click Refresh.
      </p>

      <button
        v-for="(camera, index) in cameras"
        :key="camera.deviceId"
        type="button"
        class="rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left transition-shadow bg-white dark:bg-[#131a27]"
        :class="
          camera.deviceId === selectedId
            ? 'ring-2 ring-primary-500'
            : 'ring-1 ring-gray-200 dark:ring-white/10 hover:ring-gray-300 dark:hover:ring-white/20'
        "
        @click="select(camera)"
      >
        <CameraIcon
          class="w-4 h-4 shrink-0"
          :class="camera.deviceId === selectedId ? 'text-primary-500' : ''"
        />
        <span class="text-sm font-medium truncate">
          {{ camera.label || `Camera ${index + 1}` }}
        </span>
      </button>

      <!-- The slide's camera, when this machine does not have it. The
           projector falls back to another camera rather than black. -->
      <div
        v-if="missingStoredLabel"
        class="rounded-xl px-3 py-2.5 flex items-center gap-2.5 ring-2 ring-amber-400/70 bg-white dark:bg-[#131a27]"
      >
        <CameraIcon class="w-4 h-4 shrink-0 text-amber-500" />
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">{{ missingStoredLabel }}</p>
          <p class="text-[11px] text-gray-500 dark:text-[#9aa3b2]">
            Not connected to this computer
          </p>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <CowToggle
        label="Fill the screen"
        true-label="Fill (crops the edges)"
        false-label="Fit (shows the whole picture)"
        :model-value="modelValue.fit === 'cover'"
        @update:model-value="update({ fit: $event ? 'cover' : 'contain' })"
      />
      <CowToggle
        label="Mirror"
        :model-value="modelValue.mirror"
        @update:model-value="update({ mirror: $event })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CameraSlideData } from "~/types"
import type { CameraSettings } from "~/utils/camera"
import CameraIcon from "~/components/svgs/CameraIcon.vue"
import useCameraStream, {
  cameraCaptureIsExclusive,
  cameraErrorState,
} from "~/composables/useCameraStream"
import useCameraOnAir from "~/composables/useCameraOnAir"

const props = withDefaults(
  defineProps<{
    modelValue: CameraSettings
    showPreview?: boolean
  }>(),
  { showPreview: false }
)

const emit = defineEmits<{
  "update:modelValue": [value: CameraSettings]
}>()

const { listCameras, onCameraDevicesChange } = useCameraStream()
const { isTauri } = useTauri()

// Where only one page may hold the camera, opening it here (even just to read
// camera names) would mute the projector's feed mid-service.
const cameraOnAir = useCameraOnAir()
const holdCamera = computed(
  () => cameraCaptureIsExclusive() && cameraOnAir.value
)

const cameras = ref<MediaDeviceInfo[]>([])
const loading = ref(false)
const permissionDenied = ref(false)
const unsupported = ref(false)

const update = (patch: Partial<CameraSettings>) =>
  emit("update:modelValue", { ...props.modelValue, ...patch })

// The camera the slide stores, found on this machine by id or, failing that,
// by label (ids differ between browsers and the desktop app).
const selectedId = computed(() => {
  const { deviceId, deviceLabel } = props.modelValue
  if (cameras.value.some((camera) => camera.deviceId === deviceId)) {
    return deviceId
  }
  const label = deviceLabel?.trim()
  return (
    (label &&
      cameras.value.find((camera) => camera.label.trim() === label)
        ?.deviceId) ||
    ""
  )
})

const missingStoredLabel = computed(() =>
  !loading.value &&
  cameras.value.length > 0 &&
  props.modelValue.deviceId &&
  !selectedId.value
    ? props.modelValue.deviceLabel || "Camera"
    : ""
)

const previewData = computed<CameraSlideData>(() => ({
  id: "camera-form-preview",
  ...props.modelValue,
}))

const deniedHelp = computed(() =>
  isTauri
    ? "Allow Cloud of Worship to use the camera in your system privacy settings, then click Refresh."
    : "Allow camera access for this site in your browser's address bar, then click Refresh."
)

const select = (camera: MediaDeviceInfo) =>
  update({ deviceId: camera.deviceId, deviceLabel: camera.label })

const refresh = async () => {
  loading.value = true
  permissionDenied.value = false
  unsupported.value = false
  try {
    cameras.value = await listCameras({ probe: !holdCamera.value })
    // A new slide starts on the first camera rather than an empty preview.
    const first = cameras.value[0]
    if (!props.modelValue.deviceId && first) select(first)
  } catch (error) {
    cameras.value = []
    const state = cameraErrorState(error)
    if (state === "denied") permissionDenied.value = true
    else if (state === "unsupported") unsupported.value = true
    else console.warn("Could not list cameras:", error)
  }
  loading.value = false
}

watch(holdCamera, (held) => {
  if (!held) refresh()
})

let stopDeviceWatch: () => void = () => {}

onMounted(() => {
  refresh()
  stopDeviceWatch = onCameraDevicesChange(refresh)
})

onBeforeUnmount(() => stopDeviceWatch())
</script>
