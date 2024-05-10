<template>
  <div class="add-song-main mb-4">
    <div
      v-if="alert"
      class="active-alert rounded-md bg-primary-100 dark:bg-primary-900 p-4 mb-4"
    >
      <div class="text-sm font-semibold flex items-center gap-2">
        <IconWrapper :name="alert?.icon" size="4"></IconWrapper>
        Active Alert
      </div>
      <p class="opacity-60 mt-2">
        {{ alert?.title }}
      </p>
      <UButton
        block
        variant="outline"
        class="mt-4"
        @click="appStore.setAlert(null)"
      >
        Remove Alert
      </UButton>
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
          rows="12"
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

const { alert } = storeToRefs(appStore)
const loading = ref<boolean>(false)
const content = ref<string>("")
const position = ref<string>("Bottom")
const bgColor = ref<string>("#a855f7")
const toast = useToast()
const emit = defineEmits(["go-home"])

const addAlert = async () => {
  const alert: Alert = {
    id: useID(),
    title: content.value,
    style: `${position.value.toLowerCase()}-0`,
    icon: "i-bx-info-circle",
    background: bgColor.value,
  }
  appStore.setAlert(alert)
  toast.add({ icon: "i-bx-send", title: "Alert sent to live" })
  emit("go-home")
}
</script>
