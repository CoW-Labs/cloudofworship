<template>
  <div
    v-if="!loadingResources"
    class="app-ctn min-h-[100vh] max-h-[100vh] overflow-hidden bg-gray-100 text dark:bg-[#111722]"
  >
    <Navbar :app-version="appVersion" :online="isAppOnline" />
    <SubscriptionExpiryBanner />
    <slot />
    <FullScreenLoader v-if="fullScreenLoading" />
    <ClientOnly>
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
      <AdvertModal
        v-model="showAdvertModal"
        :active-advert="currentState.activeAdvert"
      />
      <UpgradePlanModal />
      <OnboardingTour />
    </ClientOnly>
  </div>
  <Transition name="fade-sm">
    <div
      v-if="loadingResources"
      class="loading-ctn h-[100vh] w-[100vw] fixed inset-0 z-50 grid place-items-center bg-white px-6 text-[#131724] dark:bg-[#131724] dark:text-white"
    >
      <div class="wrapper flex w-full max-w-[324px] flex-col items-center">
        <CoWSplashLogo class="w-[76px] shrink-0" />

        <div
          class="bar mt-[34px] h-1 w-full overflow-hidden rounded-full bg-[#e6e8ef] dark:bg-[#222838]"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="overallLoadingProgress"
          :aria-label="loadingDetail || currentLoadingTask.description"
        >
          <div
            class="h-full rounded-full bg-current transition-[width] duration-500 ease-out"
            :style="{ width: `${Math.max(overallLoadingProgress, 3)}%` }"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Church } from "~/store/auth"
import type { Emitter } from "mitt"
import type { User } from "~/store/auth"
import type {
  BackgroundVideo,
  Schedule,
  SlideStyle,
  Advert,
  Slide,
  Hymn,
  AppSettings,
} from "~/types"
import { useOnline } from "@vueuse/core"
import { appWideActions } from "~/utils/constants"
import { safeDBOperation } from "~/composables/useIndexedDB"
import { invalidateHymnCache } from "~/composables/useHymn"

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
// shallowRef, not ref: a deep ref wraps every element in reactive(), and
// building that proxy reads `__v_isReadonly`/`__v_skip` off the object. On a
// cross-origin popup window those reads throw SecurityError — which is exactly
// what the 250ms checkWindowClose poll below was hitting. Vue must never touch
// these Window handles, so we keep the ref shallow and always assign a new
// array (a shallowRef ignores in-place mutation of the same reference).
const windowRefs = shallowRef<any[]>([])
const db = useIndexedDB()
const localMedia = useLocalMediaStorage()
const appInfo = ref<AppSettings>()
const { refreshLibrary } = useLibrary()
const { fetchPlans } = useSubscriptionPlans()
const { fetchUserSettings } = useUserSettings()
const ndiBroadcast = useNdiBroadcast()

const { currentState } = storeToRefs(appStore)

const loadingTasks = [
  {
    id: "startup",
    label: "Account and app settings",
    description: "Checking your saved session and refreshing app settings.",
    icon: "i-lucide-user-check",
  },
  {
    id: "videos",
    label: "Background videos",
    description:
      "Preparing cached motion backgrounds without blocking the app.",
    icon: "i-lucide-video",
  },
  {
    id: "schedules",
    label: "Schedules and slides",
    description: "Merging online schedules with your local presentation data.",
    icon: "i-lucide-calendar-days",
  },
  {
    id: "bible",
    label: "Bible versions",
    description: "Making sure the default Bible text is available offline.",
    icon: "i-lucide-book-open",
  },
  {
    id: "hymns",
    label: "Hymns",
    description:
      "Checking the local hymn library and refreshing when possible.",
    icon: "i-lucide-music",
  },
  {
    id: "display",
    label: "Display setup",
    description: "Finding the best screen for live projection.",
    icon: "i-lucide-monitor-play",
  },
  {
    id: "ready",
    label: "Ready",
    description: "Finalizing your workspace.",
    icon: "i-lucide-check-circle",
  },
] as const

type LoadingTaskId = (typeof loadingTasks)[number]["id"]

const loadingTaskId = ref<LoadingTaskId>("startup")
const loadingDetail = ref<string>("Checking your saved workspace.")

