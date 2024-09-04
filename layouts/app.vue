<template>
  <div
    v-if="!loadingResources"
    class="app-ctn max-h-[100vh] overflow-hidden text"
  >
    <!-- TODO: Remove this banner after 0.7.9 and make it a component -->
    <!-- <div
      v-if="
        appStore.bannerVisible &&
        (appVersion === '0.7.6' ||
          appVersion === '0.7.7' ||
          appVersion === '0.7.8')
      "
      class="banner text-center text-sm h-[40px] bg-[#FF8980] text-black items-center flex justify-between gap-1"
    >
      <UButton variant="ghost" class="pointer-events-none opacity-0 w-8 h-8">
        <IconWrapper name="i-mdi-close" class="w-4 h-4" />
      </UButton>
      <div class="text">
        Cloud of Worship is moving to
        <a
          class="border-b font-bold border-black"
          target="_blank"
          href="http://app.cloudofworship.com"
          >app.cloudofworship.com</a
        >. All your synced slides and schedules will be migrated to the new
        domain.
      </div>
      <UButton
        variant="ghost"
        @click="appStore.setBannerVisible(false)"
        color="black"
        class="p-0 flex items-center justify-center w-8 h-8 mb-2 mr-2"
      >
        <IconWrapper name="i-mdi-close" class="w-4 h-4 text-black p-0" />
      </UButton>
    </div> -->
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
            :action="$pwa.offlineReady ? 'cancel-pwa-refresh' : 'pwa-refresh'"
            :action-text="$pwa.offlineReady ? 'Got it' : 'Reload'"
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
            sub="Install Cloud of Worship on your computer for easy access."
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
    <div class="wrapper flex flex-col gap-6">
      <div class="logo flex items-center justify-center mb-6 gap-2">
        <Logo class="w-[64px]" />
        <h1 class="text-2xl font-semibold">Cloud of Worship</h1>
      </div>
      <div class="progress-wrapper text-center relative">
        <UProgress
          size="2xl"
          class="text-center"
          :value="parseInt(downloadProgress)"
          :max="100"
        />
        <UProgress
          v-show="downloadStep === 2"
          size="2xl"
          class="text-center absolute top-0 left-0 opacity-50"
          color="white"
        />
        <UProgress
          v-show="downloadStep === 4"
          size="2xl"
          class="text-center absolute top-0 left-0 opacity-50"
          color="white"
        />
        <div
          v-if="downloadStep !== 5"
          class="text-md font-semibold w-[300px] flex items-center justify-between mt-4"
        >
          <span class="font-normal">
            <div class="text-left">Loading {{ downloadResource }}</div>
            <div class="opacity-50 text-left">
              This might take a while
            </div></span
          >
          <span>{{ parseInt(downloadProgress) || 0 }}%</span>
        </div>
        <div
          v-else
          class="text-md font-semibold w-[300px] flex items-center justify-center mt-4"
        >
          <span class="font-normal">
            {{ downloadResource }}
          </span>
        </div>
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
import type { LibraryItem, Media, BackgroundVideo, Schedule } from "~/types"
import { useOnline } from "@vueuse/core"

useHead({
  title: "Cloud of Worship",
})
const props = defineProps({
  appVersion: String,
})

const online = useOnline()
const appStore = useAppStore()
const authStore = useAuthStore()
const loadingResources = ref<boolean>(true)
const downloadStep = ref<number>(0)
const downloadResource = ref<string>("")
const downloadProgress = ref<string>("0")
const fullScreenLoading = ref<boolean>(false)
const cachedVideosURLs = ref<string[]>()
const isOfflineToastOpen = ref<boolean>(false)
const config = useRuntimeConfig()
const token = useCookie("token")
const windowRefs = ref<any[]>([])
const db = useIndexedDB()

const isAppOnline = computed(() => {
  // TODO: Track WS requests if any fails up to 5 times concurrently, change to offline
  // if() {}
  isOfflineToastOpen.value = !online.value
  return online.value
})

provide("windowRefs", windowRefs)

// Get hymn count
let hymnCount: any
const hymns = await db.bibleAndHymns.get("hymns")
if (isAppOnline.value) {
  hymnCount = await fetch(`${config.public.BASE_URL}/hymn/count`, {
    headers: {
      Authorization: `Bearer ${token.value}`,
    },
  })
  hymnCount = await hymnCount.json()
} else {
  // Handle offline hymn count
  hymnCount = hymns?.data?.length
  console.log("hymnCount", hymnCount)
}

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

emitter.on("go-live", () => {
  openWindows()
})

