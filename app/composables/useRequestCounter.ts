import { ref } from 'vue'

const requestCount = ref(0)
const lastRequestTime = ref(Date.now())
const delayPromise = ref<Promise<void> | null>(null)

export const useRequestCounter = () => {
  const shouldDelay = () => {
    const now = Date.now()
    // Reset counter if it's been more than 30 seconds since last request
    if (now - lastRequestTime.value > 30000) {
      requestCount.value = 0
    }

    lastRequestTime.value = now
    requestCount.value++

    // Return true if we need to delay (every 20th request)
    return requestCount.value % 20 === 0
  }

  const getDelayPromise = () => {
    if (shouldDelay()) {
      if (!delayPromise.value) {
        delayPromise.value = new Promise(resolve => {
          setTimeout(() => {
            delayPromise.value = null
            resolve()
          }, 10000)
        })
      }
      return delayPromise.value
    }
    return null
  }

  return {
    getDelayPromise
  }
}