const currentLoadingTaskIndex = computed(() => {
  const index = loadingTasks.findIndex(
    (task) => task.id === loadingTaskId.value
  )
  return Math.max(index, 0)
})

const currentLoadingTask = computed(() => {
  return loadingTasks[currentLoadingTaskIndex.value] || loadingTasks[0]
})

const currentTaskProgress = computed(() => {
  const progress = Number.parseInt(downloadProgress.value || "0", 10)
  return Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 100) : 0
})

const overallLoadingProgress = computed(() => {
  const completedSteps = currentLoadingTaskIndex.value
  const currentStepRatio = currentTaskProgress.value / 100
  return Math.min(
    100,
    Math.round(
      ((completedSteps + currentStepRatio) / loadingTasks.length) * 100
    )
  )
})

const setLoadingTask = (
  taskId: LoadingTaskId,
  detail?: string,
  progress = 0
) => {
  loadingTaskId.value = taskId
  downloadStep.value = currentLoadingTaskIndex.value
  downloadResource.value =
    loadingTasks.find((task) => task.id === taskId)?.label || ""
  loadingDetail.value =
    detail || loadingTasks.find((task) => task.id === taskId)?.description || ""
  downloadProgress.value = `${progress}`
}

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
    return user
  }
  return null
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
      // Song catalog syncs (non-destructively) via refreshLibrary() in the
      // Phase 2 background init — no separate fetch needed here.
    }
    if (error.value) {
      console.warn("Unable to refresh church information:", error.value)
    }
  } else {
    if (!authStore.user?._id) {
      navigateTo("/login")
      return
    }
    console.warn("No church ID available; keeping local app state.")
  }
}

const fetchAppInfo = async () => {
  // Download app info
  const { data } = await useAPIFetch("/app-config/info")
  if (data.value) {
    appInfo.value = data.value as any
  }
}

const fetchHymns = async () => {
  if (!online.value) {
    setLoadingTask(
      "hymns",
      "Offline: using hymns already saved on this device.",
      100
    )
    return
  }

  try {
    setLoadingTask("hymns", "Checking the local hymn library.", 10)
    let hymnCount: any
    const hymns = await db.bibleAndHymns.get("hymns")
    const tokenValue = getToken()

    hymnCount = await fetch(`${config.public.BASE_URL}/hymn/count`, {
      headers: {
        Authorization: `Bearer ${tokenValue}`,
        ...(config.public.NODE_ENV === "development"
          ? { "x-dev-token": config.public.DEV_TOKEN }
          : {}),
      },
    })
    hymnCount = await hymnCount.json()

    if (hymns?.data?.length !== hymnCount) {
      await db.bibleAndHymns
        .delete("hymns")
        .catch((err) => console.error("Failed to delete hymns:", err))
      setLoadingTask("hymns", "Downloading the latest hymn library.", 0)
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
      await safeDBOperation((d) => d.bibleAndHymns.put(tempBibleVersion("hymns", hymns)))
      // The lookup index is built once per window from the old record
      invalidateHymnCache()
    } else {
      setLoadingTask("hymns", "Hymns are already available offline.", 100)
    }
  } catch (err) {
    console.warn(
      "Failed to refresh hymns; using local cache if available:",
      err
    )
    setLoadingTask(
      "hymns",
      "Unable to refresh hymns. Local cache will be used.",
      100
    )
  }
}

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>

emitter.on("app-loading", (loading) => {
  fullScreenLoading.value = loading
})

// PWA install/refresh/cancel logic removed

emitter.on("close-offline-toast", () => {
  isOfflineToastOpen.value = false
})

