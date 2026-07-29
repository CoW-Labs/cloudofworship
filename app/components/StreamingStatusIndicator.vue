<template>
  <div
    v-if="visible"
    class="streaming-status-indicator flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
    :class="pillClasses"
  >
    <span
      v-if="status === 'connecting' || status === 'requesting-media'"
      class="i-svg-spinners-90-ring-with-bg w-3 h-3"
    />
    <span
      v-else
      class="w-2 h-2 rounded-full"
      :class="status === 'live' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-gray-400'"
    />
    <span>{{ label }}</span>
    <UButton
      v-if="status === 'connecting' || status === 'live'"
      size="2xs"
      color="red"
      variant="soft"
      class="ml-1"
      @click="requestStop"
    >
      Stop Streaming
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue"
import useYoutubeStreamBroadcastPost from "~/composables/useYoutubeStreamBroadcastPost"
import useYoutubeStreamBroadcastMessage from "~/composables/useYoutubeStreamBroadcastMessage"
import type { DestinationStatus, YoutubeStreamingStatus } from "~/composables/useYoutubeStreaming"

const status = ref<YoutubeStreamingStatus>("idle")
const destinations = ref<DestinationStatus[]>([])
const errorMessage = ref<string | null>(null)
const sessionId = ref<string | null>(null)
const lastMessageAt = ref<number>(0)
const hasReceivedAnyStatus = ref(false)

const visible = computed(() => hasReceivedAnyStatus.value && status.value !== "idle")

const label = computed(() => {
  if (status.value === "requesting-media") return "Requesting camera/mic…"
  if (status.value === "connecting") return "Connecting…"
  if (status.value === "live") return "Live on YouTube"
  if (status.value === "error") return `Error: ${errorMessage.value || "unknown"}`
  if (status.value === "ended") return "Streaming ended"
  return ""
})

const pillClasses = computed(() => {
  if (status.value === "live") return "bg-green-100 text-green-900"
  if (status.value === "error") return "bg-red-100 text-red-900"
  return "bg-gray-100 text-gray-900"
})

const requestStop = () => {
  useYoutubeStreamBroadcastPost(JSON.stringify({ type: "stop-requested" }))
}

const stopRemoveListener = useYoutubeStreamBroadcastMessage((data: string) => {
  const message = JSON.parse(data)
  if (message.type === "status") {
    hasReceivedAnyStatus.value = true
    status.value = message.status
    destinations.value = message.destinations || []
    errorMessage.value = message.error || null
    sessionId.value = message.sessionId || null
    lastMessageAt.value = Date.now()
  }
})

// Fallback: if the Live window vanishes (OS close) mid-stream without a final
// broadcast, poll the backend directly rather than showing a stale status forever.
const fallbackPollInterval = setInterval(async () => {
  if (!sessionId.value) return
  if (status.value !== "connecting" && status.value !== "live") return
  if (Date.now() - lastMessageAt.value < 10000) return

  try {
    const { data, error: fetchError } = await useAPIFetch<{ data: { destinations: DestinationStatus[] } }>(
      `/streaming/sessions/${sessionId.value}`
    )
    if (fetchError.value) throw fetchError.value
    const dests: DestinationStatus[] = data.value?.data?.destinations || []
    destinations.value = dests
    if (dests.some((d) => d.status === "error")) {
      status.value = "error"
      errorMessage.value = dests.find((d) => d.status === "error")?.error || "Streaming destination error"
    } else if (dests.some((d) => d.status === "live")) {
      status.value = "live"
    } else {
      status.value = "connecting"
    }
  } catch {
    status.value = "error"
    errorMessage.value = "Lost connection (live window closed?)"
  }
}, 5000)

onUnmounted(() => {
  stopRemoveListener()
  clearInterval(fallbackPollInterval)
})
</script>
