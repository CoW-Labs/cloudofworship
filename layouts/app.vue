<template>
  <div v-if="!loadingResources" class="app-ctn max-h-[100vh] overflow-hidden">
    <Navbar :app-version="appVersion" :online="isAppOnline" />
    <slot />
    <FullScreenLoader v-if="fullScreenLoading" />
    <ClientOnly>
      <Transition name="fade-sm">
        <div
          v-if="$pwa?.offlineReady || $pwa?.needRefresh"
          class="ctn fixed z-100 right-4 bottom-4"
          role="alert"
          aria-labelledby="toast-message"
        >
          <NotFoundBanner
            icon="i-tabler-refresh"
            :sub="
              $pwa.offlineReady
                ? 'App ready to work offline'
                : 'New content available, click on reload button to update'
            "
            action="pwa-refresh"
            action-text="Reload"
            secondary-action="cancel-pwa-refresh"
            secondary-action-text="Close"
            is-wider
          />
        </div>
      </Transition>

      <Transition name="fade-sm">
        <div
          v-if="
            $pwa?.showInstallPrompt && !$pwa?.offlineReady && !$pwa?.needRefresh
          "
          class="ctn fixed z-100 right-4 bottom-4"
          role="alert"
          aria-labelledby="install-pwa"
        >
          <NotFoundBanner
            icon="i-tabler-download"
            sub="Install Cloud of Worshippers on your computer for easy access."
            action="pwa-install"
            action-text="Install"
            secondary-action="cancel-pwa-install"
            secondary-action-text="Cancel"
            is-wider
          />
        </div>
      </Transition>

      <Transition name="fade-sm">
        <div
          v-show="isOfflineToastOpen"
          class="ctn fixed z-100 right-4 bottom-4"
          role="alert"
          aria-labelledby="toast-message"
        >
          <NotFoundBanner
            icon="i-tabler-cloud-off"
            sub="You are offline"
            desc="CoW will save your work until an internet connection returns."
            action="close-offline-toast"
            action-text="Ok, got it."
            is-wider
          />
        </div>
      </Transition>
    </ClientOnly>
  </div>
  <div
    v-else
    class="loading-ctn h-[100vh] w-[100vw] fixed inset-0 grid place-items-center dark:bg-gray-900"
  >
    <div class="wrapper flex flex-col gap-2">
      <div class="logo flex items-center justify-center mb-6 gap-2">
        <Logo class="w-[48px]" />
        <h1 class="text-2xl font-semibold">Cloud of Worshippers</h1>
      </div>
      <div class="progress-wrapper text-center">
        <UProgress
          size="2xl"
          class="text-center"
          :value="downloadProgress"
          :max="[
            'Initializing...',
            'Setting up resources...', // also loading bg videos
            'Loading KJV Bible...',
            'Loading NKJV Bible...',
            'Loading NIV Bible...',
            'Loading AMP Bible...',
            'Loading Hymns...',
            // 'Loading background videos...',
            'Finishing up',
          ]"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// import kjvBible from "../public/kjv.json"
// import nkjvBible from "../public/nkjv.json"
// import nivBible from "../public/niv.json"
// import ampBible from "../public/amp.json"
// import hymns from "../public/hymns.json"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Church } from "~/store/auth"
import type { Emitter } from "mitt"
import type { LibraryItem, Media, BackgroundVideo } from "~/types"
import { useOnline } from "@vueuse/core"

useHead({
  title: "Cloud of Worshippers",
})
const props = defineProps({
  appVersion: String,
})

const online = useOnline()
const appStore = useAppStore()
const authStore = useAuthStore()
const loadingResources = ref<boolean>(true)
const downloadProgress = ref<number>(5)
const fullScreenLoading = ref<boolean>(false)
const cachedVideosURLs = ref<string[]>()
const isOfflineToastOpen = ref<boolean>(false)

const isAppOnline = computed(() => {
  // TODO: Track WS requests if any fails up to 5 times concurrently, change to offline
  // if() {}
  isOfflineToastOpen.value = !online.value
  return online.value
})

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>

emitter.on("app-loading", (loading) => {
  // console.log("triggered", loading)
  fullScreenLoading.value = loading
})

emitter.on("pwa-install", () => {
  useNuxtApp().$pwa?.install()
})

emitter.on("cancel-pwa-install", () => {
  useNuxtApp().$pwa?.cancelInstall()
})

