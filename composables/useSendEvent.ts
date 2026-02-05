import { ref } from "vue"

interface EventData {
  event: string
  data?: Record<string, any>
  metadata?: Record<string, any>
}

export const useSendEvent = () => {
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Send an event to the backend for tracking/notifications
   * @param eventType - The type of event (e.g., 'payment_initiated', 'payment_cancelled')
   * @param data - Optional data payload for the event
   * @param metadata - Optional metadata for the event
   */
  const sendEvent = async (
    eventType: string,
    data?: Record<string, any>,
    metadata?: Record<string, any>
  ) => {
    loading.value = true
    error.value = null

    try {
      const { error: fetchError } = await useAPIFetch("/event/send", {
        method: "POST",
        body: {
          event: eventType,
          data: data || {},
          metadata: metadata || {},
        },
      })

      if (fetchError.value) {
        throw new Error(
          fetchError.value.message || "Failed to send event"
        )
      }

      return true
    } catch (err: any) {
      error.value = err.message
      console.error("Error sending event:", error.value)
      // Don't throw - we don't want event tracking to break the main flow
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Track payment initiation
   * @param planId - The plan ID being purchased
   * @param amount - The amount being paid
   * @param currency - The currency
   */
  const trackPaymentInitiated = async (
    planId: string,
    amount?: number,
    currency?: string
  ) => {
    return await sendEvent("payment_initiated", {
      planId,
      amount,
      currency,
    })
  }

  /**
   * Track payment cancellation
   * @param planId - The plan ID that was being purchased
   * @param reason - Optional reason for cancellation
   */
  const trackPaymentCancelled = async (
    planId?: string,
    reason?: string
  ) => {
    return await sendEvent("payment_cancelled", {
      planId,
      reason,
    })
  }

  return {
    sendEvent,
    trackPaymentInitiated,
    trackPaymentCancelled,
    loading,
    error,
  }
}
