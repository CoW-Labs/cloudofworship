import { PiniaSharedState } from 'pinia-shared-state'
import { sharedStateSerializer } from '~/utils/sharedStateSerializer'

export default defineNuxtPlugin(nuxtApp => {
  const pinia = nuxtApp.$pinia

  pinia.use(
    PiniaSharedState({
      enable: true,
      initialize: true,
      serializer: sharedStateSerializer
    })
  )
})
