<template>
  <div class="add-song-main mb-4">
    <!-- Same countdown, two destinations: the congregation's screen (a slide in
         the schedule) or the stage display alone (a clock only the band and
         speaker see). The form below is shared; only where it lands changes. -->
    <UTabs
      v-if="stageAvailable"
      v-model="activeTab"
      :items="destinationTabs"
      class="mt-3"
    />

    <p class="mt-3 text-xs text-gray-500 dark:text-[#7d8695]">
      {{ destination.hint }}
    </p>

    <form class="flex flex-col gap-5 mt-3">
      <!-- <UFormGroup size="xl">
        <div class="flex items-center gap-2">
          <UInput type="number" class="text-xs" />
          <span class="text-2xl">h</span>
        </div>
      </UFormGroup> -->

      <CowDropdown
        label="Countdown duration"
        :model-value="timeOptions.find((o: any) => o.value === time)?.label"
        @update:model-value="
          time = timeOptions.find((o: any) => o.label === $event)?.value
        "
        :options="timeOptions.map((o: any) => o.label)"
      />

      <UFormGroup size="lg" label="A little more specific with your time?">
        <div
          class="flex flex-row time-input bg-slate-100 rounded-md dark:bg-slate-800 py-2 px-4 gap-2"
        >
          <input
            type="number"
            name=""
            id=""
            class="w-16 text-center opacity-50"
            v-model="hour"
            disabled
          />
          <span class="text-3xl">:</span>
          <input
            type="number"
            name=""
            id=""
            class="w-16 text-center"
            v-model.trim="minute"
          />
          <span class="text-3xl">:</span>
          <input
            type="number"
            name=""
            id=""
            class="w-16 text-center"
            v-model.trim="second"
          />
        </div>
      </UFormGroup>

      <CowTextarea
        v-model="content"
        :label="destination.textareaLabel"
        :rows="6"
      />

      <CowButton
        variant="primary"
        block
        size="lg"
        class="mt-4"
        :disabled="!hasDuration"
        :loading="loading"
        @click="createCountdown"
      >
        {{ destination.cta }}
      </CowButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { appWideActions } from "~/utils/constants"
import type { Countdown } from "~/types"
import type { Emitter } from "mitt"
import { min } from "rxjs"

const emitter = useNuxtApp().$emitter as Emitter<any>

const props = defineProps<{
  /** 0 = live display, 1 = stage display. Set by whoever opened the panel. */
  initialTab?: number
  stageAvailable?: boolean
}>()

const appStore = useAppStore()

// No icons: the quick actions panel is only ~340px wide by default, and an
// icon pushes "Stage Display" into an ellipsis.
const destinationTabs = [{ label: "Live Display" }, { label: "Stage Display" }]

const activeTab = ref(props.stageAvailable ? props.initialTab || 0 : 0)
watch(
  () => [props.initialTab, props.stageAvailable] as const,
  ([tab, stageAvailable]) => {
    activeTab.value = stageAvailable ? tab || 0 : 0
  }
)

/** Everything that differs between the two destinations, in one place. */
const destination = computed(() =>
  props.stageAvailable && activeTab.value === 1
    ? {
        hint: "Counts down on the stage display only. Nothing reaches the congregation's screen.",
        textareaLabel: "Optional text beneath the countdown",
        cta: "Start stage countdown",
        action: appWideActions.newStageCountdown,
      }
    : {
        hint: "Adds a countdown slide to this schedule, ready to take live.",
        textareaLabel: "Optional text above your countdown",
        cta: "Create countdown slide",
        action: appWideActions.newCountdown,
      }
)

const timeOptions = ref<Array<any>>([
  { label: "1 minute", value: "00:01:00" },
  { label: "3 minutes", value: "00:03:00" },
  { label: "5 minutes", value: "00:05:00" },
  { label: "10 minutes", value: "00:10:00" },
  { label: "15 minutes", value: "00:15:00" },
  { label: "30 minutes", value: "00:30:00" },
  { label: "40 minutes", value: "00:40:00" },
  { label: "45 minutes", value: "00:45:00" },
  { label: "60 minutes", value: "00:60:00" },
])
const loading = ref<boolean>(false)
const content = ref<string>("")
const time = ref<string>("00:05:00")
const hour = ref<string>("00")
const minute = ref<string>("00")
const second = ref<string>("00")
const toast = useToast()
const emit = defineEmits(["go-home"])

/** The duration the three inputs currently spell out, as "HH:MM:SS". */
const duration = computed(() => `${hour.value}:${minute.value}:${second.value}`)

// The dropdown can be cleared and the minute/second boxes emptied, and a
// countdown of nothing is not worth sending anywhere.
const hasDuration = computed(() => useTimeStringToMilli(duration.value) > 0)

const createCountdown = async () => {
  if (!hasDuration.value) return

  const countdown: Countdown = {
    id: useID(),
    content: content.value,
    time: duration.value,
    timeLeft: duration.value,
  }
  useGlobalEmit(destination.value.action, countdown)
}

const formatTime = (value: string | number) => {
  value = value.toString()
  return value.length < 2 ? "0" + value : value
}

watch(
  time,
  () => {
    const timeArr = time.value.split(":")
    hour.value = formatTime(timeArr[0])
    minute.value = formatTime(timeArr[1])
    second.value = formatTime(timeArr[2])
  },
  {
    immediate: true,
  }
)

watch(
  minute,
  () => {
    const minuteInNum = Number(minute.value)
    if (minuteInNum > 59) {
      minute.value = "59"
      second.value = "59"
    }
    minute.value = formatTime(minute.value)
  },
  {
    immediate: true,
  }
)

watch(
  second,
  () => {
    const secondInNum = Number(second.value)
    if (secondInNum > 59) {
      second.value = "59"
    }
    second.value = formatTime(second.value)
  },
  {
    immediate: true,
  }
)
</script>

<style scoped>
.time-input {
  font-size: 2.5rem;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Bebas Neue";
}

.time-input input {
  flex-basis: 30%;
  background: transparent;
  font-family: "Bebas Neue";
}

.time-input *:not(input) {
  flex-basis: 5%;
  position: relative;
  bottom: 4px;
}
</style>
