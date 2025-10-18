import { useOnline } from '@vueuse/core'
import { ref } from 'vue'

export type OnlineCallback = () => void | Promise<void>

/**
 * Composable to handle online/offline status and callbacks
 */
export const useOnlineStatus = () => {
  const online = useOnline()
  const onlineCallbacks = ref<OnlineCallback[]>([])

  /**
   * Register a callback to be executed when the app comes back online
   * @param callback Function to be executed when online
   */
  const onBackOnline = (callback: OnlineCallback) => {
    onlineCallbacks.value.push(callback)
  }

  /**
   * Remove a callback from the list of online callbacks
   * @param callback Function to be removed
   */
  const removeOnlineCallback = (callback: OnlineCallback) => {
    const index = onlineCallbacks.value.indexOf(callback)
    if (index > -1) {
      onlineCallbacks.value.splice(index, 1)
    }
  }

  // Watch for online status changes
  watch(online, (isOnline) => {
    if (isOnline) {
      // Execute all callbacks when coming back online
      onlineCallbacks.value.forEach(async (callback) => {
        try {
          await callback()
        } catch (error) {
          console.error('Error executing online callback:', error)
        }
      })
    }
  })

  return {
    online,
    onBackOnline,
    removeOnlineCallback
  }
}
