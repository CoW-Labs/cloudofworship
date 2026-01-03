<template>
  <div
    v-if="!loadingResources"
    class="app-ctn max-h-[100vh] overflow-hidden text"
  >
    <Navbar :app-version="appVersion" :online="isAppOnline" />
    <slot />
    <FullScreenLoader v-if="fullScreenLoading" />
    <ClientOnly>
      <Transition name="fade-sm">
        <div
          v-if="$pwa?.offlineReady || $pwa?.needRefresh"
          class="ctn fixed z-50 right-4 bottom-4"
          role="alert"
          aria-labelledby="toast-message"
        >
          <NotFoundBanner
            icon="i-tabler-refresh"
            :sub="
              $pwa.offlineReady
                ? 'App ready to work offline'
                : 'New version available, click on reload button to update'
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
          class="ctn fixed z-50 right-4 bottom-4"
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
          class="ctn fixed z-50 right-4 bottom-4"
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

      <Transition name="fade-sm">
        <UpdateNotification />
      </Transition>

      <AdvertModal :active-advert="currentState.activeAdvert" />
      <UpgradePlanModal />
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
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Church } from "~/store/auth"
import type { Emitter } from "mitt"
import type { User } from "~/store/auth"
import type {
  LibraryItem,
  Media,
  BackgroundVideo,
  Schedule,
  Song,
  SlideStyle,
  Advert,
  ExtendedFileT,
  Slide,
  Hymn,
  AppSettings,
} from "~/types"
import { useOnline } from "@vueuse/core"
import { appWideActions } from "~/utils/constants"

