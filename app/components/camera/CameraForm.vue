<template>
  <div class="camera-form flex flex-col gap-4">
    <!-- Only the Add Video Input panel shows a live preview. The editor keeps to
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
          Video source
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
        title="Video access denied"
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
        No video inputs found. Plug one in, then click Refresh.
      </p>

      <SettingsSelect
        v-if="cameras.length"
        width="w-full"
        select-class="camera-form__trigger w-full"
        :options="cameraOptions"
        value-attribute="value"
        option-attribute="label"
        :model-value="selectedId"
        @change="selectById"
      >
        <template #label>
          <CameraIcon class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ selectedLabel }}</span>
        </template>
      </SettingsSelect>

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
        label="Flip horizontally (mirror effect)"
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
  CameraStreamError,
  reportCameraFailure,
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

const cameraOptions = computed(() =>
  cameras.value.map((camera, index) => ({
    value: camera.deviceId,
    label: camera.label || `Camera ${index + 1}`,
  }))
)

const selectedLabel = computed(
  () =>
    cameraOptions.value.find((option) => option.value === selectedId.value)
      ?.label ?? "Choose a video source"
)

const selectById = (deviceId: string) => {
  if (deviceId === selectedId.value) return
  const camera = cameras.value.find((c) => c.deviceId === deviceId)
  if (camera) select(camera)
}

const refresh = async () => {
  loading.value = true
  permissionDenied.value = false
  unsupported.value = false
  try {
    cameras.value = await listCameras({ probe: !holdCamera.value })
    // "No camera detected" is a failure to the operator, though nothing threw.
    if (!cameras.value.length && !holdCamera.value) {
      reportCameraFailure("picker", new CameraStreamError("missing"))
    }
    // A new slide starts on the first camera rather than an empty preview.
    const first = cameras.value[0]
    if (!props.modelValue.deviceId && first) select(first)
  } catch (error) {
    cameras.value = []
    reportCameraFailure("picker", error)
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

<style>
/* Same card as CowToggle (white, hairline ring, raised edge, 1rem radius,
   0.85rem x 1rem padding) so the camera picker sits in the same stack as the
   Fill and Flip toggles. Global because the class lands on USelectMenu's own
   trigger button, below scoped CSS's reach. */
.camera-form__trigger {
  border-radius: 1rem !important;
  padding: 0.85rem 1rem !important;
  background-color: #ffffff !important;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1), 0 4px 0 0 #e2e8f0,
    0 10px 16px -10px rgba(15, 23, 42, 0.22) !important;
  color: #334155 !important;
  font-size: 0.92rem !important;
  font-weight: 650 !important;
  transition: background-color 0.15s ease, box-shadow 0.15s ease;
}

.camera-form__trigger:hover {
  background-color: #f8fafc !important;
}

html.dark .camera-form__trigger {
  background-color: #1c2433 !important;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 4px 0 0 #0d1320,
    0 10px 16px -10px rgba(0, 0, 0, 0.6) !important;
  color: #f8fafc !important;
}

html.dark .camera-form__trigger:hover {
  background-color: #232c3d !important;
}
</style>
