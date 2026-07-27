<template>
  <div class="settings-ctn h-[100%]">
    <p class="text-sm mb-1">
      YouTube stream key
      <span
        v-if="youtubeConnectionStatus === 'connected'"
        class="text-xs text-green-600 dark:text-green-400 ml-2"
        >Connected</span
      >
      <span
        v-else-if="youtubeConnectionStatus === 'not-connected'"
        class="text-xs opacity-60 ml-2"
        >Not connected</span
      >
    </p>
    <p class="text-xs opacity-70 mb-4 max-w-[400px]">
      Find this under YouTube Studio → Go Live → Stream. Saving it here
      replaces any previously connected key for your church.
    </p>
    <UFormGroup label="YouTube Stream Key">
      <UInput
        class="border-0 shadow-none max-w-[350px]"
        input-class=" bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
        size="md"
        type="password"
        v-model="youtubeStreamKey"
        placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
      />
    </UFormGroup>
    <UButton
      @click="saveYoutubeStreamKey()"
      :loading="isSavingStreamKey"
      variant="outline"
      class="mt-6 w-full max-w-[350px] justify-center"
    >
      Save Stream Key
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"

const toast = useToast()

const youtubeStreamKey = ref<string>("")
const isSavingStreamKey = ref(false)
const youtubeConnectionStatus = ref<"unknown" | "connected" | "not-connected">("unknown")

const fetchYoutubeConnectionStatus = async () => {
  const { data, error } = await useAPIFetch<{ data: { connected: boolean } }>("/streaming/integrations/youtube")
  if (error.value) return
  youtubeConnectionStatus.value = data.value?.data?.connected ? "connected" : "not-connected"
}

const saveYoutubeStreamKey = async () => {
  if (!youtubeStreamKey.value) {
    toast.add({
      color: "red",
      title: "Enter a YouTube stream key first",
      icon: "i-bx-alert-circle",
    })
    return
  }

  isSavingStreamKey.value = true
  try {
    const { error } = await useAPIFetch("/streaming/integrations/youtube", {
      method: "POST",
      body: { streamKey: youtubeStreamKey.value },
    })
    if (error.value) throw error.value

    youtubeStreamKey.value = ""
    youtubeConnectionStatus.value = "connected"
    toast.add({
      color: "green",
      title: "YouTube stream key saved",
      icon: "i-bx-check-circle",
    })
  } catch {
    toast.add({
      color: "red",
      title: "Failed to save YouTube stream key",
      icon: "i-bx-alert-circle",
    })
  } finally {
    isSavingStreamKey.value = false
  }
}

onMounted(() => {
  fetchYoutubeConnectionStatus()
})
</script>
