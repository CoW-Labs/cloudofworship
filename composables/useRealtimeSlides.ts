import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Slide } from "~/types"
import type { OnlineUser, SlideEditLock } from "./useSocket"

interface RealtimeSlidesOptions {
  onSlideCreated?: (slide: Slide, createdByName: string) => void
  onSlideUpdated?: (slide: Slide, updatedByName: string) => void
  onSlideDeleted?: (slideId: string, deletedByName: string) => void
  onBatchSlidesCreated?: (slides: Slide[], createdByName: string) => void
  onBatchSlidesUpdated?: (slides: Slide[], updatedByName: string) => void
  onBatchSlidesDeleted?: (slideIds: string[], deletedByName: string) => void
  onSlidesReordered?: (slideOrder: string[], reorderedByName: string) => void
  onSlideEditing?: (slideId: string, userName: string) => void
  onSlideLocked?: (lock: SlideEditLock) => void
  onSlideUnlocked?: (slideId: string) => void
  onUserJoined?: (user: OnlineUser) => void
  onUserLeft?: (userId: string, userName: string) => void
}

/**
 * Generate a unique tab/session ID for this browser tab
 * This allows the same user to collaborate across multiple tabs/devices
 * Each tab gets its own unique ID that persists for the session
 */
const tabSessionId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

// Export the tab session ID for use in other modules
export { tabSessionId }

