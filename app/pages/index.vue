<template #default="{ defaultProps }">
  <div class="flex mt-4 px-4 h-[calc(100vh-80px)]">
    <div
      :style="{ width: quickActionsWidth + 'px', flexShrink: 0 }"
      class="h-full"
    >
      <QuickActions />
    </div>
    <div
      class="w-2 flex-shrink-0 mx-1 cursor-ew-resize rounded opacity-0 hover:opacity-100 hover:bg-primary-300/40 dark:hover:bg-[#313a4d]/70 transition-opacity"
      @mousedown.prevent="startResize('left', $event)"
    />
    <PreviewContent class="flex-1 min-w-0 h-full" />
    <div
      class="w-2 flex-shrink-0 mx-1 cursor-ew-resize rounded opacity-0 hover:opacity-100 hover:bg-primary-300/40 dark:hover:bg-[#313a4d]/70 transition-opacity"
      @mousedown.prevent="startResize('right', $event)"
    />
    <div
      :style="{ width: liveOutputWidth + 'px', flexShrink: 0 }"
      class="h-full"
    >
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
import { PANEL_SIZE_LIMITS, useAppStore } from "~/store/app"
import { ref } from "vue"
import { useDebounceFn, useOnline } from "@vueuse/core"
import type { Emitter } from "mitt"

const appStore = useAppStore()
const emitter = useNuxtApp().$emitter as Emitter<any>
const toast = useToast()
const socketInstance = ref<ReturnType<typeof useSocketIO> | null>(null)
const MAX_RETRIES = 10
let retryCount = 0

// Resizable panel widths
const QA_MIN_WIDTH = PANEL_SIZE_LIMITS.quickActionsWidth.min
const QA_MAX_WIDTH = PANEL_SIZE_LIMITS.quickActionsWidth.max
const LO_MIN_WIDTH = PANEL_SIZE_LIMITS.liveOutputWidth.min
const LO_MAX_WIDTH = PANEL_SIZE_LIMITS.liveOutputWidth.max

const quickActionsWidth = ref(appStore.panelSize("quickActionsWidth"))
const liveOutputWidth = ref(appStore.panelSize("liveOutputWidth"))

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
  if (resizingPanel === "left") {
    appStore.setPanelSize("quickActionsWidth", quickActionsWidth.value)
  } else if (resizingPanel === "right") {
    appStore.setPanelSize("liveOutputWidth", liveOutputWidth.value)
  }
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
  // onSlideCreated: (slide, createdByName) => {
  //   toast.add({
  //     title: `${createdByName} added a new slide`,
  //     icon: "i-tabler-plus",
  //     color: "blue",
  //     timeout: 3000,
  //   })
  // },
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
      const wasReconnected =
        socketInstance.value?.isReconnecting?.value === false &&
        socketInstance.value?.isConnectedRef?.value === true

      // Check if this is a reconnection after a disconnect
      if (wasReconnected) {
        toast.add({
          title: "Connection restored",
          icon: "i-tabler-wifi",
          color: "green",
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
          title: "Connection restored",
          icon: "i-tabler-wifi",
          color: "green",
          timeout: 3000,
        })
      } else if (!isConnected && wasConnected === true) {
        toast.add({
          title: "Connection lost. Reconnecting...",
          icon: "i-tabler-wifi-off",
          color: "yellow",
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

onMounted(async () => {
  const emailChange = useRoute().query.email_change

  // console.log("emailChange", emailChange)
  if (emailChange) {
    setTimeout(() => {
      useGlobalEmit(appWideActions.openSettings, "Profile Settings")
    }, 1000)
  }

  // Check for pending plan_id from signup flow
  try {
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
  } catch {
    // localStorage unavailable (private mode / SecurityError)
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
  appStore.setPanelSize("quickActionsWidth", quickActionsWidth.value)
  appStore.setPanelSize("liveOutputWidth", liveOutputWidth.value)
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