emitter.on("pwa-refresh", () => {
  useNuxtApp().$pwa?.updateServiceWorker()
})

emitter.on("cancel-pwa-refresh", () => {
  useNuxtApp().$pwa?.cancelPrompt()
})

emitter.on("close-offline-toast", () => {
  isOfflineToastOpen.value = false
})

const saveAllBackgroundVideos = async () => {
  const db = useIndexedDB()
  const savedBgVideos = await db.cached.count()
  if (savedBgVideos >= 6) {
    return
  }
  const bgVideoPromise = await Promise.all([
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-1.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-2.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-3.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-4.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-5.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-6.mp4`),
    // fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-7.mp4`),
  ])
  // console.log("values", bgVideoPromise)
  const bgVideoResponse = await Promise.all([
    bgVideoPromise[0].blob(),
    bgVideoPromise[1].blob(),
    bgVideoPromise[2].blob(),
    bgVideoPromise[3].blob(),
    bgVideoPromise[4].blob(),
    bgVideoPromise[5].blob(),
    // bgVideoPromise[6].blob(),
  ])
  bgVideoResponse.forEach((blob, index) => {
    const tempMedia: Media = {
      id: `/video-bg-${index + 1}.mp4`,
      data: blob,
      content: "video",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.cached.add(tempMedia)
  })

  // console.log("values", bgVideoResponse.values())
  // const blobData = await bgVideoPromise.blob()
  // // Convert ArrayBuffer object stored in [Slide.content.data] to Blob and b64 url
  // const arrayBuffer: ArrayBuffer = mediaObj[0]?.data
  // const blob = new Blob([blobData], {
  //   type: 'video/mp4',
  // })
}

