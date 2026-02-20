import { io, Socket } from "socket.io-client"
import { useAuthStore } from "~/store/auth"
import { useOnline } from "@vueuse/core"
import { watch, onUnmounted, ref } from "vue"

interface SocketIOOptions {
  scheduleId: string
  maxRetries?: number
  baseRetryDelay?: number
  maxRetryDelay?: number
  connectionTimeout?: number
  onMessage?: (event: string, data: any) => void
  onConnected?: (data?: any) => void
  onDisconnected?: () => void
  onError?: (error: any) => void
  onMaxRetriesReached?: () => void
  onOnlineUsersChanged?: (users: OnlineUser[]) => void
  onUserJoined?: (user: OnlineUser) => void
  onUserLeft?: (userId: string, userName: string) => void
}

export interface OnlineUser {
  userId: string
  userName: string
  avatar: string
  scheduleId: string
  joinedAt: string
  theme: string
}

export interface SlideEditLock {
  slideId: string
  lockedBy: string
  lockedByName: string
}

export const useSocketIO = (options: SocketIOOptions) => {
  const {
    scheduleId,
    maxRetries = 30,
    baseRetryDelay = 1000,
    maxRetryDelay = 30000,
    connectionTimeout = 10000,
    onMessage,
    onConnected,
    onDisconnected,
    onError,
    onMaxRetriesReached,
    onOnlineUsersChanged,
    onUserJoined,
    onUserLeft,
  } = options

  const runtimeConfig = useRuntimeConfig()
  const online = useOnline()
  const nuxtApp = useNuxtApp()
  const authStore = useAuthStore()

  let socket: Socket | null = null
  let retryCount = 0
  let reconnectTimer: NodeJS.Timeout | null = null
  let isIntentionallyClosed = false
  let hasBeenConnected = false

  // Connection state for reactivity
  const isConnectedRef = ref(false)
  const isReconnecting = ref(false)

  // Offline message queue
  const messageQueue: Array<{ event: string; data: any }> = []

  // Watch for online status changes
  const stopOnlineWatcher = watch(
    () => online.value,
    (isOnline, wasOnline) => {
      if (isOnline && !wasOnline) {
        // Coming back online
        isReconnecting.value = true

        // Give the network a moment to stabilize
        setTimeout(() => {
          if (!isIntentionallyClosed && hasBeenConnected) {
            if (!socket?.connected) {
              retryCount = 0 // Reset retry count for fresh reconnection
              reconnect()
            } else {
              flushMessageQueue()
              isReconnecting.value = false
            }
          }
        }, 500)
      } else if (!isOnline && wasOnline) {
        // Going offline
        isReconnecting.value = true
      }
    },
    { immediate: false }
  )

  /**
   * Reconnect the socket after network restoration
   */
  const reconnect = () => {
    if (isIntentionallyClosed) {
      isReconnecting.value = false
      return
    }

    // Close existing socket if any
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }

    // Reconnect
    connect()
  }

  const getSocketUrl = () => {
    // For Socket.IO, we need just the origin (protocol + host + port)
    // BASE_URL might be something like "http://localhost:4500/api/v1"
    // We need to extract just "http://localhost:4500"
    let baseUrl = runtimeConfig.public.BASE_URL || 'http://localhost:4500'

    try {
      const url = new URL(baseUrl)
      // Return just the origin (protocol + host + port)
      return url.origin
    } catch (e) {
      // If URL parsing fails, try to extract origin manually
      // Remove any path after the domain/port
      const match = baseUrl.match(/^(https?:\/\/[^\/]+)/)
      if (match) {
        return match[1]
      }
      return baseUrl
    }
  }

  const getConnectionQuery = () => {
    const churchId = authStore.church?._id || ''
    const userId = authStore.user?._id || ''
    // Don't double-encode - Socket.IO handles encoding
    const userName = authStore.user?.fullname || 'Anonymous'
    const avatar = authStore.user?.avatar || ''
    const theme = authStore.user?.theme ? `#${authStore.user?.theme}` : '#6366f1'

    return {
      schedule_id: scheduleId,
      church_id: churchId,
      user_id: userId,
      user_name: userName,
      avatar,
      theme,
    }
  }

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const calculateRetryDelay = () => {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      baseRetryDelay * Math.pow(2, retryCount),
      maxRetryDelay
    )
    const jitter = Math.random() * 1000
    return exponentialDelay + jitter
  }

  /**
   * Flush queued messages when connection is restored
   */
  const flushMessageQueue = () => {
    while (messageQueue.length > 0 && socket?.connected) {
      const message = messageQueue.shift()
      if (message) {
        try {
          socket.emit(message.event, message.data)
        } catch (error) {
          console.error('Failed to send queued message:', error)
          messageQueue.unshift(message)
          break
        }
      }
    }
  }

  const connect = () => {
    if (isIntentionallyClosed) {
      return null
    }

    if (!online.value) {
      scheduleReconnect()
      return null
    }

    if (socket?.connected) {
      return socket
    }

    try {
      clearTimers()

      socket = io(getSocketUrl(), {
        path: '/socket.io/',
        query: getConnectionQuery(),
        // Start with polling first (more reliable behind proxies/load balancers)
        // then upgrade to websocket
        transports: ['polling', 'websocket'],
        upgrade: true,
        timeout: connectionTimeout,
        reconnection: true,
        reconnectionAttempts: maxRetries,
        reconnectionDelay: baseRetryDelay,
        reconnectionDelayMax: maxRetryDelay,
        autoConnect: true,
        forceNew: true,
        // Increase timeouts for production environments with proxies
        rememberUpgrade: true,
      })

      // Provide socket to Nuxt app
      if (!nuxtApp.$socketio) {
        nuxtApp.provide('socketio', socket)
      }

      // Connection events
      socket.on('connect', () => {
        retryCount = 0
        hasBeenConnected = true
        isConnectedRef.value = true
        isReconnecting.value = false
        flushMessageQueue()
      })

      socket.on('connected', (data) => {
        isConnectedRef.value = true
        isReconnecting.value = false
        if (data?.onlineUsers) {
          onOnlineUsersChanged?.(data.onlineUsers)
        }
        onConnected?.(data)
      })

      socket.on('disconnect', (reason) => {
        isConnectedRef.value = false
        onDisconnected?.()

        if (!isIntentionallyClosed && reason !== 'io client disconnect') {
          // Will auto-reconnect via Socket.IO's built-in reconnection
          // or via our online watcher
          isReconnecting.value = true
        }
      })

      socket.on('reconnect', (attemptNumber) => {
        isConnectedRef.value = true
        isReconnecting.value = false
        flushMessageQueue()
      })

      socket.on('reconnect_attempt', (attemptNumber) => {
        isReconnecting.value = true
      })

      socket.on('reconnect_failed', () => {
        isReconnecting.value = false
        onMaxRetriesReached?.()
      })

      socket.on('connect_error', (error: any) => {
        console.error('Socket.IO connection error:', error.message)
        console.error('Socket.IO error details:', {
          type: error?.type,
          description: error?.description,
          context: error?.context,
          transport: socket?.io?.engine?.transport?.name,
        })
        isConnectedRef.value = false
        onError?.(error)

        retryCount++
        if (retryCount >= maxRetries) {
          onMaxRetriesReached?.()
        }
      })

      // User events - instant notifications
      socket.on('user-joined', (data) => {
        if (data?.onlineUsers) {
          onOnlineUsersChanged?.(data.onlineUsers)
        }
        onUserJoined?.({
          userId: data.userId,
          userName: data.userName,
          avatar: data.avatar,
          scheduleId: data.scheduleId,
          joinedAt: new Date().toISOString(),
          theme: data.theme,
        })
        onMessage?.('user-joined', data)
      })

      socket.on('user-left', (data) => {
        if (data?.onlineUsers) {
          onOnlineUsersChanged?.(data.onlineUsers)
        }
        onUserLeft?.(data.userId, data.userName)
        onMessage?.('user-left', data)
      })

      // Slide events
      socket.on('slide-created', (data) => {
        onMessage?.('slide-created', { action: 'slide-created', data })
      })

      socket.on('slide-updated', (data) => {
        onMessage?.('slide-updated', { action: 'slide-updated', data })
      })

      socket.on('slide-deleted', (data) => {
        onMessage?.('slide-deleted', { action: 'slide-deleted', data })
      })

      socket.on('slides-batch-created', (data) => {
        onMessage?.('slides-batch-created', { action: 'slides-batch-created', data })
      })

      socket.on('slides-batch-updated', (data) => {
        onMessage?.('slides-batch-updated', { action: 'slides-batch-updated', data })
      })

      socket.on('slides-batch-deleted', (data) => {
        onMessage?.('slides-batch-deleted', { action: 'slides-batch-deleted', data })
      })

      socket.on('slides-reordered', (data) => {
        onMessage?.('reorder-slides', { action: 'reorder-slides', data })
      })

      // Slide locking events
      socket.on('slide-locked', (data) => {
        onMessage?.('slide-locked', { action: 'slide-locked', data })
      })

      socket.on('slide-unlocked', (data) => {
        onMessage?.('slide-unlocked', { action: 'slide-unlocked', data })
      })

      socket.on('slide-editing', (data) => {
        onMessage?.('slide-editing', { action: 'slide-editing', data })
      })

      socket.on('lock-granted', (data) => {
        onMessage?.('lock-granted', { action: 'lock-granted', data })
      })

      socket.on('lock-denied', (data) => {
        onMessage?.('lock-denied', { action: 'lock-denied', data })
      })

      // Live slide sync
      socket.on('live-slide', (data) => {
        onMessage?.('live-slide', { action: 'live-slide', data })
      })

      // Alert and overlay events
      socket.on('add-alert', (data) => {
        onMessage?.('add-alert', { action: 'add-alert', data })
      })

      socket.on('remove-alert', (data) => {
        onMessage?.('remove-alert', { action: 'remove-alert', data })
      })

      socket.on('add-overlay', (data) => {
        onMessage?.('add-overlay', { action: 'add-overlay', data })
      })

      socket.on('remove-overlay', (data) => {
        onMessage?.('remove-overlay', { action: 'remove-overlay', data })
      })

      // Ping/pong
      socket.on('pong', () => {
        // Heartbeat received
      })

      socket.on('online-users', (data) => {
        if (data?.onlineUsers) {
          onOnlineUsersChanged?.(data.onlineUsers)
        }
      })

      return socket
    } catch (error) {
      console.error('Failed to create Socket.IO connection:', error)
      scheduleReconnect()
      return null
    }
  }

  const scheduleReconnect = () => {
    if (isIntentionallyClosed) return

    const delay = calculateRetryDelay()
    retryCount++

    if (retryCount >= maxRetries) {
      console.error(`Max reconnection attempts (${maxRetries}) reached. Giving up.`)
      onMaxRetriesReached?.()
      return
    }

    reconnectTimer = setTimeout(() => {
      if (online.value && !isIntentionallyClosed) {
        connect()
      } else if (!online.value) {
        scheduleReconnect()
      }
    }, delay)
  }

  const disconnect = () => {
    isIntentionallyClosed = true
    isConnectedRef.value = false
    isReconnecting.value = false
    clearTimers()
    stopOnlineWatcher() // Stop watching online status

    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }
  }

  const emit = (event: string, data: any) => {
    // Don't send or queue messages when offline
    if (!online.value) {
      console.warn('Device is offline. Message not sent.')
      return false
    }

    if (socket?.connected) {
      try {
        socket.emit(event, data)
        return true
      } catch (error) {
        console.error('Failed to emit event:', error)
        messageQueue.push({ event, data })
        return false
      }
    } else {
      console.warn('Socket.IO is not connected. Queueing message for later.')
      messageQueue.push({ event, data })
      return false
    }
  }

  /**
   * Send slide creation event
   */
  const sendSlideCreated = (slide: any) => {
    return emit('create-slide', slide)
  }

  /**
   * Send slide update event
   */
  const sendSlideUpdated = (slide: any) => {
    return emit('update-slide', slide)
  }

  /**
   * Send slide deletion event
   */
  const sendSlideDeleted = (slideId: string) => {
    return emit('delete-slide', { slideId })
  }

  /**
   * Send batch slides created event
   */
  const sendBatchSlidesCreated = (slides: any[]) => {
    return emit('batch-create-slides', { slides })
  }

  /**
   * Send batch slides updated event
   */
  const sendBatchSlidesUpdated = (slides: any[]) => {
    return emit('batch-update-slides', { slides })
  }

  /**
   * Send batch slides deleted event
   */
  const sendBatchSlidesDeleted = (slideIds: string[]) => {
    return emit('batch-delete-slides', { slideIds })
  }

  /**
   * Request a lock on a slide for editing
   */
  const lockSlide = (slideId: string) => {
    return emit('lock-slide', { slideId })
  }

  /**
   * Release a lock on a slide
   */
  const unlockSlide = (slideId: string) => {
    return emit('unlock-slide', { slideId })
  }

  /**
   * Refresh a lock on a slide
   */
  const refreshLock = (slideId: string) => {
    return emit('refresh-lock', { slideId })
  }

  /**
   * Send live slide update
   */
  const sendLiveSlide = (slide: any) => {
    return emit('live-slide', slide)
  }

  /**
   * Send slide reorder event
   */
  const sendSlideReorder = (slideOrder: string[], tabId: string) => {
    return emit('reorder-slides', { slideOrder, tabId })
  }

  /**
   * Request online users
   */
  const getOnlineUsers = () => {
    return emit('get-online-users', {})
  }

  /**
   * Check if connected
   */
  const isConnected = () => {
    return socket?.connected || false
  }

  /**
   * Get the socket instance
   */
  const getSocket = () => {
    return socket
  }

  return {
    connect,
    disconnect,
    reconnect,
    emit,
    isConnected,
    getSocket,

    // Reactive state
    isConnectedRef,
    isReconnecting,
    online,

    // Slide operations
    sendSlideCreated,
    sendSlideUpdated,
    sendSlideDeleted,
    sendBatchSlidesCreated,
    sendBatchSlidesUpdated,
    sendBatchSlidesDeleted,
    sendSlideReorder,

    // Locking
    lockSlide,
    unlockSlide,
    refreshLock,

    // Live slide
    sendLiveSlide,

    // Users
    getOnlineUsers,
  }
}
