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
  onSlideEditing?: (slideId: string, userName: string) => void
  onSlideLocked?: (lock: SlideEditLock) => void
  onSlideUnlocked?: (slideId: string) => void
  onUserJoined?: (user: OnlineUser) => void
  onUserLeft?: (userId: string, userName: string) => void
}

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
    const currentUserId = authStore.user?._id

    switch (action) {
      case 'slide-created':
        // Don't process our own updates
        if (data.createdBy === currentUserId) return

        // Add slide to store
        if (data && data.id) {
          const newSlide = { ...data } as Slide
          delete (newSlide as any).createdBy
          delete (newSlide as any).createdByName
          delete (newSlide as any).timestamp

          appStore.appendActiveSlide(newSlide)
          options.onSlideCreated?.(newSlide, data.createdByName)
        }
        break

      case 'slide-updated':
        if (data.updatedBy === currentUserId) return

        // Update slide in store
        if (data && (data.id || data._id)) {
          const slideId = data.id || data._id
          const slideIndex = appStore.currentState.activeSlides.findIndex(
            (s) => s.id === slideId || s._id === data._id
          )

          if (slideIndex !== -1) {
            const updatedSlide = { ...data } as Slide
            delete (updatedSlide as any).updatedBy
            delete (updatedSlide as any).updatedByName
            delete (updatedSlide as any).timestamp

            // Merge with existing slide to preserve local-only properties
            const existingSlide = appStore.currentState.activeSlides[slideIndex]
            const mergedSlide = { ...existingSlide, ...updatedSlide }

            appStore.currentState.activeSlides.splice(slideIndex, 1, mergedSlide)
            options.onSlideUpdated?.(mergedSlide, data.updatedByName)
          }
        }
        break

      case 'slide-deleted':
        if (data.deletedBy === currentUserId) return

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
        if (data.createdBy === currentUserId) return

        if (data.slides && Array.isArray(data.slides)) {
          const newSlides = data.slides.map((s: any) => {
            const slide = { ...s }
            delete slide.createdBy
            delete slide.createdByName
            delete slide.timestamp
            return slide
          })
          appStore.appendActiveSlides(newSlides)
          options.onBatchSlidesCreated?.(newSlides, data.createdByName)
        }
        break

      case 'slides-batch-updated':
        if (data.updatedBy === currentUserId) return

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
        if (data.deletedBy === currentUserId) return

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

      case 'slide-editing':
        if (data.userId === currentUserId) return

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
        if (data.userId !== currentUserId) {
          options.onUserJoined?.({
            userId: data.userId,
            userName: data.userName,
            avatar: data.avatar,
            scheduleId: data.scheduleId,
            joinedAt: new Date().toISOString(),
            theme: data.theme,
          })
        }
        if (data.onlineUsers) {
          onlineUsers.value = data.onlineUsers
        }
        break

      case 'user-left':
        if (data.userId !== currentUserId) {
          options.onUserLeft?.(data.userId, data.userName)
        }
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
