<template>
  <div class="add-song-main mb-4">
    <!-- ALERT SCHEDULE — the alerts saved for this service. One of them can be
         on the live output at a time, marked with the same live dot the slide
         thumbnails use. -->
    <div
      v-if="currentState.alerts?.length > 0"
      class="alert-schedule rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 mb-5"
    >
      <div class="flex items-center justify-between px-2 py-1.5 mb-2">
        <h2
          class="text-sm font-medium text-gray-700 dark:text-[#a7afbd] flex items-center gap-2"
        >
          <BannersAndAlertsIcon class="w-4 h-4 text-gray-400 dark:text-[#7d8695]" />
          Alert schedule
        </h2>
        <span
          class="text-xs tabular-nums"
          :class="
            atAlertLimit
              ? 'text-red-500 font-medium'
              : 'text-gray-500 dark:text-[#7d8695]'
          "
        >
          {{ currentState.alerts.length }} of {{ alertLimit }}
        </span>
      </div>

      <div
        ref="alertsRef"
        class="alerts max-h-[236px] overflow-y-auto rounded-lg bg-white dark:bg-[#171d2b]"
      >
        <UButton
          v-for="alert in currentState.alerts"
          :key="alert.id"
          variant="ghost"
          color="black"
          block
          class="alert-card flex items-center gap-3 justify-start text-left px-2.5 py-2.5 border-b border-gray-100 dark:border-[#202838] last:border-0 transition-colors hover:!bg-gray-50 dark:hover:!bg-[#222938]"
          :class="{ 'is-live': isLive(alert) }"
          @click="appStore.setActiveAlert(alert)"
        >
          <!-- Miniature of the banner itself: its colour, and which edge of the
               screen it sits on. Reads at a glance where a purple check could
               only say "this one". -->
          <span class="relative shrink-0">
            <span
              class="banner-thumb flex h-8 w-[52px] flex-col overflow-hidden rounded-md bg-gray-800 ring-1 ring-black/5 dark:bg-black dark:ring-white/10"
              :class="isTopAligned(alert) ? 'justify-start' : 'justify-end'"
            >
              <span
                class="h-[8px] w-full"
                :style="{ background: alert.background }"
              ></span>
            </span>
            <LiveSlideIndicator :visible="isLive(alert)" hide-text />
          </span>

          <span class="min-w-0 flex-1">
            <CowTooltip :text="alert.title" class="max-w-full">
              <span class="min-w-0 truncate text-sm font-medium">
                {{ alert.title }}
              </span>
            </CowTooltip>
            <span
              class="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-normal text-gray-500 dark:text-[#7d8695]"
            >
              <!-- Only the live alert says anything here. The rest carry no
                   status word at all — "Not showing" is the default for every
                   row but one, so it was noise on all of them. -->
              <template v-if="isLive(alert)">
                <span class="shrink-0 font-semibold tracking-wide text-[#f04438]">
                  LIVE
                </span>
                <span class="shrink-0" aria-hidden="true">·</span>
              </template>
              <span class="min-w-0 truncate">
                {{ isTopAligned(alert) ? "Top" : "Bottom" }} ·
                {{ speedLabel(alert) }}
              </span>
            </span>
          </span>

          <UTooltip text="Delete alert" :popper="{ placement: 'top' }">
            <UButton
              class="alert-delete shrink-0"
              variant="ghost"
              color="gray"
              size="xs"
              square
              aria-label="Delete alert"
              @click.stop.prevent="deleteAlert(alert)"
            >
              <DeleteIcon class="w-4 h-4" />
            </UButton>
          </UTooltip>
        </UButton>
      </div>

      <CowButton
        v-if="currentState.activeAlert"
        variant="secondary"
        size="sm"
        block
        class="my-2"
        @click="appStore.setActiveAlert(null)"
      >
        Clear alert from live
      </CowButton>
    </div>

    <h2 class="text-sm font-medium text-gray-700 dark:text-[#a7afbd]">
      Add alert
    </h2>
    <form class="flex flex-col gap-5 mt-3">
      <UFormGroup size="lg" label="Banner color">
        <BgColorSelection
          :count="6"
          class="rounded-lg bg-[#f1f3f6] dark:bg-[#222938]"
          :value="bgColor"
          @select="bgColor = $event.color"
        />
      </UFormGroup>

      <CowDropdown
        label="Alert position"
        v-model="position"
        :options="['Top', 'Bottom']"
      />
      <CowTextarea
        v-model="content"
        label="Your alert content"
        :rows="6"
        autoresize
      />

      <UFormGroup size="lg" label="Speed">
        <div class="flex items-center gap-3 px-2">
          <span class="text-xs whitespace-nowrap">Slow</span>
          <URange
            v-model="speed"
            :min="0.5"
            :max="5"
            :step="0.25"
            class="flex-1"
          />
          <span class="text-xs whitespace-nowrap">Fast</span>
        </div>
      </UFormGroup>

      <CowButton
        variant="primary"
        block
        size="lg"
        class="mt-4"
        :disabled="!(content && position && bgColor)"
        :loading="loading"
        @click="addAlert"
      >
        Send alert to LIVE
      </CowButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Alert } from "~/types"
