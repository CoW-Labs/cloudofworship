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
          variant="solid"
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
          :options="[
            { label: '1 minute', value: '00:01:00' },
            { label: '3 minutes', value: '00:03:00' },
            { label: '5 minutes', value: '00:05:00' },
            { label: '10 minutes', value: '00:10:00' },
            { label: '15 minutes', value: '00:15:00' },
            { label: '30 minutes', value: '00:30:00' },
            { label: '40 minutes', value: '00:40:00' },
            { label: '45 minutes', value: '00:45:00' },
            { label: '60 minutes', value: '00:60:00' },
          ]"
        >
          <template #label>
            <span v-if="time?.length" class="truncate text-black">{{
              time
            }}</span>
            <span v-else>Countdown duration</span>
          </template>
        </USelectMenu>
      </UFormGroup>
      <UFormGroup size="lg">
        <UTextarea
          placeholder="Optional text above your countdown e.g 'Time before service starts:'"
          variant="none"
          rows="6"
          color="gray"
          resize="vertical"
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

const emitter = useNuxtApp().$emitter as Emitter<any>

const appStore = useAppStore()
const loading = ref<boolean>(false)
const content = ref<string>("")
const time = ref<string>("00:05:00")
const toast = useToast()
const emit = defineEmits(["go-home"])

const createCountdown = async () => {
  const countdown: Countdown = {
    id: useID(),
    content: content.value,
    time: time.value,
    timeLeft: time.value,
  }
  useGlobalEmit(appWideActions.newCountdown, countdown)
}
</script>