emitter.on("selected-schedule", (schedule: Schedule) => {
  appStore.setSlidesLoading(true)
  retrieveAllMediaFilesFromDB()
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

emitter.on(appWideActions.openStageDisplay, async () => {
  const { isTauri } = useTauri()

  if (isTauri) {
    await openTauriStageWindow()
  } else {
    await openStageDisplayWindow()
  }

  usePosthogCapture("STAGE_DISPLAY_OPENED")
})

const saveAllBackgroundVideos = async (options?: { wait?: boolean }) => {
  const videoIds = [1, 2, 3, 4, 5, 6, 9, 10]
  const savedKeys = new Set(
    (await localMedia.listRecords()).map((record) => record.key)
  )
  const missingVideoIds = videoIds.filter(
    (id) => !savedKeys.has(`/video-bg-${id}.mp4`)
  )

  if (missingVideoIds.length === 0) {
    setLoadingTask("videos", "Background videos are already cached.", 100)
    return
  }

  setLoadingTask(
    "videos",
    `Caching ${missingVideoIds.length} background videos in the background.`,
    100
  )

  const downloadMissingVideos = async () => {
    const downloadVideo = async (id: number) => {
      try {
        const url = `https://d37gopmfkl2m2z.cloudfront.net/open/bg-videos/video-bg-${id}.mp4`
        await localMedia.downloadToLocal({
          key: `/video-bg-${id}.mp4`,
          groupId: `/video-bg-${id}.mp4`,
          category: "preset",
          kind: "video",
          url,
          mimeType: "video/mp4",
          recoverable: true,
          onProgress: (fraction) => {
            if (options?.wait && Number.isFinite(fraction)) {
              downloadProgress.value = (fraction * 100).toFixed(2)
            }
          },
        })
      } catch (err) {
        console.warn(`Failed to download video-bg-${id} (offline?):`, err)
      }
    }

    const batchSize = 2
    for (let i = 0; i < missingVideoIds.length; i += batchSize) {
      await Promise.all(missingVideoIds.slice(i, i + batchSize).map(downloadVideo))
    }
  }

  if (options?.wait) {
    await downloadMissingVideos()
  } else {
    downloadMissingVideos().catch((err) => {
      console.warn("Failed to cache background videos:", err)
    })
  }
}

const tempBibleVersion = (version: string, data: any) => ({
  id: version,
  data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const showAdvertModal = ref(false)
const SHOWN_ADVERTS_KEY = "cow-shown-advert-ids"

const hasAdvertBeenShown = (id: string) => {
  const shownIds: string[] = JSON.parse(
    localStorage.getItem(SHOWN_ADVERTS_KEY) || "[]"
  )
  return shownIds.includes(id)
}

const markAdvertAsShown = (id: string) => {
  const shownIds: string[] = JSON.parse(
    localStorage.getItem(SHOWN_ADVERTS_KEY) || "[]"
  )
  if (!shownIds.includes(id)) {
    shownIds.push(id)
    localStorage.setItem(SHOWN_ADVERTS_KEY, JSON.stringify(shownIds))
  }
}

// Fresh signups are still finding their way around the workspace — an advert
// modal on top of that is the wrong first impression. They start seeing adverts
// once the account is past this grace period.
const NEW_ACCOUNT_ADVERT_GRACE_DAYS = 7

const isNewlySignedUpUser = () => {
  const createdAt = authStore.user?.createdAt
  if (!createdAt) return false

  const createdAtMs = new Date(createdAt).getTime()
  if (Number.isNaN(createdAtMs)) return false

  const graceMs = NEW_ACCOUNT_ADVERT_GRACE_DAYS * 24 * 60 * 60 * 1000
  return Date.now() - createdAtMs < graceMs
}

const fetchActiveAdvert = async () => {
  const { data } = await useAPIFetch(`/advert/active`)
  const advert = data.value as Advert | null
  appStore.setActiveAdvert(advert)
  return advert
}

const downloadEssentialResources = async () => {
  const db = useIndexedDB()
  loadingResources.value = true

  // ── Phase 1: Critical path ────────────────────────────────────────────────
  // Only what the workspace needs to render. Everything else runs in the
  // background after the loading screen is dismissed.
  setLoadingTask("startup", "Refreshing account, church, and schedules.", 5)

  if (online.value) {
    // fetchChurch() and retrieveSchedules() read churchId out of the store
    // rather than taking it as an argument, so they can only run alongside
    // fetchUser() once something has already put it there. After the first
    // successful load it is in persisted state, and the three calls have no
    // real ordering dependency — sharing one round trip instead of two.
    //
    // On a cold device they stay behind fetchUser(): fetchChurch() with no
    // user in the store takes its no-churchId branch and redirects a
    // perfectly valid session to /login.
    const cachedChurchId = authStore.user?.churchId || authStore.church?._id

    const userRequest = fetchUser()
    const warmRequest = cachedChurchId
      ? Promise.allSettled([fetchChurch(), retrieveSchedules()])
      : null

    const user = await userRequest

    if (!user && !authStore.user?._id) {
      loadingResources.value = false
      navigateTo("/login")
      return
    }

    if (authStore.user?.emailVerified === false) {
      loadingResources.value = false
      navigateTo("/verify")
      return
    }

    if (warmRequest) {
      await warmRequest

      // The warm pass keyed off the cached church. If the account has since
      // been moved to a different one, it fetched the wrong church's data and
      // has to be redone against the identity the server just confirmed.
      if (user?.churchId && user.churchId !== cachedChurchId) {
        await Promise.allSettled([fetchChurch(), retrieveSchedules()])
      }
    } else {
      await Promise.allSettled([fetchChurch(), retrieveSchedules()])
    }
  } else {
    setLoadingTask("startup", "Offline: using saved account and app settings.", 100)
    await retrieveSchedules()
  }

  setLoadingTask("ready", "Opening your workspace.", 100)
  loadingResources.value = false

  await nextTick()
  useGlobalEmit(
    appWideActions.selectedSchedule,
    appStore.currentState.activeSchedule?._id
  )
  overrideAppSettings()
  appStore.refreshAppActionsStack()

  // ── Phase 2: Background ───────────────────────────────────────────────────
  // These run after the workspace is visible. Errors are isolated and non-fatal.
  if (online.value) {
    Promise.allSettled([
      // App info then populate Bible version options (chained dependency)
      fetchAppInfo().then(async () => {
        const { populateBibleVersionOptions } = useBibleVersionManager()
        await populateBibleVersionOptions(
          appInfo.value?.bibleVersions?.length
            ? appInfo.value.bibleVersions
            : undefined
        )
      }),
      refreshLibrary(),
      fetchPlans(),
      saveAllBackgroundVideos(),
      // KJV Bible — only downloads once per device
      (async () => {
        const tempBible = await db.bibleAndHymns.get("KJV")
        if (!tempBible) {
          try {
            let kjvBible = await useDetailedFetch(
              `https://d37gopmfkl2m2z.cloudfront.net/open/bible-versions/kjv.json`,
              downloadProgress
            )
            kjvBible = await kjvBible.json()
            await safeDBOperation((d) => d.bibleAndHymns.put(tempBibleVersion("KJV", kjvBible)))
          } catch (err) {
            console.warn("Failed to download KJV Bible:", err)
          }
        }
      })(),
      fetchHymns(),
      // User settings + preferred non-KJV Bible version
      (async () => {
        if (!authStore.user?._id) return
        const userSettings = await fetchUserSettings()
        const preferredVersion =
          userSettings?.defaultBibleVersion ||
          appStore.currentState.settings.defaultBibleVersion
        if (preferredVersion && preferredVersion !== "KJV") {
          const { isBibleVersionDownloaded, downloadBibleVersion } =
            useBibleVersionManager()
          const alreadyDownloaded = await isBibleVersionDownloaded(preferredVersion)
          if (!alreadyDownloaded) {
            try {
              await downloadBibleVersion(preferredVersion)
            } catch (err) {
              console.error(`Failed to auto-download ${preferredVersion}:`, err)
            }
          }
        }
      })(),
    ])

    // Secondary display detection — fire and forget, go-live flows self-detect
    useAutoDetectSecondaryDisplay()
  }
}

const overrideAppSettings = async () => {
  const currentAppSettings = appStore.currentState.settings
  // Override App Settings if current app version mismatches appVersion in state
  // TODO: When appSettings is editable by user, it must take preference over system settings and override
  if (currentAppSettings.appVersion !== props.appVersion) {
    setTimeout(() => {
      // Only show changelog modal for major or minor version bumps, not patch updates
      // e.g. 0.43.8 -> 0.44.0 shows changelog, but 0.43.8 -> 0.43.9 does not
      const prevParts = (currentAppSettings.appVersion || "0.0.0")
        .split(".")
        .map(Number)
      const newParts = (props.appVersion || "0.0.0").split(".").map(Number)
      const isMajorOrMinorUpdate =
        newParts[0] > prevParts[0] || // major bump
        (newParts[0] === prevParts[0] && newParts[1] > prevParts[1]) // minor bump
      if (isMajorOrMinorUpdate) {
        useGlobalEmit(appWideActions.showChangelog)
      }
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
  const churchId = authStore.user?.churchId || authStore.church?._id
  if (!isAppOnline.value) {
    setLoadingTask(
      "schedules",
      "Offline: using schedules saved on this device.",
      100
    )
    return
  }

  if (!churchId) {
    setLoadingTask(
      "schedules",
      "No church ID found. Keeping local schedules.",
      100
    )
    return
  }

  downloadProgress.value = "0"
  const { data } = await useAPIFetch(`/church/${churchId}/schedules`)

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
  setLoadingTask("schedules", "Schedules and slides are ready.", 100)
}

const retrieveAllMediaFilesFromDB = async () => {
  const db = useIndexedDB()
  const mediaStorage = useLocalMediaStorage()

  const defaultBackground =
    appStore.currentState.settings.defaultBackground.default
  if (defaultBackground?.backgroundImageKey) {
    const url = await mediaStorage.ensureLocal(
      defaultBackground.backgroundImageKey,
      {
        url: defaultBackground.background,
        category: "background",
        kind: "image",
        groupId: defaultBackground.backgroundImageKey,
      }
    )
    if (url) defaultBackground.background = url
  }

  const intermission = appStore.currentState.settings.intermission
  if (intermission?.backgroundImageKey) {
    const url = await mediaStorage.ensureLocal(intermission.backgroundImageKey, {
      url: intermission.background,
      category: "background",
      kind: "image",
      groupId: intermission.backgroundImageKey,
    })
    if (url) intermission.background = url
  }

  // For active slides - use Promise.all instead of forEach
  const slides = [...appStore.activeSlides]

  // Rehydrate each slide through the active platform media backend.
  // Local-only here (allowDownload: false) so startup stays cheap; missing
  // copies are pulled later by the non-blocking prefetch below. The helper is
  // Local-first, so a slide whose durable `background` is now a hosted
  // https URL still plays from its local copy instead of streaming.
  const { rehydrateSlideMedia, prefetchScheduleMedia } = useSlideMediaCache()

  // Process slides in parallel but in small batches to avoid blocking
  const processSlidesInBatches = async (
    slidesToProcess: Slide[],
    batchSize = 5
  ) => {
    for (let i = 0; i < slidesToProcess.length; i += batchSize) {
      const batch = slidesToProcess.slice(i, i + batchSize)
      await Promise.all(
        batch.map((slide: Slide) =>
          rehydrateSlideMedia(slide, { allowDownload: false })
        )
      )
    }
  }

  await processSlidesInBatches(slides)
  // `slides` holds the store's own slide objects, and rehydration rewrites
  // their URLs in place, so the store is already current. Writing the snapshot
  // back would also undo anything that landed while this pass was awaiting —
  // a schedule the server refreshed, or a slide another window added.
  appStore.setSlidesLoading(false)

  // Idle prefetch: prepare all downloadable schedule media without blocking
  // startup.
  prefetchScheduleMedia(slides, appStore.currentState.liveSlideId).catch((err) =>
    console.warn("Background media prefetch failed:", err)
  )

  // For saved slides - process asynchronously without blocking
  db.library
    .where("type")
    .equals("slide")
    .toArray()
    .then((savedSlides) => {
      // Process saved slides in background
      savedSlides?.forEach(async (item) => {
        const content = item.content as Slide
        const rehydrated = await rehydrateSlideMedia(content, {
          allowDownload: false,
        })
        await db.library.update(item.id, { ...item, content: rehydrated })
      })
    })
    .catch((err) => console.error("Failed to get saved slides:", err))

  setCachedVideosURL()
}

const setCachedVideosURL = async () => {
  const cachedVideos = await useBackgroundVideos()
  cachedVideosURLs.value = cachedVideos
  appStore.setBackgroundVideos(cachedVideos)
}

// WINDOW MANAGEMENT CODE STARTS HERE

// Tauri window management for desktop app
async function startNdiForLiveWindow() {
  if (!appStore.currentState.settings.ndiEnabled) return
  try {
    await ndiBroadcast.start()
  } catch (error: any) {
    console.warn("NDI live output could not start:", error)
    useToast().add({
      title: "The live window opened without NDI",
      description:
        error?.message || "Open Display Settings for details and retry options.",
      icon: "i-bx-info-circle",
      color: "amber",
    })
  }
}

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
      await startNdiForLiveWindow()
      return
    }

    if (monitors.length === 1) {
      useToast().add({
        title:
          "Only one screen detected. Connect a second screen to project on another display",
        icon: "i-bx-info-circle",
      })
    }

    // If no display has been configured yet, attempt auto-detection now
    if (!appStore.currentState.mainDisplayLabel) {
      await useAutoDetectSecondaryDisplay(true)
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

    // Fallback strategy: Select a monitor that's NOT the current monitor
    if (!targetMonitor) {
      console.log("Target monitor not found, using fallback strategy")

      // First try to use stored mainDisplayScreen position
      const savedScreen = appStore.currentState.mainDisplayScreen
      if (
        savedScreen?.availLeft !== undefined &&
        savedScreen?.availTop !== undefined
      ) {
        console.log(
          "Using saved mainDisplayScreen position:",
          savedScreen.availLeft,
          savedScreen.availTop
        )
        targetMonitor = monitors.find((monitor: any) => {
          return (
            monitor.position.x === savedScreen.availLeft &&
            monitor.position.y === savedScreen.availTop
          )
        })
        console.log("Found monitor by position:", targetMonitor)
      }

      // If still not found, get current monitor ID for comparison
      if (!targetMonitor) {
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

    // Window options are in logical units while monitors report physical
    // pixels, so a Retina/scaled projector needs the scale factor divided out —
    // otherwise the live window lands half-size and offset from the display.
    const scale = targetMonitor.scaleFactor || 1

    // Create new window on the target monitor
    const liveWindow = new WebviewWindow("live-output", {
      url: "/live",
      title: "Cloud of Worship - Live Output",
      alwaysOnTop: false,
      decorations: !isFullscreen, // Show decorations only when not fullscreen
      resizable: true,
      closable: true,
      fullscreen: isFullscreen,
      x: targetMonitor.position.x / scale,
      y: targetMonitor.position.y / scale,
      width: targetMonitor.size.width / scale,
      height: targetMonitor.size.height / scale,
    })

    // Capture can only resolve the native window after Tauri confirms creation.
    await liveWindow.once("tauri://created", async () => {
      windowRefs.value = [...windowRefs.value, liveWindow]
      await startNdiForLiveWindow()
    })

    // Listen for window close
    await liveWindow.once("tauri://close-requested", async () => {
      console.log("Live window closed")
      try {
        await ndiBroadcast.stop()
      } catch (error) {
        console.warn("NDI cleanup after live window close failed:", error)
      }
      // Clean up windowRefs when window is closed
      windowRefs.value = []
    })
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
    windowRefs.value = [...windowRefs.value, windowRef]
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
        await ndiBroadcast.stop()
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

    if (noOfScreens === 1) {
      // Only one screen — open live window on it directly
      const screen1 = screenDetails.screens[0]
      openWindow(
        screen1.availLeft,
        screen1.availTop,
        screen1.availWidth,
        screen1.availHeight,
        `${window.location.origin}/live`
      )
    } else {
      // Multiple screens — try saved label first, then auto-pick the non-primary
      let targetScreen = screenDetails.screens.find(
        (screen: any) => screen.id === appStore.currentState.mainDisplayLabel
      )

      // Saved label not found (e.g. monitor was swapped) — re-run auto-detection
      // and try again with the freshly picked screen
      if (!targetScreen) {
        await useAutoDetectSecondaryDisplay(true)
        targetScreen = screenDetails.screens.find(
          (screen: any) => screen.id === appStore.currentState.mainDisplayLabel
        )
      }

      // Last resort: pick any screen that isn't the current app screen
      if (!targetScreen) {
        const currentId = (screenDetails.currentScreen as any).id
        targetScreen =
          screenDetails.screens.find((s: any) => s.isPrimary === false) ||
          screenDetails.screens.find((s: any) => s.id !== currentId) ||
          screenDetails.screens[0]
      }

      if (targetScreen) {
        openWindow(
          targetScreen.availLeft,
          targetScreen.availTop,
          targetScreen.availWidth,
          targetScreen.availHeight,
          `${window.location.origin}/live`
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
      const isClosed = (windowRef: any) => {
        try {
          return Boolean(windowRef?.closed)
        } catch {
          // A window we can no longer read (navigated cross-origin, or torn
          // down mid-read) is one we can't manage either — treat it as gone.
          return true
        }
      }

      if (windowRefs.value.some(isClosed)) {
        closeAllWindows()
        clearInterval(closeMonitor)
      }
    }

    // Close popup windows when the operator tab closes, but only when the user
    // has opted into this behaviour (default is to leave the live window open)
    window.addEventListener("beforeunload", () => {
      if (appStore.currentState.settings.closeLiveWindowWithOperator) {
        closeAllWindows()
      }
    })

    screenDetails.addEventListener("screenschange", () => {
      // TODO: Action when screen count changes
    })
  } else {
    // Browser doesn't support Screen Details API — open live window in a new tab/window
    openWindow(
      0,
      0,
      window.screen.availWidth,
      window.screen.availHeight,
      `${window.location.origin}/live`
    )
  }
}
// ── STAGE DISPLAY ───────────────────────────────────────────────────────────
// Kept out of `windowRefs` on purpose: that array drives closeAllWindows() and
// the close-poller for the live output, so putting the stage window in it would
// make closing one tear down the other.

/**
 * Picks the screen the stage display should open on.
 *
 * The live output owns its screen outright — that's the one the congregation
 * sees — so the stage display never claims it, even when the live window isn't
 * open yet. An explicit assignment from Display Settings wins; failing that it
 * takes a spare screen (neither the control center's nor the live output's),
 * which only exists once more than two displays are connected. With nothing
 * spare it returns null and the caller opens a plain tab/window instead.
 *
 * Works for both browser screens and Tauri monitors — `id` is assigned by
 * `useScreenId` in either case.
 */
const pickStageTarget = <T extends { id: string }>(
  targets: T[],
  currentId: string | null,
  liveId: string
): T | null => {
  const savedId = appStore.currentState.stageDisplayLabel
  if (savedId) {
    const saved = targets.find((target) => target.id === savedId)
    if (saved && saved.id !== liveId) return saved
  }

  return (
    targets.find(
      (target) => target.id !== currentId && target.id !== liveId
    ) || null
  )
}

async function openTauriStageWindow() {
  try {
    const { WebviewWindow, getAllWebviewWindows } = await import(
      "@tauri-apps/api/webviewWindow"
    )

    // Already open — bring it forward rather than failing on a duplicate label
    const existing = (await getAllWebviewWindows()).find(
      (window: any) => window.label === "stage-display"
    )
    if (existing) {
      await existing.setFocus()
      return
    }

    const { availableMonitors, currentMonitor } = await import(
      "@tauri-apps/api/window"
    )
    const monitors = await availableMonitors()
    const current = await currentMonitor()

    const identified = (monitors || []).map((monitor: any) => ({
      id: useScreenId(monitor),
      monitor,
    }))
    const target = pickStageTarget(
      identified,
      current ? useScreenId(current) : null,
      appStore.currentState.mainDisplayLabel
    )

    // Positions are physical pixels while window options are logical units, so
    // the scale factor has to be divided out (same as the live window).
    const monitor = target?.monitor
    const scale = monitor?.scaleFactor || 1

    const stageWindow = new WebviewWindow("stage-display", {
      url: "/stage",
      title: "Cloud of Worship - Stage Display",
      alwaysOnTop: false,
      resizable: true,
      closable: true,
      // No screen of its own — open as an ordinary window the operator can
      // move, which is the desktop equivalent of the web build's new tab.
      ...(monitor
        ? {
            decorations: false,
            fullscreen: true,
            x: monitor.position.x / scale,
            y: monitor.position.y / scale,
            width: monitor.size.width / scale,
            height: monitor.size.height / scale,
          }
        : { decorations: true, fullscreen: false, width: 1280, height: 720 }),
    })

    await stageWindow.once("tauri://error", (event: any) => {
      console.error("Stage display window failed to open:", event)
    })
  } catch (error) {
    console.error("Error opening stage display window:", error)
    useToast().add({
      title: "Failed to open the stage display",
      description: "Please try again or check your display settings",
      icon: "i-bx-error-circle",
      color: "red",
    })
  }
}

async function openStageDisplayWindow() {
  const url = `${window.location.origin}/stage`
  const openInNewTab = () => window.open(url, "_blank")

  if (!("getScreenDetails" in window)) {
    openInNewTab()
    return
  }

  try {
    // prettier-ignore
    const screenDetails = await (window as any).getScreenDetails()
    const currentId = useScreenId(screenDetails?.currentScreen)
    const screens: any[] = (screenDetails?.screens || []).map(
      (screen: any) => {
        screen.id = useScreenId(screen)
        return screen
      }
    )

    const target = pickStageTarget(
      screens,
      currentId,
      appStore.currentState.mainDisplayLabel
    )
    if (!target) {
      openInNewTab()
      return
    }

    const features = `left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`
    const stageWindow = window.open(url, "_blank", features)
    if (!stageWindow) {
      useToast().add({
        title:
          "Popups are blocked. Ensure you are not blocking popups for this site.",
        icon: "i-bx-info-circle",
        color: "red",
      })
    }
  } catch (error) {
    // Permission for the Screen Details API was denied or it failed outright —
    // a tab still gets the operator a stage display.
    console.warn("Could not place the stage display on a screen:", error)
    openInNewTab()
  }
}

// The web build ties the live popup's lifetime to the operator tab via
// `beforeunload` inside openWindows(). Desktop windows never fire that, so the
// projection window would outlive the control center it belongs to.
async function bindTauriLiveWindowLifecycle() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window")

    await getCurrentWindow().onCloseRequested(async () => {
      if (appStore.currentState.settings.closeLiveWindowWithOperator) {
        await closeAllWindows()
      }
    })
  } catch (error) {
    console.error("Failed to bind live window lifecycle:", error)
  }
}
// WINDOW MANAGEMENT CODE ENDS HERE

onMounted(async () => {
  // Step 1 of the slide-storage migration: create a verified IndexedDB copy
  // while Pinia remains the runtime source of truth. The legacy localStorage
  // payload is deliberately retained for rollback until the repository cutover
  // has shipped and proven stable.
  try {
    await runDataMigrations(appStore.activeSlides)
  } catch (error) {
    console.error(
      "Unable to prepare durable slide storage; continuing with legacy storage:",
      error
    )
  }

  const { isTauri } = useTauri()
  if (isTauri) {
    await ndiBroadcast.initialize()
    bindTauriLiveWindowLifecycle()
  }

  useLocalMediaStorage()
    .reconcileOrphans()
    .catch((err) => console.warn("Local media reconciliation failed:", err))
  await downloadEssentialResources().catch((err) => {
    console.error("Failed to finish loading resources:", err)
    loadingResources.value = false
  })

  // The advert is not shown for another 10s, and is then usually discarded for
  // new accounts or adverts already seen. Fetching it alongside the calls that
  // gate the loading screen spent a connection on a payload nobody reads yet,
  // so the request now happens only when the modal is about to open.
  setTimeout(async () => {
    if (!online.value || isNewlySignedUpUser()) return

    try {
      const advert = await fetchActiveAdvert()
      if (!advert || hasAdvertBeenShown(advert._id)) return

      showAdvertModal.value = true
      markAdvertAsShown(advert._id)
      usePosthogCapture("ADVERT_MODAL_OPENED")
    } catch (error) {
      console.warn("Unable to load the active advert:", error)
    }
  }, 10000)

  if (location.hostname !== "localhost") {
    useGtag()
  }
})
</script>

<style scoped></style>