const tempBibleVersion = (version: string, data: any) => ({
  id: version,
  data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const downloadEssentialResources = async () => {
  const db = useIndexedDB()

  loadingResources.value = true
  downloadProgress.value = 0

  // Download background videos
  downloadProgress.value = 1
  await saveAllBackgroundVideos()

  // Download KJV Bible
  let tempBible = await db.bibleAndHymns.get("KJV")
  if (!tempBible) {
    downloadProgress.value = 2
    const kjvBible = await useS3File("kjv.json")
    db.bibleAndHymns.add(tempBibleVersion("KJV", kjvBible))
  }

  // Download NKJV Bible
  tempBible = await db.bibleAndHymns.get("NKJV")
  if (!tempBible) {
    downloadProgress.value = 3
    const nkjvBible = await useS3File("nkjv.json")
    db.bibleAndHymns.add(tempBibleVersion("NKJV", nkjvBible))
  }

  // Download NIV Bible
  tempBible = await db.bibleAndHymns.get("NIV")
  if (!tempBible) {
    downloadProgress.value = 4
    const nivBible = await useS3File("niv.json")
    db.bibleAndHymns.add(tempBibleVersion("NIV", nivBible))
  }

  // Download AMP Bible
  tempBible = await db.bibleAndHymns.get("AMP")
  if (!tempBible) {
    downloadProgress.value = 5
    const ampBible = await useS3File("amp.json")
    db.bibleAndHymns.add(tempBibleVersion("AMP", ampBible))
  }

  // Download all hymns
  tempBible = await db.bibleAndHymns.get("hymns")
  if (!tempBible) {
    downloadProgress.value = 6
    const hymns = await useS3File("hymns.json")
    db.bibleAndHymns.add(tempBibleVersion("hymns", hymns))
  }

  // All computations completed
  downloadProgress.value = 7

  setTimeout(() => {
    loadingResources.value = false
  }, 100)
}

const overrideAppSettings = () => {
  const currentAppSettings = appStore.settings
  // Override App Settings if current app version mismatches appVersion in state
  // TODO: When appSettings is editable by user, it must take preference over system settings and override
  // console.log(currentAppSettings.appVersion, props.appVersion)
  if (currentAppSettings.appVersion !== props.appVersion) {
    const db = useIndexedDB()
    db.newSchemaUpdate()

    // console.log("calling again")
    setTimeout(() => {
      useGlobalEmit("show-changelog")
    }, 2000)

    // Any setting added here overrides user and previous system setting
    // Remove setting property here if it is defined by the user.
    appStore.setAppSettings({
      ...currentAppSettings,
      appVersion: props.appVersion,
      defaultBackground: {
        hymn: {
          backgroundType: "video",
          background: cachedVideosURLs.value?.[0],
          backgroundVideoKey: "/video-bg-1.mp4",
        },
        bible: {
          backgroundType: "video",
          background: cachedVideosURLs.value?.[2],
          backgroundVideoKey: "/video-bg-3.mp4",
        },
        text: {
          backgroundType: "video",
          background: cachedVideosURLs.value?.[3],
          backgroundVideoKey: "/video-bg-4.mp4",
        },
      },
    })
  }
}

function base64ToBlobURL(base64String: string, mimeType: string) {
  const byteCharacters = atob(decodeURIComponent(base64String))
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  return URL.createObjectURL(blob)
}

const getChurch = async () => {
  // console.log(authStore.user)
  const churchId = authStore.user?.churchId
  if (churchId) {
    const promise = useAPIFetch(`/church/${churchId}`)
    authStore.setChurch(promise.data as unknown as Church)
  } else {
    navigateTo("/signup?registerChurch=1")
    useToast().add({
      icon: "i-bx-church",
      title: "Add your church in less than 1 minute to continue.",
    })
  }
}

const retrieveAllMediaFilesFromDB = async () => {
  const db = useIndexedDB()

  // For active slides
  const slides = [...appStore.activeSlides]
  slides.forEach(async (slide) => {
    if (slide.type === slideTypes.media) {
      const mediaObj = await db.media.where({ id: slide.id }).toArray()
      if (mediaObj[0]) {
        let b64 = null
        // Convert ArrayBuffer object stored in [Slide.content.data] to Blob and b64 url
        const arrayBuffer: ArrayBuffer = mediaObj[0]?.data
        const blob = new Blob([arrayBuffer], {
          type: mediaObj[0]?.content?.type,
        })
        const fileUrl = URL.createObjectURL(blob)
        slide.data.url = fileUrl
        if (!slide.data?.type?.includes("audio")) {
          slide.background = fileUrl
        }
        appStore.setActiveSlides(slides)
      }
    } else {
      // console.log(slide.name, slide.backgroundVideoKey)
      // console.log(slide.name, slide.background)
      if (slide?.backgroundVideoKey) {
        const cachedBackgroundVideo = await db.cached.get(
          slide?.backgroundVideoKey
        )
        // console.log(cachedBackgroundVideo)
        const arrayBuffer: ArrayBuffer = cachedBackgroundVideo?.data!!
        const blob = new Blob([arrayBuffer], {
          type: cachedBackgroundVideo?.content?.type,
        })
        const fileUrl = URL.createObjectURL(blob)
        slide.background = fileUrl
      }
    }
  })

  // For saved slides
  const savedSlides = await db.library.where("type").equals("slide").toArray()
  const slidesChanges = await savedSlides?.map((slide) => {
    db.media.get(slide.id).then((resp) => {
      const media = resp

      const arrayBuffer: ArrayBuffer = media?.data as ArrayBuffer
      const blob = new Blob([arrayBuffer], {
        type: media?.content?.type,
      })
      const fileUrl = URL.createObjectURL(blob)
      // console.log(fileUrl)
      // console.log({
      //   key: slide.id,
      //   changes: {
      //     "content.data": { ...slide.content.data, url: fileUrl },
      //   },
      // })
      const updatedLibraryItem = {
        ...slide,
        content: {
          ...slide.content,
          background: fileUrl,
          data: { ...slide.content.data, url: fileUrl },
        },
      }
      // console.log(updatedLibraryItem)
      db.library.update(slide.id, updatedLibraryItem)
    })
  })

  setCachedVideosURL()
}

const setCachedVideosURL = async () => {
  const cachedVideos = await useBackgroundVideos()
  const tempCachedVideos = cachedVideos?.map((cached: BackgroundVideo) => ({
    id: cached?.id,
    url: URL.createObjectURL(cached?.data),
  }))
  cachedVideosURLs.value = tempCachedVideos as BackgroundVideo[]
  // console.log(tempCachedVideosURLs)
  appStore.setBackgroundVideos(tempCachedVideos)
}

onMounted(async () => {
  await downloadEssentialResources()
  overrideAppSettings()
})

getChurch()
retrieveAllMediaFilesFromDB()
</script>

<style scoped></style>
