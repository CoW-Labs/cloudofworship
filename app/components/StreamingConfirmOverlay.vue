<template>
  <div
    v-if="showConfirm"
    class="streaming-confirm-overlay fixed top-[70px] left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-primary-100 bg-opacity-70 rounded-lg px-5 py-3 text-black"
  >
    <span class="font-bold">Start streaming this display to YouTube?</span>
    <UButton color="primary" variant="solid" @click="confirmStart">
      Start Streaming
    </UButton>
    <UButton color="gray" variant="ghost" @click="showConfirm = false">
      Dismiss
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from "vue"
import { useYoutubeStreaming } from "~/composables/useYoutubeStreaming"
import useYoutubeStreamBroadcastPost from "~/composables/useYoutubeStreamBroadcastPost"
import useYoutubeStreamBroadcastMessage from "~/composables/useYoutubeStreamBroadcastMessage"

const showConfirm = ref(false)

const streaming = useYoutubeStreaming({
  onStatusChange: (state) => {
    useYoutubeStreamBroadcastPost(
      JSON.stringify({
        type: "status",
        status: state.status,
        destinations: state.destinations,
        error: state.error,
        sessionId: state.sessionId,
      })
    )
  },
})

const confirmStart = async () => {
  showConfirm.value = false
  await streaming.start()
}

const stopRemoveListener = useYoutubeStreamBroadcastMessage((data: string) => {
  const message = JSON.parse(data)
  if (message.type === "request-confirm") {
    const canReArm =
      streaming.status.value === "idle" ||
      streaming.status.value === "ended" ||
      streaming.status.value === "error"
    if (canReArm) {
      showConfirm.value = true
    }
  } else if (message.type === "stop-requested") {
    streaming.stop()
  }
})

onUnmounted(() => {
  stopRemoveListener()
})
</script>
