import { useAppStore } from "~/store/app"
import { useOnline } from "@vueuse/core"

interface WebSocketOptions {
  scheduleId: string
  maxRetries?: number
  baseRetryDelay?: number
  maxRetryDelay?: number
  connectionTimeout?: number
  heartbeatInterval?: number
  onMessage?: (data: any) => void
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Event) => void
  onMaxRetriesReached?: () => void
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
  } = options

  const runtimeConfig = useRuntimeConfig()
  const online = useOnline()

  let socket: WebSocket | null = null
  let retryCount = 0
  let reconnectTimer: NodeJS.Timeout | null = null
  let connectionTimer: NodeJS.Timeout | null = null
  let heartbeatTimer: NodeJS.Timeout | null = null
  let isIntentionallyClosed = false
  let isConnecting = false

  const getWebSocketUrl = () => {
    const protocol = process.env.NODE_ENV === 'development' ? 'ws' : 'wss'
    const baseUrl = runtimeConfig.public.BASE_URL?.split('://')?.[1]
    return `${protocol}://${baseUrl}/schedules?schedule_id=${scheduleId}`
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
          socket.send(JSON.stringify({ action: 'ping' }))
        } catch (error) {
          console.error('Failed to send heartbeat:', error)
          reconnect()
        }
      }
    }, heartbeatInterval)
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
        onConnected?.()
      }

      socket.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data)

          // Handle pong responses
          if (parsedData.action === 'pong') {
            return
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
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(data))
        return true
      } catch (error) {
        console.error('Failed to send message:', error)
        return false
      }
    } else {
      console.warn('WebSocket is not connected. Cannot send message.')
      return false
    }
  }

  const getState = () => {
    return {
      readyState: socket?.readyState,
      retryCount,
      isConnecting,
      isIntentionallyClosed,
      isOnline: online.value,
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
  }
}