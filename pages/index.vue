<template #default="{ defaultProps }">
  <div class="flex mt-4 gap-2 px-4">
    <QuickActions />
    <PreviewContent />
    <LiveOutput />
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "app",
})
useHead({
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
  ],
})
import { useAppStore } from "~/store/app"
import { ref } from "vue"
import { useDebounceFn, useOnline } from "@vueuse/core"
import type { Emitter } from "mitt"
import type { Slide } from "~/types"

const appStore = useAppStore()
const emitter = useNuxtApp().$emitter as Emitter<any>
const socket = ref<WebSocket | null>(null)
const MAX_RETRIES = 10
let retryCount = 0

const uploadOfflineSlides = useDebounceFn(() => {
  useGlobalEmit(appWideActions.uploadOfflineSlides)
}, 2000)

const connectWebSocket = async () => {
  const socketInstance = useSocket({
    scheduleId: appStore.currentState.activeSchedule?._id!!,
  }).connect()
  if (socketInstance) {
    socket.value = socketInstance
  }
}

const sendLiveSlideToWebsocket = (slide: Slide) => {
  if (
    socket.value?.readyState === WebSocket.CLOSED ||
    socket.value?.readyState === WebSocket.CLOSING
  ) {
    console.error("Error sending live slide to websocket", "WebSocket closed")
    // socket.value.close() // Close on error to trigger the onclose event
    // connectWebSocket()
  } else {
    socket.value?.send(
      JSON.stringify({
        action: "live-slide",
        data: slide,
      })
    )
  }
}

watch(
  () => appStore.currentState.liveSlideId,
  (liveSlideId) => {
    const liveSlide = appStore.currentState.activeSlides.find(
      (slide) => slide.id === liveSlideId
    )
    if (liveSlide) {
      sendLiveSlideToWebsocket(liveSlide)
    }
  },
  { deep: true }
)

onMounted(async () => {
  const emailChange = useRoute().query.email_change

  // console.log("emailChange", emailChange)
  if (emailChange) {
    setTimeout(() => {
      useGlobalEmit(appWideActions.openSettings, "Profile Settings")
    }, 1000)
  }

  // Check for pending plan_id from signup flow
  const pendingPlanId = localStorage.getItem("pending_plan_id")
  if (pendingPlanId) {
    localStorage.removeItem("pending_plan_id")

    usePosthogCapture("UPGRADE_MODAL_OPENED_AFTER_VERIFICATION", {
      planId: pendingPlanId,
    })

    // Show upgrade modal after a brief delay
    setTimeout(() => {
      useGlobalEmit("show-upgrade-modal", { planId: pendingPlanId })
    }, 1000)
  }

  // APP-WIDE SHORTCUTS
  useCreateShortcut("/", () => useGlobalEmit(appWideActions.quickActionsFocus))

  // Prevent default action on specific keys
  document.addEventListener("keydown", function (event) {
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "y" || event.key === "Y" || event.key === "?")
    ) {
      event.preventDefault()
    }
  })

  useCreateShortcut(
    "z",
    () => {
      appStore.undo()
      uploadOfflineSlides()
    },
    { ctrlOrMeta: true }
  )

  useCreateShortcut(
    "y",
    () => {
      appStore.redo()
      uploadOfflineSlides()
    },
    {
      ctrlOrMeta: true,
    }
  )

  useCreateShortcut(
    "p",
    () => {
      useGlobalEmit("promote-active-slide-live")
    },
    {
      ctrlOrMeta: true,
    }
  )

  useCreateShortcut(
    "h",
    () => {
      useGlobalEmit("open-shortcuts")
    },
    {
      ctrlOrMeta: true,
    }
  )

  useCreateShortcut(
    ",",
    () => {
      useGlobalEmit("open-settings")
    },
    {
      ctrlOrMeta: true,
    }
  )

  // Connect to websocket
  if (appStore.currentState.activeSchedule) {
    // connectWebSocket()
  }
})

emitter.on("refresh-slides", () => {
  if (
    socket.value?.readyState === WebSocket.CLOSED ||
    socket.value?.readyState === WebSocket.CLOSING
  ) {
    // connectWebSocket()
  }
})
</script>
