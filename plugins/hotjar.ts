import Hotjar from "@hotjar/browser"

export default defineNuxtPlugin(nuxtApp => {
  const siteId = 4947030
  const hotjarVersion = 6

  Hotjar.init(siteId, hotjarVersion)
})