<template>
  <div class="add-song-main mb-4">
    <h2 class="font-semibold text-md">Add Countdown</h2>
    <form class="flex flex-col gap-3 mt-2">
      <!-- <UFormGroup size="xl">
        <div class="flex items-center gap-2">
          <UInput type="number" class="text-xs" />
          <span class="text-2xl">h</span>
        </div>
      </UFormGroup> -->

      <UFormGroup size="lg">
        <USelectMenu
          :variant="'solid' as SelectVariant"
          color="black"
          placeholder="Alert position"
          class="text-gray-400"
          value-attribute="value"
          v-model="time"
          :ui="{
            variant: {
              solid: 'focus:ring-0 bg-gray-100',
            },
          }"
          :options="timeOptions"
        >
          <template #label>
            <span v-if="time?.length" class="truncate text-black">{{
              timeOptions.find((option: any) => option.value === time)?.label
            }}</span>
            <span v-else>Countdown duration</span>
          </template>
        </USelectMenu>
      </UFormGroup>

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

      <UFormGroup size="lg">
        <UTextarea
          placeholder="Optional text above your countdown e.g 'Time before service starts:'"
          variant="none"
          :rows="6"
          color="gray"
          v-model="content"
        />
      </UFormGroup>

      <UButton
        block
        icon="i-bx-add"
        size="lg"
        class="mt-4"
        :disabled="!time"
        :loading="loading"
        @click="createCountdown"
      >
        Create countdown slide
      </UButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { appWideActions } from "~/utils/constants"
import type { Countdown } from "~/types"
import type { Emitter } from "mitt"
import { min } from "rxjs"
import type { SelectVariant } from "@nuxt/ui/dist/runtime/types"

const emitter = useNuxtApp().$emitter as Emitter<any>

const appStore = useAppStore()
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

const createCountdown = async () => {
  const countdown: Countdown = {
    id: useID(),
    content: content.value,
    time: `${hour.value}:${minute.value}:${second.value}`,
    timeLeft: `${hour.value}:${minute.value}:${second.value}`,
  }
  useGlobalEmit(appWideActions.newCountdown, countdown)
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