useHead({
  title: "Cloud of Worship",
  link: [{ rel: "stylesheet", href: "/css/main.css" }],
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
const cachedVideosURLs = ref<BackgroundVideo[]>()
const isOfflineToastOpen = ref<boolean>(false)
const config = useRuntimeConfig()
const { getToken } = useAuthToken()
const windowRefs = ref<any[]>([])
const db = useIndexedDB()
const appInfo = ref<AppSettings>()
const { refreshLibrary } = useLibrary()

const { currentState } = storeToRefs(appStore)

const isAppOnline = computed(() => {
  // TODO: Track WS requests if any fails up to 5 times concurrently, change to offline
  // if() {}
  isOfflineToastOpen.value = !online.value
  return online.value
})

const inaccessibleDateRemaining = computed(() => {
  const inaccessibleDate = new Date("2024-12-13T00:00:00.000Z")
  const now = new Date()
  const diff = inaccessibleDate.getTime() - now.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
})

provide("windowRefs", windowRefs)

const fetchUser = async () => {
  const { data, error } = await useAPIFetch(`/user/auth`)
  if (data.value) {
    const user = data.value as unknown as User
    authStore.setUser(user)
  }
}

const fetchChurchSongs = async () => {
  try {
    const { data } = await useAPIFetch(
      `/church/${authStore.user?.churchId}/songs/all/count?churchId=${authStore.user?.churchId}`
    )
    const onlineCount = data.value ? (data.value as unknown as number) : 0
    const offlineCount = await db.library.where("type").equals("song").count()
    if (onlineCount > offlineCount) {
      // Delete songs that are not in the online database
      await db.library.where("type").equals("song").delete()

      // Add online songs
      const promise = await useAPIFetch(
        `/church/${authStore.user?.churchId}/songs/all?churchId=${authStore.user?.churchId}`
      )
      const data: Song[] = (await promise.data.value) as unknown as Song[]
      const libraryData: LibraryItem[] = data?.map((song) => ({
        id: song.id,
        type: "song",
        content: JSON.parse(JSON.stringify(song)),
        createdAt: song.createdAt,
        updatedAt: song.updatedAt,
      }))

      // Use bulkPut instead of bulkAdd to avoid blocking on duplicates
      // Process in chunks to avoid blocking
      const chunkSize = 50
      for (let i = 0; i < libraryData.length; i += chunkSize) {
        const chunk = libraryData.slice(i, i + chunkSize)
        await db.library.bulkAdd(chunk).catch((err) => {
          console.error("Failed to add song chunk:", err)
        })
      }
    }
  } catch (err: any) {
    console.log(err)
  }
}

// Get Church Info and see if registered
const fetchChurch = async () => {
  const churchId = authStore.user?.churchId
  if (churchId) {
    const { data, error } = await useAPIFetch(
      `/church/${churchId}?teammates=true`
    )
    if (data.value) {
      const church = data.value as unknown as Church
      authStore.setChurch(church)
      fetchChurchSongs()
    }
    if (error.value) {
      useToast().add({
        icon: "i-mdi-alert-circle-outline",
        title: "Reach out to support, your church information is corrupted.",
        color: "red",
      })
      authStore.signOut()
      throw new Error(error.value?.message)
    }
  } else {
    if (!authStore.user?._id) {
      navigateTo("/login")
    }
    navigateTo("/signup?registerChurch=1")
    useToast().add({
      icon: "i-bx-church",
      title: "Add your church in less than 1 minute to continue.",
    })
  }
}

const fetchAppInfo = async () => {
  // Download app info
  const { data } = await useAPIFetch("/app-config/info")
  if (data.value) {
    appInfo.value = data.value as any
    appStore.setBibleVersions((data.value as any)?.bibleVersions)
  }
}

const fetchHymns = async () => {
  let hymnCount: any
  const hymns = await db.bibleAndHymns.get("hymns")
  const tokenValue = getToken()

  // Download all hymns
  hymnCount = await fetch(`${config.public.BASE_URL}/hymn/count`, {
    headers: {
      Authorization: `Bearer ${tokenValue}`,
    },
  })
  hymnCount = await hymnCount.json()

  if (hymns?.data?.length !== hymnCount) {
    await db.bibleAndHymns
      .delete("hymns")
      .catch((err) => console.error("Failed to delete hymns:", err))
    downloadResource.value = "hymns"
    downloadStep.value = 4
    let hymns = await useDetailedFetch(
      `${config.public.BASE_URL}/hymn`,
      downloadProgress,
      {
        headers: {
          Authorization: `Bearer ${tokenValue}`,
        },
      }
    )
    hymns = await hymns.json()
    await db.bibleAndHymns
      .add(tempBibleVersion("hymns", hymns))
      .catch((err) => console.error("Failed to add hymns:", err))
  }
}

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>

emitter.on("app-loading", (loading) => {
  fullScreenLoading.value = loading
})

emitter.on("pwa-install", () => {
  useNuxtApp().$pwa?.install()
  usePosthogCapture("APP_INSTALLED")
})

emitter.on("cancel-pwa-install", () => {
  useNuxtApp().$pwa?.cancelInstall()
  usePosthogCapture("APP_INSTALL_CANCELLED")
})

emitter.on("pwa-refresh", () => {
  useNuxtApp().$pwa?.updateServiceWorker()
  usePosthogCapture("APP_UPDATED")
})

emitter.on("cancel-pwa-refresh", () => {
  useNuxtApp().$pwa?.cancelPrompt()
})

emitter.on("close-offline-toast", () => {
  isOfflineToastOpen.value = false
})

emitter.on("selected-schedule", (schedule: Schedule) => {
  appStore.setSlidesLoading(true)
  setTimeout(() => {
    retrieveAllMediaFilesFromDB()
  }, 2000)
})

emitter.on("go-live", async () => {
  const { isTauri } = useTauri()

  if (isTauri) {
    await openTauriLiveWindow()
  } else {
    openWindows()
  }

  usePosthogCapture("GO_LIVE_BUTTON_CLICKED")
})

emitter.on("close-live-window", async () => {
  await closeAllWindows()
  usePosthogCapture("CLOSE_LIVE_WINDOW_BUTTON_CLICKED")
})

const saveAllBackgroundVideos = async () => {
  // Use Promise.all to fetch all videos in parallel - non-blocking
  const videoIds = [1, 2, 3, 4, 5, 6, 9, 10]
  const savedVideos = await Promise.all(
    videoIds.map((id) => db.cached.get(`/video-bg-${id}.mp4`))
  )

  const savedBgVideoMap = new Map(
    videoIds.map((id, index) => [id, savedVideos[index]])
  )

  const saveBackground = (blob: any, index: number) => {
    const tempMedia: Media = {
      id: `/video-bg-${index}.mp4`,
      data: blob,
      content: "video",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.cached
      .add(tempMedia)
      .catch((err) => console.error(`Failed to save video-bg-${index}:`, err))
  }

  downloadResource.value = "background videos"

  // Download videos that aren't cached yet
  const videoDownloadPromises = videoIds
    .filter((id) => !savedBgVideoMap.get(id))
    .map(async (id) => {
      const bgVideoPromise = await useDetailedFetch(
        `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-${id}.mp4`,
        downloadProgress
      )
      const bgVideoBlob = await bgVideoPromise.blob()
      saveBackground(bgVideoBlob, id)
    })

  // Process in batches to avoid blocking
  const batchSize = 2
  for (let i = 0; i < videoDownloadPromises.length; i += batchSize) {
    const batch = videoDownloadPromises.slice(i, i + batchSize)
    await Promise.all(batch)
  }
}

const tempBibleVersion = (version: string, data: any) => ({
  id: version,
  data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const fetchActiveAdvert = async () => {
  const { data, error } = await useAPIFetch(`/advert/active`)
  appStore.setActiveAdvert(data.value as Advert)
}

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
      `https://d37gopmfkl2m2z.cloudfront.net/open/bible-versions/kjv.json`,
      downloadProgress
    )
    kjvBible = await kjvBible.json()
    db.bibleAndHymns.add(tempBibleVersion("KJV", kjvBible))
  }

  const isBibleVersionDownloaded = async (bibleVersion: string) => {
    return (await db.bibleAndHymns.where("id").equals(bibleVersion).count()) > 0
  }

  const populateBibleVersionOptions = async () => {
    const tempBibleVersions = appInfo.value?.bibleVersions?.length
      ? appInfo.value.bibleVersions
      : [...appStore.currentState.settings.bibleVersions]
    for (const bibleVersion of tempBibleVersions) {
      bibleVersion.isDownloaded = await isBibleVersionDownloaded(
        bibleVersion.id
      )
    }
    appStore.setBibleVersions(tempBibleVersions)
  }

  populateBibleVersionOptions()

  // All computations completed
  downloadStep.value = 5
  downloadResource.value = "All resources downloaded."

  setTimeout(() => {
    loadingResources.value = false
    useGlobalEmit(
      appWideActions.selectedSchedule,
      appStore.currentState.activeSchedule?._id
    )
    overrideAppSettings()
    appStore.refreshAppActionsStack()
  }, 100)
}

const overrideAppSettings = async () => {
  const currentAppSettings = appStore.currentState.settings
  // Override App Settings if current app version mismatches appVersion in state
  // TODO: When appSettings is editable by user, it must take preference over system settings and override
  if (currentAppSettings.appVersion !== props.appVersion) {
    setTimeout(() => {
      useGlobalEmit(appWideActions.showChangelog)
    }, 2000)

    // Any setting added here overrides user and previous system setting
    // Remove setting property here if it is defined by the user.
    appStore.setAppSettings({
      ...currentAppSettings,
      appVersion: props.appVersion!!,
      // TODO: Remove commented settings and TODO above if all checks out - after upload
      // defaultBackground: {
      //   hymn: {
      //     backgroundType: "video",
      //     background: cachedVideosURLs.value?.[0].url!!,
      //     backgroundVideoKey: "/video-bg-1.mp4",
      //   },
      //   bible: {
      //     backgroundType: "video",
      //     background: cachedVideosURLs.value?.[0].url!!,
      //     backgroundVideoKey: "/video-bg-3.mp4",
      //   },
      //   text: {
      //     backgroundType: "video",
      //     background: cachedVideosURLs.value?.[0].url!!,
      //     backgroundVideoKey: "/video-bg-4.mp4",
      //   },
      // },
      // slideStyles: {
      //   blur: 0.5,
      //   brightness: 50,
      //   linesPerSlide: 4,
      //   alignment: "center",
      //   windowPadding: { left: 24, right: 24, top: 24, bottom: 24 },
      // } as SlideStyle,
    })
  }
}

const retrieveSchedules = async () => {
  if (isAppOnline.value) {
    downloadProgress.value = "0"
    downloadResource.value = "schedules and slides"
    const { data } = await useAPIFetch(
      `/church/${authStore.user?.churchId}/schedules`
    )

    const schedules = data.value ? (data.value as unknown as Schedule[]) : []
    const mergedSchedules = useMergeObjectArray(
      [...schedules],
      appStore.currentState.schedules
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

  // For active slides - use Promise.all instead of forEach
  const slides = [...appStore.currentState.activeSlides]

  // Process slides in parallel but in small batches to avoid blocking
  const processSlidesInBatches = async (
    slidesToProcess: Slide[],
    batchSize = 5
  ) => {
    for (let i = 0; i < slidesToProcess.length; i += batchSize) {
      const batch = slidesToProcess.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (slide: Slide) => {
          if (
            slide.type === slideTypes.media &&
            slide.background?.startsWith("blob:")
          ) {
            const mediaObj = await db.media.where({ id: slide.id }).toArray()
            if (mediaObj[0]) {
              // Convert ArrayBuffer object stored in [Slide.content.data] to Blob and b64 url
              const arrayBuffer = mediaObj[0]?.data!!
              const blob = new Blob([arrayBuffer], {
                type: mediaObj[0]?.content?.type,
              })
              const fileUrl = URL.createObjectURL(blob)
              if (slide.data) {
                slide.data = slide.data as ExtendedFileT
                slide.data.url = fileUrl
              }
              if (!(slide.data as ExtendedFileT)?.type?.includes("audio")) {
                slide.background = fileUrl
              }
            }
          } else if (slide?.backgroundVideoKey) {
            const cachedBackgroundVideo = await db.cached.get(
              slide?.backgroundVideoKey
            )
            if (cachedBackgroundVideo) {
              const arrayBuffer = cachedBackgroundVideo?.data!!
              const blob = new Blob([arrayBuffer], {
                type: cachedBackgroundVideo?.content?.type,
              })
              const fileUrl = URL.createObjectURL(blob)
              slide.background = fileUrl
            }
          }
        })
      )
    }
  }

  await processSlidesInBatches(slides)
  appStore.setActiveSlides(slides)
  appStore.setSlidesLoading(false)

  // For saved slides - process asynchronously without blocking
  db.library
    .where("type")
    .equals("slide")
    .toArray()
    .then((savedSlides) => {
      // Process saved slides in background
      savedSlides?.forEach((slide) => {
        if ((slide.content as Slide)?.background?.startsWith("blob:")) {
          db.media
            .get(slide.id)
            .then((resp) => {
              if (!resp) return
              const media = resp

              const arrayBuffer: ArrayBuffer = media?.data as ArrayBuffer
              const blob = new Blob([arrayBuffer], {
                type: media?.content?.type,
              })
              const fileUrl = URL.createObjectURL(blob)
              const updatedLibraryItem: LibraryItem = {
                ...slide,
                content: {
                  ...slide.content,
                  background: fileUrl,
                  data: { ...(slide.content as Slide).data, url: fileUrl },
                } as Slide,
              }
              db.library
                .update(slide.id, updatedLibraryItem)
                .catch((err) =>
                  console.error("Failed to update library item:", err)
                )
            })
            .catch((err) => console.error("Failed to get media:", err))
        }
      })
    })
    .catch((err) => console.error("Failed to get saved slides:", err))

  setCachedVideosURL()
}

const setCachedVideosURL = async () => {
  const cachedVideos = await useBackgroundVideos()
  const tempCachedVideos: BackgroundVideo[] = cachedVideos?.map(
    (cached: Media) => ({
      id: cached?.id,
      url: URL.createObjectURL(cached?.data as Blob),
    })
  )
  cachedVideosURLs.value = tempCachedVideos
  appStore.setBackgroundVideos(tempCachedVideos)
}

// WINDOW MANAGEMENT CODE STARTS HERE

// Tauri window management for desktop app
async function openTauriLiveWindow() {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow")

    // Get available monitors
    const { availableMonitors, currentMonitor } = await import(
      "@tauri-apps/api/window"
    )
    const monitors = await availableMonitors()
    const current = await currentMonitor()

    console.log("Available monitors:", monitors)
    console.log("Current monitor:", current)
    console.log(
      "Saved mainDisplayLabel:",
      appStore.currentState.mainDisplayLabel
    )

    // Check if live window already exists
    const { getAllWebviewWindows } = await import(
      "@tauri-apps/api/webviewWindow"
    )
    const existingWindows = await getAllWebviewWindows()
    const existingLiveWindow = existingWindows.find(
      (w: any) => w.label === "live-output"
    )

    if (existingLiveWindow) {
      await existingLiveWindow.setFocus()
      return
    }

    if (!appStore.currentState.mainDisplayLabel) {
      useToast().add({
        title: "Set up your live display first",
        icon: "i-bx-info-circle",
      })
      useGlobalEmit(appWideActions.openSettings, "Display Settings")
      return
    }

    if (monitors.length === 1) {
      useToast().add({
        title:
          "Only one screen detected. Connect a second screen to project on another display",
        icon: "i-bx-info-circle",
      })
    }

    // Find the target monitor based on saved settings
    let targetMonitor = monitors.find((monitor: any) => {
      const monitorId = useScreenId(monitor)
      console.log(
        "Checking monitor ID:",
        monitorId,
        "against saved:",
        appStore.currentState.mainDisplayLabel
      )
      return monitorId === appStore.currentState.mainDisplayLabel
    })

    console.log("Target monitor found:", targetMonitor)

    // Fallback strategy: Select a monitor that's NOT the current monitor
    if (!targetMonitor) {
      console.log("Target monitor not found, using fallback strategy")

      // Get current monitor ID for comparison
      const currentMonitorId = current ? useScreenId(current) : null
      console.log("Current monitor ID:", currentMonitorId)

      // Try to find a monitor that is NOT the current monitor
      if (current && monitors.length > 1) {
        targetMonitor = monitors.find((monitor: any) => {
          const monitorId = useScreenId(monitor)
          return monitorId !== currentMonitorId
        })
        console.log("Found non-current monitor:", targetMonitor)
      }

      // Final fallback: use second monitor if available, otherwise first
      if (!targetMonitor) {
        targetMonitor = monitors.length > 1 ? monitors[1] : monitors[0]
        console.log("Using final fallback monitor:", targetMonitor)
      }
    }

    // Get fullscreen setting from store
    const isFullscreen =
      appStore.currentState.settings.liveWindowFullscreen ?? true

    // Create new window on the target monitor
    const liveWindow = new WebviewWindow("live-output", {
      url: "/live",
      title: "Cloud of Worship - Live Output",
      alwaysOnTop: false,
      decorations: !isFullscreen, // Show decorations only when not fullscreen
      resizable: true,
      closable: true,
      fullscreen: isFullscreen,
      x: targetMonitor.position.x,
      y: targetMonitor.position.y,
      width: targetMonitor.size.width,
      height: targetMonitor.size.height,
    })

    // Wait for window to be ready
    await liveWindow.once("tauri://created", () => {})

    // Listen for window close
    await liveWindow.once("tauri://close-requested", async () => {
      console.log("Live window closed")
      // Clean up windowRefs when window is closed
      windowRefs.value = []
    })

    // Add windowRef to track if live window is active
    const tempWindowRefs = windowRefs.value
    tempWindowRefs.push(liveWindow)
    windowRefs.value = tempWindowRefs
  } catch (error) {
    console.error("Error opening Tauri window:", error)
    useToast().add({
      title: "Failed to open live window",
      description: "Please try again or check your display settings",
      icon: "i-bx-error-circle",
      color: "red",
    })
  }
}

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

async function closeAllWindows() {
  const { isTauri } = useTauri()

  if (isTauri) {
    const { getAllWebviewWindows } = await import(
      "@tauri-apps/api/webviewWindow"
    )
    const existingWindows = await getAllWebviewWindows()
    const existingLiveWindow = existingWindows.find(
      (w: any) => w.label === "live-output"
    )
    if (existingLiveWindow) {
      try {
        await existingLiveWindow.close()
      } catch (error) {
        console.log("Window already closed or error closing:", error)
      }
    }
  } else {
    windowRefs.value.forEach((windowRef: any) => {
      try {
        if (windowRef && !windowRef.closed) {
          windowRef.close()
        }
      } catch (error) {
        console.log("Error closing window:", error)
      }
    })
  }
  windowRefs.value = []
}

async function openWindows() {
  if ("getScreenDetails" in window) {
    // prettier-ignore
    const screenDetails = await (window as any).getScreenDetails()
    screenDetails.currentScreen.id = useScreenId(screenDetails?.currentScreen)
    screenDetails?.screens?.forEach((screen: any) => {
      screen.id = useScreenId(screen)
    })
    const noOfScreens = screenDetails.screens.length

    if (!appStore.currentState.mainDisplayLabel) {
      useToast().add({
        title: "Set up your live display first",
        icon: "i-bx-info-circle",
      })
      useGlobalEmit(appWideActions.openSettings, "Display Settings")
      return
    }

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
      // const screen1 = screenDetails.screens[0]
      // const screen2 = screenDetails.screens[1]
      const mainDisplayScreen = screenDetails.screens?.find(
        (screen: any) => screen.id === appStore.currentState.mainDisplayLabel
      )
      if (mainDisplayScreen) {
        openWindow(
          mainDisplayScreen.availLeft,
          mainDisplayScreen.availTop,
          mainDisplayScreen.availWidth,
          mainDisplayScreen.availHeight,
          `http://${window.location.host}/live`
        )
      } else {
        useToast().add({
          title: "Unable to find live display, update your display settings",
          icon: "i-bx-info-circle",
        })
      }
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
  } else {
    useToast().add({
      title: "Your browser does not support automatic displays detection",
      icon: "i-bx-info-circle",
      color: "amber",
    })
  }
}
// WINDOW MANAGEMENT CODE ENDS HERE

onMounted(() => {
  downloadEssentialResources()
  fetchActiveAdvert()
  if (location.hostname !== "localhost") {
    useGtag()
  }
})

if (isAppOnline.value) {
  fetchUser()
  fetchChurch()
  fetchAppInfo()
  fetchHymns()
  refreshLibrary()
}
</script>

<style scoped></style>