import { safeScrollBy } from "~/utils/browserSafety"
const props = defineProps<{
  alert?: Alert
}>()

const appStore = useAppStore()

const { currentState } = storeToRefs(appStore)
const loading = ref<boolean>(false)
const alertsRef = ref<HTMLDivElement>()
const content = ref<string>("")
const position = ref<string>("Bottom")
const bgColor = ref<string>("#a855f7")
const speed = ref<number>(1)
const toast = useToast()
const emit = defineEmits(["go-home"])

const alertLimit = computed(
  () => appStore.currentState.settings.alertLimit || 0
)
const atAlertLimit = computed(
  () => (currentState.value?.alerts?.length || 0) >= alertLimit.value
)

const isLive = (alert: Alert) => currentState.value?.activeAlert?.id === alert?.id

// `style` is the tailwind class the alert is positioned with ("top-0" /
// "bottom-0"), which is also the only record of which edge it sits on.
const isTopAligned = (alert: Alert) => !!alert?.style?.startsWith("top")

// The stored speed is a 0.5–5 multiplier on the marquee duration. Buckets keep
// the card readable — "2.25" tells an operator nothing mid-service.
const speedLabel = (alert: Alert) => {
  const speed = alert?.speed || 1
  if (speed < 0.9) return "Slow"
  if (speed <= 1.5) return "Normal speed"
  if (speed <= 3) return "Fast"
  return "Very fast"
}

watch(
  currentState,
  () => {
    if (currentState.value?.activeAlert?.id === props.alert?.id) {
      sendAlertToWebsocket(props?.alert!!)
    } else if (currentState.value.activeAlert === null) {
      removeAlertFromWebsocket()
    }
  },
  { deep: true }
)

const deleteAlert = (alert: Alert) => {
  const tempAlerts = [...currentState.value?.alerts]
  const newAlertIndex = tempAlerts.findIndex((a) => a.id === alert.id)
  tempAlerts.splice(newAlertIndex, 1)
  appStore.setAlerts(tempAlerts)
  if (alert?.id === currentState.value?.activeAlert?.id) {
    appStore.setActiveAlert(null)
  }
  toast.add({ icon: "i-bx-trash", title: "Deleted alert" })
}

const addAlert = async () => {
  if (atAlertLimit.value) {
    toast.add({
      icon: "i-bx-error-circle",
      title: "Maximum alerts exceeded. Delete alert to add more.",
      color: "red",
    })
  } else {
    const alert: Alert = {
      id: useID(),
      title: content.value,
      style: `${position.value.toLowerCase()}-0`,
      icon: "i-bx-info-circle",
      background: bgColor.value,
      speed: speed.value,
    }
    appStore.setAlerts([...currentState.value?.alerts, alert])
    appStore.setActiveAlert(alert)

    toast.add({ icon: "i-bx-send", title: "Alert sent to live" })
    usePosthogCapture("NEW_ALERT_SENT")
    emit("go-home")
    setTimeout(() => {
      safeScrollBy(alertsRef.value, 0, 10000)
    }, 300)
  }
}

const sendAlertToWebsocket = (alert: Alert) => {
  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) {
    socket.emit("add-alert", alert)
  }
}

const removeAlertFromWebsocket = () => {
  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) {
    socket.emit("remove-alert", {})
  }
}
</script>

<style scoped>
/* Hover-revealed row action, matching the schedule list's "more" button. */
.alert-delete {
  opacity: 0;
  transform: translateX(6px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.alert-card:hover .alert-delete,
.alert-card:focus-within .alert-delete {
  opacity: 1;
  transform: translateX(0);
}

/* Touch screens have no hover state to reveal the action. */
@media (hover: none) {
  .alert-delete {
    opacity: 1;
    transform: translateX(0);
  }
}

/* The live row is marked by the banner thumbnail's dot, so the row itself only
   needs a quiet tint — a filled purple card buried the alert text it exists to
   show. */
.alert-card.is-live {
  background-color: rgba(168, 85, 247, 0.08);
}
html.dark .alert-card.is-live {
  background-color: rgba(168, 85, 247, 0.14);
}
</style>
