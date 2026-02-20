<template #default="{ defaultProps }">
  <div class="flex mt-4 px-4">
    <div :style="{ width: quickActionsWidth + 'px', flexShrink: 0 }">
      <QuickActions />
    </div>
    <div
      class="w-[5px] flex-shrink-0 mx-[2px] cursor-ew-resize rounded hover:bg-primary-300/50 dark:hover:bg-primary-700/50 transition-colors"
      @mousedown.prevent="startResize('left', $event)"
    />
    <PreviewContent class="min-w-0" />
    <div
      class="w-[5px] flex-shrink-0 mx-[2px] cursor-ew-resize rounded hover:bg-primary-300/50 dark:hover:bg-primary-700/50 transition-colors"
      @mousedown.prevent="startResize('right', $event)"
    />
    <div :style="{ width: liveOutputWidth + 'px', flexShrink: 0 }">
      <LiveOutput />
    </div>
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
import { useAuthStore } from "~/store/auth"
import { ref, computed } from "vue"
import { useDebounceFn, useOnline } from "@vueuse/core"
import type { Emitter } from "mitt"
import type { Slide } from "~/types"
import type { Socket } from "socket.io-client"

const appStore = useAppStore()
const authStore = useAuthStore()
const emitter = useNuxtApp().$emitter as Emitter<any>
const toast = useToast()
const socketInstance = ref<ReturnType<typeof useSocketIO> | null>(null)
const MAX_RETRIES = 10
let retryCount = 0

// Resizable panel widths
const QA_MIN_WIDTH = 200
const QA_MAX_WIDTH = 500
const QA_DEFAULT_WIDTH = 330
const LO_MIN_WIDTH = 250
const LO_MAX_WIDTH = 600
const LO_DEFAULT_WIDTH = 400

const quickActionsWidth = ref(QA_DEFAULT_WIDTH)
const liveOutputWidth = ref(LO_DEFAULT_WIDTH)

let resizingPanel: "left" | "right" | null = null
let resizeStartX = 0
let resizeStartWidth = 0

const startResize = (panel: "left" | "right", event: MouseEvent) => {
  resizingPanel = panel
  resizeStartX = event.clientX
  resizeStartWidth =
    panel === "left" ? quickActionsWidth.value : liveOutputWidth.value
  document.addEventListener("mousemove", onResizeMove)
  document.addEventListener("mouseup", onResizeEnd)
  document.body.style.cursor = "ew-resize"
  document.body.style.userSelect = "none"
}

const onResizeMove = (event: MouseEvent) => {
  if (!resizingPanel) return
  const delta = event.clientX - resizeStartX
  if (resizingPanel === "left") {
    quickActionsWidth.value = Math.min(
      QA_MAX_WIDTH,
      Math.max(QA_MIN_WIDTH, resizeStartWidth + delta)
    )
  } else {
    liveOutputWidth.value = Math.min(
      LO_MAX_WIDTH,
      Math.max(LO_MIN_WIDTH, resizeStartWidth - delta)
    )
  }
}

const onResizeEnd = () => {
  resizingPanel = null
  document.removeEventListener("mousemove", onResizeMove)
  document.removeEventListener("mouseup", onResizeEnd)
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
}

// Realtime slides handling
const {
  handleWebSocketMessage,
  updateOnlineUsers,
  cleanup: cleanupRealtimeSlides,
} = useRealtimeSlides({
  onSlideCreated: (slide, createdByName) => {
    toast.add({
      title: `${createdByName} added a new slide`,
      icon: "i-tabler-plus",
      color: "blue",
      timeout: 3000,
    })
  },
  onSlideUpdated: (slide, updatedByName) => {
    // Silent update - no toast for every update to avoid noise
  },
  onSlideDeleted: (slideId, deletedByName) => {
    toast.add({
      title: `${deletedByName} deleted a slide`,
      icon: "i-tabler-trash",
      color: "amber",
      timeout: 3000,
    })
  },
  onBatchSlidesCreated: (slides, createdByName) => {
    toast.add({
      title: `${createdByName} added ${slides.length} slides`,
      icon: "i-tabler-plus",
      color: "blue",
      timeout: 3000,
    })
  },
  onUserJoined: (user) => {
    // toast.add({
    //   title: `${user.userName} joined the schedule`,
    //   icon: 'i-tabler-user-plus',
    //   color: 'green',
    //   timeout: 3000,
    // })
  },
  onUserLeft: (userId, userName) => {
    // toast.add({
    //   title: `${userName} left the schedule`,
    //   icon: 'i-tabler-user-minus',
    //   color: 'gray',
    //   timeout: 3000,
    // })
  },
})

