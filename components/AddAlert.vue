<template>
  <div class="add-song-main mb-4">
    <div
      v-if="currentState.alerts?.length > 0"
      class="active-alert rounded-md bg-primary-100 dark:bg-primary-900 py-4 mb-4"
    >
      <div
        class="text-sm font-semibold flex items-center gap-2 text-primary-900 dark:text-primary-100 px-4 pb-3 border-b border-primary-200"
      >
        <!-- <IconWrapper name="i-bx-info-circle" size="4"></IconWrapper> -->
        Alert Schedule (Maximum of
        {{ appStore.currentState.settings.alertLimit }})
      </div>
      <div class="alerts max-h-[200px] overflow-y-auto">
        <div
          ref="alertsRef"
          class="alert-card-ctn flex items-center px-2"
          v-for="alert in currentState.alerts"
          :key="alert.id"
        >
          <UButton
            class="alert-card flex items-start gap-1 justify-start mt-2 text-left hover:bg-primary-200 w-[calc(100%-0px)] relative"
            :class="{
              'bg-primary-200 dark:bg-primary-500':
                currentState.activeAlert?.id === alert?.id,
            }"
            variant="ghost"
            :icon="
              currentState.activeAlert?.id === alert?.id
                ? 'i-bx-check-circle'
                : 'i-bx-circle'
            "
            color="black"
            block
            @click="appStore.setActiveAlert(alert)"
          >
            <div class="text text-xs">
              {{ alert.title }}
            </div>
            <UButton
              class="absolute right-1 top-[2px] alert-delete bg-primary-200"
              variant="ghost"
              icon="i-bx-trash"
              size="xs"
              @click.stop.prevent="deleteAlert(alert)"
            ></UButton>
          </UButton>
        </div>
      </div>
      <div class="button-ctn px-4">
        <UButton
          block
          variant="outline"
          class="mt-4"
          @click="appStore.setActiveAlert(null)"
        >
          Remove Alert
        </UButton>
      </div>
    </div>
    <h2 class="font-semibold text-md">Add Alert</h2>
    <form class="flex flex-col gap-3 mt-2">
      <UFormGroup size="lg">
        <BgColorSelection
          :count="6"
          class="bg-gray-100 rounded-md"
          :value="bgColor"
          @select="bgColor = $event"
        />
      </UFormGroup>

      <UFormGroup size="lg">
        <USelectMenu
          variant="solid"
          color="black"
          placeholder="Alert position"
          class="text-gray-400"
          v-model="position"
          :ui="{
            variant: {
              solid: 'focus:ring-0 bg-gray-100',
            },
          }"
          :options="['Top', 'Bottom']"
        >
          <template #label>
            <span v-if="position?.length" class="truncate text-black">{{
              position
            }}</span>
            <span v-else>Alert position</span>
          </template>
        </USelectMenu>
      </UFormGroup>
      <UFormGroup size="lg">
        <UTextarea
          placeholder="Your alert content goes here"
          variant="none"
          rows="6"
          color="gray"
          resize="vertical"
          v-model="content"
        />
      </UFormGroup>

      <UButton
        block
        trailing-icon="i-bx-send"
        size="lg"
        class="mt-4"
        :disabled="!(content && position && bgColor)"
        :loading="loading"
        @click="addAlert"
      >
        Send alert to LIVE
      </UButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Alert } from "~/types"
const props = defineProps<{
  alert: Alert
}>()

const appStore = useAppStore()

const { currentState } = storeToRefs(appStore)
const loading = ref<boolean>(false)
const alertsRef = ref<HTMLDivElement>()
const content = ref<string>("")
const position = ref<string>("Bottom")
const bgColor = ref<string>("#a855f7")
const toast = useToast()
const emit = defineEmits(["go-home"])

watch(
  currentState,
  () => {
    if (currentState.value?.activeAlert?.id === props.alert?.id) {
      sendAlertToWebsocket(props.alert)
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
  if (
    currentState.value?.alerts?.length >=
    appStore.currentState.settings.alertLimit
  ) {
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
    }
    appStore.setAlerts([...currentState.value?.alerts, alert])
    appStore.setActiveAlert(alert)

    toast.add({ icon: "i-bx-send", title: "Alert sent to live" })
    emit("go-home")
    setTimeout(() => {
      alertsRef.value?.scrollBy(0, 10000)
    }, 300)
  }
}

const sendAlertToWebsocket = (alert: Alert) => {
  const socket = useNuxtApp().$socket as WebSocket
  socket.send(
    JSON.stringify({
      action: "add-alert",
      data: alert,
    })
  )
}

const removeAlertFromWebsocket = () => {
  const socket = useNuxtApp().$socket as WebSocket
  socket.send(
    JSON.stringify({
      action: "remove-alert",
    })
  )
}
</script>

<style scoped>
.alert-delete {
  visibility: hidden;
  opacity: 0;
  transform: translateX(10px);
  transition: 0.3s;
}
.alert-card:hover .alert-delete {
  visibility: visible;
  opacity: 1;
  transform: translateX(0);
}
</style>