export const useRealtimeSlides = (options: RealtimeSlidesOptions = {}) => {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()

  // Track online users
  const onlineUsers = ref<OnlineUser[]>([])
  const onlineCount = computed(() => onlineUsers.value.length)

  // Track which slides are being edited by others (using Record for localStorage compatibility)
  const slidesBeingEdited = ref<Record<string, { userId: string; userName: string }>>({})

  // Track slide locks
  const slideLocks = ref<Record<string, SlideEditLock>>({})

  // Lock refresh interval (every 15 seconds)
  let lockRefreshInterval: NodeJS.Timeout | null = null
  const currentLockedSlideId = ref<string | null>(null)

  /**
   * Check if a slide is being edited by someone else
   */
  const isSlideBeingEdited = (slideId: string): boolean => {
    const editInfo = slidesBeingEdited.value[slideId]
    return editInfo !== undefined && editInfo.userId !== authStore.user?._id
  }

  /**
   * Get the name of the user editing a slide
   */
  const getSlideEditor = (slideId: string): string | null => {
    const editInfo = slidesBeingEdited.value[slideId]
    if (editInfo && editInfo.userId !== authStore.user?._id) {
      return editInfo.userName
    }
    return null
  }

  /**
   * Check if a slide is locked by someone else
   */
  const isSlideLockedByOther = (slideId: string): boolean => {
    const lock = slideLocks.value[slideId]
    return lock !== undefined && lock.lockedBy !== authStore.user?._id
  }

  /**
   * Get lock info for a slide
   */
  const getSlideLock = (slideId: string): SlideEditLock | undefined => {
    return slideLocks.value[slideId]
  }

  /**
   * Handle incoming WebSocket messages
   */
  const handleWebSocketMessage = (message: any) => {
    const { action, data } = message

    switch (action) {
      case 'slide-created':
      case 'create-slide':
        // Don't process updates from the same tab (tabId check)
        // This allows same user on different tabs/devices to receive updates
        if (data.tabId === tabSessionId) return

        // Add slide to store
        if (data && data.id) {
          const newSlide = { ...data } as Slide
          delete (newSlide as any).createdBy
          delete (newSlide as any).createdByName
          delete (newSlide as any).timestamp
          delete (newSlide as any).tabId

          appStore.appendActiveSlide(newSlide)
          options.onSlideCreated?.(newSlide, data.createdByName)
        }
        break

      case 'slide-updated':
      case 'update-slide':
        // Don't process updates from the same tab
        // This allows same user on different tabs/devices to receive updates
        if (data.tabId === tabSessionId) return

        // Update slide in store
        if (data && (data.id || data._id || data.slideId)) {
          const slideId = data.slideId || data.id || data._id
          const slideIndex = appStore.currentState.activeSlides.findIndex(
            (s) => s.id === slideId || s._id === data._id
          )

          if (slideIndex !== -1) {
            const updatedSlide = { ...data } as Slide
            delete (updatedSlide as any).updatedBy
            delete (updatedSlide as any).updatedByName
            delete (updatedSlide as any).timestamp
            delete (updatedSlide as any).tabId

            // Merge with existing slide to preserve local-only properties
            const existingSlide = appStore.currentState.activeSlides[slideIndex]
            const mergedSlide = { ...existingSlide, ...updatedSlide }

            appStore.currentState.activeSlides.splice(slideIndex, 1, mergedSlide)
            options.onSlideUpdated?.(mergedSlide, data.updatedByName)
          }
        }
        break

      case 'slide-deleted':
      case 'delete-slide':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slideId) {
          const slideToRemove = appStore.currentState.activeSlides.find(
            (s) => s.id === data.slideId
          )
          if (slideToRemove) {
            appStore.removeActiveSlide(slideToRemove)
            options.onSlideDeleted?.(data.slideId, data.deletedByName)
          }
        }
        break

      case 'slides-batch-created':
      case 'batch-create-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slides && Array.isArray(data.slides)) {
          const newSlides = data.slides.map((s: any) => {
            const slide = { ...s }
            delete slide.createdBy
            delete slide.createdByName
            delete slide.timestamp
            delete slide.tabId
            return slide
          })
          appStore.appendActiveSlides(newSlides)
          options.onBatchSlidesCreated?.(newSlides, data.createdByName)
        }
        break

      case 'slides-batch-updated':
      case 'batch-update-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slides && Array.isArray(data.slides)) {
          data.slides.forEach((updatedSlide: Slide) => {
            const slideIndex = appStore.currentState.activeSlides.findIndex(
              (s) => s.id === updatedSlide.id || s._id === updatedSlide._id
            )
            if (slideIndex !== -1) {
              const existingSlide = appStore.currentState.activeSlides[slideIndex]
              const mergedSlide = { ...existingSlide, ...updatedSlide }
              appStore.currentState.activeSlides.splice(slideIndex, 1, mergedSlide)
            }
          })
          options.onBatchSlidesUpdated?.(data.slides, data.updatedByName)
        }
        break

      case 'slides-batch-deleted':
      case 'batch-delete-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        if (data.slideIds && Array.isArray(data.slideIds)) {
          data.slideIds.forEach((slideId: string) => {
            const slideToRemove = appStore.currentState.activeSlides.find(
              (s) => s.id === slideId
            )
            if (slideToRemove) {
              appStore.removeActiveSlide(slideToRemove)
            }
          })
          options.onBatchSlidesDeleted?.(data.slideIds, data.deletedByName)
        }
        break

      case 'reorder-slides':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        // Handle slide reorder from other tabs/devices
        if (data.slideOrder && Array.isArray(data.slideOrder)) {
          const reorderedSlides = data.slideOrder
            .map((slideId: string) => 
              appStore.currentState.activeSlides.find((s) => s.id === slideId)
            )
            .filter((s: Slide | undefined): s is Slide => s !== undefined)
            .map((slide: Slide, index: number) => ({ ...slide, index }))

          if (reorderedSlides.length > 0) {
            appStore.replaceScheduleActiveSlides(reorderedSlides)
            options.onSlidesReordered?.(data.slideOrder, data.reorderedByName)
          }
        }
        break

      case 'slide-editing':
        // Don't process updates from the same tab
        if (data.tabId === tabSessionId) return

        slidesBeingEdited.value[data.slideId] = {
          userId: data.userId,
          userName: data.userName,
        }

        // Also update store for component reactivity
        appStore.setSlideBeingEdited(data.slideId, data.userId, data.userName)

        options.onSlideEditing?.(data.slideId, data.userName)

        // Auto-clear after 35 seconds (lock timeout + buffer)
        setTimeout(() => {
          const editInfo = slidesBeingEdited.value[data.slideId]
          if (editInfo?.userId === data.userId) {
            delete slidesBeingEdited.value[data.slideId]
            appStore.clearSlideBeingEdited(data.slideId)
          }
        }, 35000)
        break

      case 'slide-locked':
        slideLocks.value[data.slideId] = {
          slideId: data.slideId,
          lockedBy: data.lockedBy,
          lockedByName: data.lockedByName,
        }
        options.onSlideLocked?.({
          slideId: data.slideId,
          lockedBy: data.lockedBy,
          lockedByName: data.lockedByName,
        })
        break

      case 'slide-unlocked':
        delete slideLocks.value[data.slideId]
        delete slidesBeingEdited.value[data.slideId]
        appStore.clearSlideBeingEdited(data.slideId)
        options.onSlideUnlocked?.(data.slideId)
        break

      case 'lock-denied':
        toast.add({
          title: `Slide is being edited by ${data.lockedByName}`,
          icon: 'i-tabler-lock',
          color: 'amber',
        })
        break

      case 'lock-granted':
        currentLockedSlideId.value = data.slideId
        startLockRefresh()
        break

      case 'user-joined':
        // User joined events should be processed for all users
        options.onUserJoined?.({
          userId: data.userId,
          userName: data.userName,
          avatar: data.avatar,
          scheduleId: data.scheduleId,
          joinedAt: new Date().toISOString(),
          theme: data.theme,
        })
        if (data.onlineUsers) {
          onlineUsers.value = data.onlineUsers
        }
        break

      case 'user-left':
        // User left events should be processed for all users
        options.onUserLeft?.(data.userId, data.userName)
        if (data.onlineUsers) {
          onlineUsers.value = data.onlineUsers
        }
        break

      case 'live-slide':
        // Handle live slide updates (existing functionality)
        break
    }
  }

  /**
   * Update online users list
   */
  const updateOnlineUsers = (users: OnlineUser[]) => {
    onlineUsers.value = users
  }

  /**
   * Start the lock refresh interval
   */
  const startLockRefresh = () => {
    stopLockRefresh()
    lockRefreshInterval = setInterval(() => {
      if (currentLockedSlideId.value) {
        const nuxtApp = useNuxtApp()
        const socket = nuxtApp.$socket as WebSocket
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            action: 'refresh-lock',
            data: { slideId: currentLockedSlideId.value },
          }))
        }
      }
    }, 15000) // Refresh every 15 seconds
  }

  /**
   * Stop the lock refresh interval
   */
  const stopLockRefresh = () => {
    if (lockRefreshInterval) {
      clearInterval(lockRefreshInterval)
      lockRefreshInterval = null
    }
  }

  /**
   * Release current lock
   */
  const releaseCurrentLock = () => {
    if (currentLockedSlideId.value) {
      const nuxtApp = useNuxtApp()
      const socket = nuxtApp.$socket as WebSocket
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          action: 'unlock-slide',
          data: { slideId: currentLockedSlideId.value },
        }))
      }
      currentLockedSlideId.value = null
      stopLockRefresh()
    }
  }

  /**
   * Cleanup on unmount
   */
  const cleanup = () => {
    releaseCurrentLock()
    stopLockRefresh()
    slidesBeingEdited.value = {}
    slideLocks.value = {}
    onlineUsers.value = []
    appStore.clearAllSlidesBeingEdited()
    appStore.setOnlineUsers([])
  }

  return {
    // State
    onlineUsers: readonly(onlineUsers),
    onlineCount,
    slidesBeingEdited: readonly(slidesBeingEdited),
    slideLocks: readonly(slideLocks),
    currentLockedSlideId: readonly(currentLockedSlideId),

    // Methods
    handleWebSocketMessage,
    updateOnlineUsers,
    isSlideBeingEdited,
    getSlideEditor,
    isSlideLockedByOther,
    getSlideLock,
    releaseCurrentLock,
    cleanup,
  }
}
