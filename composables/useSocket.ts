import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { useOnline } from "@vueuse/core"

interface WebSocketOptions {
  scheduleId: string
  maxRetries?: number
  baseRetryDelay?: number
  maxRetryDelay?: number
  connectionTimeout?: number
  heartbeatInterval?: number
  onMessage?: (data: any) => void
  onConnected?: (data?: any) => void
  onDisconnected?: () => void
  onError?: (error: Event) => void
  onMaxRetriesReached?: () => void
  onOnlineUsersChanged?: (users: OnlineUser[]) => void
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

export const useSocket = (options: WebSocketOptions) => {
  const {
    scheduleId,
    maxRetries = 30,
    baseRetryDelay = 3000,
    maxRetryDelay = 30000,
    connectionTimeout = 10000,
    heartbeatInterval = 30000,
    onMessage,
    onConnected,
    onDisconnected,
    onError,
    onMaxRetriesReached,
    onOnlineUsersChanged,
  } = options

  const runtimeConfig = useRuntimeConfig()
  const online = useOnline()
  const nuxtApp = useNuxtApp()
  const authStore = useAuthStore()

  let socket: WebSocket | null = null
  let retryCount = 0
  let reconnectTimer: NodeJS.Timeout | null = null
  let connectionTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null
  let isIntentionallyClosed = false
  let isConnecting = false

  // Offline message queue
  const messageQueue: any[] = []

  const getWebSocketUrl = () => {
    const protocol = process.env.NODE_ENV === 'development' ? 'ws' : 'wss'
    const baseUrl = runtimeConfig.public.BASE_URL?.split('://')?.[1]
    const churchId = authStore.church?._id || ''
    const userId = authStore.user?._id || ''
    const userName = encodeURIComponent(authStore.user?.fullname || 'Anonymous')
    const avatar = encodeURIComponent(authStore.user?.avatar || '')
    const theme = encodeURIComponent(authStore.user?.theme ? `#${authStore.user?.theme}` : '#6366f1')

    return `${protocol}://${baseUrl}/schedules?schedule_id=${scheduleId}&church_id=${churchId}&user_id=${userId}&user_name=${userName}&avatar=${avatar}&theme=${theme}`
  }

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (connectionTimer) {
      clearTimeout(connectionTimer)
      connectionTimer = null
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  const calculateRetryDelay = () => {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      baseRetryDelay * Math.pow(2, retryCount),
      maxRetryDelay
    )
    const jitter = Math.random() * 1000 // Add up to 1 second of jitter
    return exponentialDelay + jitter
  }

  const startHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer)

    heartbeatTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify({ action: 'ping', data: 'reconnect' }))
        } catch (error) {
          console.error('Failed to send heartbeat:', error)
          reconnect()
        }
      }
    }, heartbeatInterval)
  }

  /**
   * Flush queued messages when connection is restored
   */
  const flushMessageQueue = () => {
    while (messageQueue.length > 0 && socket?.readyState === WebSocket.OPEN) {
      const message = messageQueue.shift()
      try {
        socket.send(JSON.stringify(message))
      } catch (error) {
        console.error('Failed to send queued message:', error)
        messageQueue.unshift(message) // Put it back
        break
      }
    }
  }

  const connect = () => {
    if (isIntentionallyClosed) {
      console.log('WebSocket is intentionally closed. Skipping connection.')
      return
    }

    if (isConnecting) {
      console.log('Connection already in progress. Skipping.')
      return
    }

    if (!online.value) {
      console.log('Device is offline. Skipping WebSocket connection.')
      scheduleReconnect()
      return
    }

    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connected or connecting')
      return
    }

    try {
      isConnecting = true
      clearTimers()

      console.log(`Connecting to WebSocket... (Attempt ${retryCount + 1}/${maxRetries})`)
      socket = new WebSocket(getWebSocketUrl())

      if (nuxtApp.$socket) {
        // nuxtApp.$socket = socket
      } else {
        nuxtApp.provide('socket', socket)
      }


      // Connection timeout
      connectionTimer = setTimeout(() => {
        if (socket?.readyState !== WebSocket.OPEN) {
          console.error('WebSocket connection timeout')
          socket?.close()
          reconnect()
        }
      }, connectionTimeout)

      socket.onopen = (event) => {
        isConnecting = false
        retryCount = 0
        clearTimeout(connectionTimer!)
        console.log('WebSocket connection opened successfully')
        startHeartbeat()
        flushMessageQueue() // Send any queued messages
        onConnected?.()
      }

      socket.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data)

          // Handle pong responses
          if (parsedData.action === 'pong') {
            return
          }

          // Handle connected event with online users
          if (parsedData.action === 'connected' && parsedData.data?.onlineUsers) {
            onOnlineUsersChanged?.(parsedData.data.onlineUsers)
          }

          // Handle user joined/left events
          if ((parsedData.action === 'user-joined' || parsedData.action === 'user-left') && parsedData.data?.onlineUsers) {
            onOnlineUsersChanged?.(parsedData.data.onlineUsers)
          }

          onMessage?.(parsedData)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      socket.onclose = (event) => {
        isConnecting = false
        clearTimers()

        console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`)

        onDisconnected?.()

        // Don't reconnect if closed intentionally (code 1000) or if we've reached max retries
        if (!isIntentionallyClosed && event.code !== 1000) {
          reconnect()
        }
      }

      socket.onerror = (error) => {
        isConnecting = false
        console.error('WebSocket error:', error)
        onError?.(error)
        // Don't close here - let onclose handle reconnection
      }
    } catch (error) {
      isConnecting = false
      console.error('Failed to create WebSocket:', error)
      reconnect()
    }
    return socket
  }

  const reconnect = () => {
    if (isIntentionallyClosed) {
      return
    }

    if (!online.value) {
      console.log('Device is offline. Will retry when online.')
      scheduleReconnect()
      return
    }

    if (retryCount >= maxRetries) {
      console.error(`Max reconnection attempts (${maxRetries}) reached. Giving up.`)
      onMaxRetriesReached?.()
      return
    }

    const delay = calculateRetryDelay()
    retryCount++

    console.log(`Scheduling reconnection attempt ${retryCount}/${maxRetries} in ${(delay / 1000).toFixed(1)}s`)

    reconnectTimer = setTimeout(() => {
      connect()
    }, delay)
  }

  const scheduleReconnect = () => {
    // Schedule a reconnect check for when we might be back online
    reconnectTimer = setTimeout(() => {
      if (online.value && !isIntentionallyClosed) {
        retryCount = 0 // Reset retry count when coming back online
        connect()
      } else {
        scheduleReconnect()
      }
    }, 5000)
  }

  const disconnect = () => {
    isIntentionallyClosed = true
    clearTimers()

    if (socket) {
      // Use code 1000 (normal closure) to indicate intentional disconnect
      socket.close(1000, 'Intentional disconnect')
      socket = null
    }

    console.log('WebSocket intentionally disconnected')
  }

  const send = (data: any) => {
    // Don't send or queue messages when offline
    if (!online.value) {
      console.warn('Device is offline. Message not sent.')
      return false
    }

    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(data))
        return true
      } catch (error) {
        console.error('Failed to send message:', error)
        // Queue message for later if send fails
        messageQueue.push(data)
        return false
      }
    } else {
      console.warn('WebSocket is not connected. Queueing message for later.')
      // Queue message for when connection is restored
      messageQueue.push(data)
      return false
    }
  }

  /**
   * Send slide creation event
   */
  const sendSlideCreated = (slide: any) => {
    return send({
      action: 'create-slide',
      data: slide,
    })
  }

  /**
   * Send slide update event
   */
  const sendSlideUpdated = (slide: any) => {
    return send({
      action: 'update-slide',
      data: slide,
    })
  }

  /**
   * Send slide deletion event
   */
  const sendSlideDeleted = (slideId: string) => {
    return send({
      action: 'delete-slide',
      data: { slideId },
    })
  }

  /**
   * Send batch slides created event
   */
  const sendBatchSlidesCreated = (slides: any[]) => {
    return send({
      action: 'batch-create-slides',
      data: { slides },
    })
  }

  /**
   * Send batch slides updated event
   */
  const sendBatchSlidesUpdated = (slides: any[]) => {
    return send({
      action: 'batch-update-slides',
      data: { slides },
    })
  }

  /**
   * Send batch slides deleted event
   */
  const sendBatchSlidesDeleted = (slideIds: string[]) => {
    return send({
      action: 'batch-delete-slides',
      data: { slideIds },
    })
  }

  /**
   * Request a lock on a slide for editing
   */
  const lockSlide = (slideId: string) => {
    return send({
      action: 'lock-slide',
      data: { slideId },
    })
  }

  /**
   * Release a lock on a slide
   */
  const unlockSlide = (slideId: string) => {
    return send({
      action: 'unlock-slide',
      data: { slideId },
    })
  }

  /**
   * Refresh a lock to prevent timeout
   */
  const refreshLock = (slideId: string) => {
    return send({
      action: 'refresh-lock',
      data: { slideId },
    })
  }

  /**
   * Send live slide update
   */
  const sendLiveSlide = (slide: any) => {
    return send({
      action: 'live-slide',
      data: slide,
    })
  }

  const getState = () => {
    return {
      readyState: socket?.readyState,
      retryCount,
      isConnecting,
      isIntentionallyClosed,
      isOnline: online.value,
      queuedMessages: messageQueue.length,
    }
  }

  // Watch for online/offline changes
  watch(online, (isOnline) => {
    if (isOnline && !isIntentionallyClosed && socket?.readyState !== WebSocket.OPEN) {
      console.log('Device came back online. Attempting to reconnect...')
      retryCount = 0 // Reset retry count when coming back online
      reconnect()
    } else if (!isOnline) {
      console.log('Device went offline.')
      clearTimers()
    }
  })

  return {
    connect,
    disconnect,
    send,
    getState,
    // Slide operations
    sendSlideCreated,
    sendSlideUpdated,
    sendSlideDeleted,
    sendBatchSlidesCreated,
    sendBatchSlidesUpdated,
    sendBatchSlidesDeleted,
    // Locking
    lockSlide,
    unlockSlide,
    refreshLock,
    // Live slide
    sendLiveSlide,
  }
}