const saveAllBackgroundVideos = async () => {
  const savedBgVideo1 = await db.cached.get("/video-bg-1.mp4")
  const savedBgVideo2 = await db.cached.get("/video-bg-2.mp4")
  const savedBgVideo3 = await db.cached.get("/video-bg-3.mp4")
  const savedBgVideo4 = await db.cached.get("/video-bg-4.mp4")
  const savedBgVideo5 = await db.cached.get("/video-bg-5.mp4")
  const savedBgVideo6 = await db.cached.get("/video-bg-6.mp4")

  const saveBackground = (blob: any, index: number) => {
    const tempMedia: Media = {
      id: `/video-bg-${index}.mp4`,
      data: blob,
      content: "video",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.cached.add(tempMedia)
  }

  downloadResource.value = "background videos"
  if (!savedBgVideo1) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-1.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 1)
  }

  if (!savedBgVideo2) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-2.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 2)
  }

  if (!savedBgVideo3) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-3.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 3)
  }

  if (!savedBgVideo4) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-4.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 4)
  }

  if (!savedBgVideo5) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-5.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 5)
  }

  if (!savedBgVideo6) {
    const bgVideoPromise = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-6.mp4`,
      downloadProgress
    )
    const bgVideoBlob = await bgVideoPromise.blob()
    saveBackground(bgVideoBlob, 6)
  }

  // let bgVideoPromise2 = await useDetailedFetch(
  //   `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-2.mp4`,
  //   downloadProgress
  // )
  // bgVideoPromise2 = await bgVideoPromise2.blob()

  // let bgVideoPromise3 = await useDetailedFetch(
  //   `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-3.mp4`,
  //   downloadProgress
  // )
  // bgVideoPromise3 = await bgVideoPromise3.blob()

  // let bgVideoPromise4 = await useDetailedFetch(
  //   `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-4.mp4`,
  //   downloadProgress
  // )
  // bgVideoPromise4 = await bgVideoPromise4.blob()

  // let bgVideoPromise5 = await useDetailedFetch(
  //   `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-5.mp4`,
  //   downloadProgress
  // )
  // bgVideoPromise5 = await bgVideoPromise5.blob

  // let bgVideoPromise6 = await useDetailedFetch(
  //   `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-6.mp4`,
  //   downloadProgress
  // )
  // bgVideoPromise6 = await bgVideoPromise6.blob()

  // const bgVideoResponse = await Promise.all([
  //   bgVideoPromise1,
  //   bgVideoPromise2,
  //   bgVideoPromise3,
  //   bgVideoPromise4,
  //   bgVideoPromise5,
  //   bgVideoPromise6,
  //   // bgVideoPromise[6].blob(),
  // ])

  // bgVideoResponse.forEach((blob, index) => {
  //   const tempMedia: Media = {
  //     id: `/video-bg-${index + 1}.mp4`,
  //     data: blob,
  //     content: "video",
  //     createdAt: new Date().toISOString(),
  //     updatedAt: new Date().toISOString(),
  //   }
  //   db.cached.add(tempMedia)
  // })

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
  downloadStep.value = 0

  // Download background videos
  downloadStep.value = 1
  await saveAllBackgroundVideos()

  // Download background videos
  downloadStep.value = 2
  await retrieveSchedules()

  // Download KJV Bible
  let tempBible = await db.bibleAndHymns.get("KJV")
  if (!tempBible) {
    downloadResource.value = "KJV Bible"
    downloadStep.value = 3

    let kjvBible = await useDetailedFetch(
      `https://d37gopmfkl2m2z.cloudfront.net/open/kjv.json`,
      downloadProgress
    )
    kjvBible = await kjvBible.json()
    db.bibleAndHymns.add(tempBibleVersion("KJV", kjvBible))
  }

  const isBibleVersionDownloaded = async (bibleVersion: string) => {
    return (await db.bibleAndHymns.where("id").equals(bibleVersion).count()) > 0
  }

  const populateBibleVersionOptions = async () => {
    const tempBibleVersions = [...appStore.bibleVersions]
    for (const bibleVersion of tempBibleVersions) {
      bibleVersion.isDownloaded = await isBibleVersionDownloaded(
        bibleVersion.id
      )
    }
    appStore.setBibleVersions(tempBibleVersions)
  }

  populateBibleVersionOptions()

  // Download all hymns
  if (hymns?.data?.length !== hymnCount) {
    db.bibleAndHymns.delete("hymns")
    downloadResource.value = "hymns"
    downloadStep.value = 4
    let hymns = await useDetailedFetch(
      `${config.public.BASE_URL}/hymn`,
      downloadProgress,
      {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      }
    )
    hymns = await hymns.json()
    db.bibleAndHymns.add(tempBibleVersion("hymns", hymns))
  }

  // All computations completed
  downloadStep.value = 5
  downloadResource.value = "All resources downloaded"

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
      bibleVersions: [
        {
          id: "KJV",
          name: "King James Version",
          isDownloaded: false,
          copyrightContent: "",
        },
        {
          id: "NKJV",
          name: "New King James Version",
          isDownloaded: false,
          copyrightContent:
            "Scripture taken from the New King James Version®. Copyright © 1982 by Thomas Nelson. All rights reserved.",
        },
        {
          id: "NIV",
          name: "New International Version",
          isDownloaded: false,
          copyrightContent:
            "Scriptures taken from the Holy Bible, New International Version®, NIV®. Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.™ All rights reserved worldwide.",
        },
        {
          id: "AMP",
          name: "Amplified Bible",
          isDownloaded: false,
          copyrightContent:
            "All Scripture quotations, unless otherwise indicated, are taken from the Amplified Bible, Copyright © 2015 by The Lockman Foundation.",
        },
        {
          id: "NLT",
          name: "New Living Translation",
          isDownloaded: false,
          copyrightContent:
            "Scripture quotations marked (NLT) are taken from the Holy Bible, New Living Translation, copyright ©1996, 2004, 2015 by Tyndale House Foundation.",
        },
        // { id: 'TPT', name: 'The Passion Translation', isDownloaded: false, copyrightContent: '' },
        // { id: 'GNT', name: 'Good News Translation', isDownloaded: false, copyrightContent: '' },
        {
          id: "CEV",
          name: "Contemporary English Version",
          isDownloaded: false,
          copyrightContent:
            "Scripture quotations marked (CEV) are from the Contemporary English Version Copyright © 1991, 1992, 1995 by American Bible Society.",
        },
      ],
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
    const { data, error } = await useAPIFetch(
      `/church/${churchId}?teammates=true`
    )
    const church = data.value as unknown as Church
    authStore.setChurch(church)
    if (error.value) {
      throw new Error(error.value?.message)
    }
  } else {
    navigateTo("/signup?registerChurch=1")
    useToast().add({
      icon: "i-bx-church",
      title: "Add your church in less than 1 minute to continue.",
    })
  }
}