const uploadOfflineSlides = useDebounceFn(() => {
  useGlobalEmit(appWideActions.uploadOfflineSlides)
}, 2000)

const connectSocket = async () => {
  const scheduleId = appStore.currentState.activeSchedule?._id
  if (!scheduleId) return

  socketInstance.value = useSocketIO({
    scheduleId,
    onMessage: (event, data) => {
      handleWebSocketMessage(data)
    },
    onConnected: () => {
      // Show toast on reconnection (only if we were previously connected and lost connection)
      const wasReconnected = socketInstance.value?.isReconnecting?.value === false && 
        socketInstance.value?.isConnectedRef?.value === true
      
      // Check if this is a reconnection after a disconnect
      if (wasReconnected) {
        toast.add({
          title: 'Connection restored',
          icon: 'i-tabler-wifi',
          color: 'green',
          timeout: 3000,
        })
      }
    },
    onDisconnected: () => {
      // Optionally show disconnect notification
    },
    onOnlineUsersChanged: (users) => {
      updateOnlineUsers(users)
      appStore.setOnlineUsers(users)
    },
    onUserJoined: (user) => {
      appStore.triggerUserJoinedAnimation(user)
    },
  })

  socketInstance.value.connect()
  
  // Watch for reconnection state changes to show toast
  watch(
    () => socketInstance.value?.isConnectedRef?.value,
    (isConnected, wasConnected) => {
      if (isConnected && wasConnected === false) {
        toast.add({
          title: 'Connection restored',
          icon: 'i-tabler-wifi',
          color: 'green',
          timeout: 3000,
        })
      } else if (!isConnected && wasConnected === true) {
        toast.add({
          title: 'Connection lost. Reconnecting...',
          icon: 'i-tabler-wifi-off',
          color: 'yellow',
          timeout: 3000,
        })
      }
    }
  )
}

const disconnectSocket = () => {
  socketInstance.value?.disconnect()
  cleanupRealtimeSlides()
  appStore.setOnlineUsers([])
}

const sendLiveSlideToSocket = (slide: Slide) => {
  if (!socketInstance.value?.isConnected()) {
    console.error(
      "Error sending live slide to socket",
      "Socket.IO not connected"
    )
  } else {
    socketInstance.value.sendLiveSlide(slide)
  }
}

watch(
  () => appStore.currentState.liveSlideId,
  (liveSlideId) => {
    const liveSlide = appStore.currentState.activeSlides.find(
      (slide) => slide.id === liveSlideId
    )
    if (liveSlide) {
      sendLiveSlideToSocket(liveSlide)
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

  // Connect to Socket.IO
  if (appStore.currentState.activeSchedule) {
    connectSocket()
  }
})

// Watch for schedule changes to reconnect Socket
watch(
  () => appStore.currentState.activeSchedule?._id,
  (newScheduleId, oldScheduleId) => {
    if (newScheduleId && newScheduleId !== oldScheduleId) {
      disconnectSocket()
      setTimeout(() => {
        connectSocket()
      }, 500)
    }
  }
)

// Cleanup on unmount
onBeforeUnmount(() => {
  disconnectSocket()
  document.removeEventListener("mousemove", onResizeMove)
  document.removeEventListener("mouseup", onResizeEnd)
})

emitter.on("refresh-slides", () => {
  if (!socketInstance.value?.isConnected()) {
    connectSocket()
  }
})
</script>
