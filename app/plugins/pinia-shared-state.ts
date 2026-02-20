
import { PiniaSharedState } from 'pinia-shared-state'

export default defineNuxtPlugin(nuxtApp => {
  const pinia = nuxtApp.$pinia

  pinia.use(
    PiniaSharedState({
      enable: true,
      initialize: true
    })
  )
})