const retrieveSchedules = async () => {
  if (isAppOnline.value) {
    downloadProgress.value = "0"
    downloadResource.value = "schedules and slides"
    const schedulesPromise = await useAPIFetch(
      `/church/${authStore.user?.churchId}/schedules`
    )
    const schedules = schedulesPromise.data.value as unknown as Schedule[]
    const mergedSchedules = useMergeObjectArray(
      [...schedules],
      appStore.schedules
    )

    mergedSchedules?.sort((scheduleA, scheduleB) => {
      const dateA = new Date(scheduleA?.updatedAt)
      const dateB = new Date(scheduleB?.updatedAt)
      return dateB?.getTime() - dateA?.getTime()
    })
    appStore.setSchedules(mergedSchedules)
    downloadProgress.value = "100"
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

// WINDOW MANAGEMENT CODE STARTS HERE
function openWindow(
  left: number,
  top: number,
  width: number,
  height: number,
  url: string
) {
  const windowFeatures = `left=${left},top=${top},width=${width},height=${height}`
  const windowRef = window.open(
    url,
    "_blank", // needed for it to open in a new window
    windowFeatures
  )

  if (windowRef === null) {
    // If the browser is blocking popups, clear out any windows that were able to open
    useToast().add({
      title:
        "Popups are blocked. Ensure you are not blocking popups for this site.",
      icon: "i-bx-info-circle",
      color: "red",
    })
    closeAllWindows()
  } else {
    const tempWindowRefs = windowRefs.value
    tempWindowRefs.push(windowRef)
    windowRefs.value = tempWindowRefs
  }
}

function closeAllWindows() {
  windowRefs.value.forEach((windowRef: any) => {
    windowRef.close()
  })
  windowRefs.value = []
}

async function openWindows() {
  const screenDetails = await window.getScreenDetails()
  const noOfScreens = screenDetails.screens.length

  if (noOfScreens === 1) {
    useToast().add({
      title:
        "Only one screen detected. Connect a second screen to project on another display",
      icon: "i-bx-info-circle",
    })

    // Two screens or more
    const screen1 = screenDetails.screens[0]
    openWindow(
      screen1.availLeft,
      screen1.availTop,
      screen1.availWidth,
      screen1.availHeight,
      `http://${window.location.host}/live`
    )
  } else {
    // Two screens or more
    const screen1 = screenDetails.screens[0]
    const screen2 = screenDetails.screens[1]
    openWindow(
      screen1.availLeft,
      screen1.availTop,
      screen2.availWidth,
      screen2.availHeight,
      `http://${window.location.host}/live`
    )
  }

  const closeMonitor = setInterval(checkWindowClose, 250)

  function checkWindowClose() {
    if (windowRefs.value.some((windowRef: any) => windowRef.closed)) {
      closeAllWindows()
      clearInterval(closeMonitor)
    }
  }

  // Also close our popup windows if the main app window is closed
  window.addEventListener("beforeunload", () => {
    closeAllWindows()
  })

  screenDetails.addEventListener("screenschange", () => {
    // TODO: Action when screen count changes
  })
}

// WINDOW MANAGEMENT CODE ENDS HERE
</script>

<style scoped></style>
