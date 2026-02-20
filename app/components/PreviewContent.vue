<template>
  <AppSection
    heading="Preview and Edit Content"
    :secondary-buttons="[
      {
        label: bulkActionLabel,
        action: 'select-slides',
        icon: bulkActionIcon,
        color: 'primary',
        confirmAction: false,
        visible: true,
      },
      {
        label: 'Delete Slides',
        action: 'delete-selected-slides',
        icon: 'i-tabler-trash',
        color: 'red',
        confirmAction: true,
        visible: bulkSelectedSlides.length > 0,
      },
    ]"
    slot-ctn-styles="flex flex-col justify-between h-[calc(100vh-182px)]"
    class="flex-[2]"
    @delete-selected-slides="deleteMultipleSlides(bulkSelectedSlides)"
  >
    <div
      class="slides-ctn overflow-y-scroll mb-4 rounded-md transition h-[50%]"
      :class="[
        slides?.length === 0 ? 'bg-primary-100 dark:bg-primary-900' : '',
      ]"
    >
      <div
        v-if="slides?.length > 0"
        ref="slidesGrid"
        class="grid slides-grid gap-3"
      >
        <SlideCard
          v-for="(slide, index) in slides"
          :key="slide.id"
          :slide="slide"
          :live="false"
          :selectable="bulkSelectSlides"
          :id="slide?.id?.replace(/\d+/g, '')"
          :checkbox-selected="bulkSelectedSlides.includes(slide?.id)"
          :editing-by="getSlideEditor(slide.id)"
          grid-type
          :selected="activeSlide?.id === slide?.id"
          @click="
            bulkSelectSlides
              ? null
              : makeSlideActive(slide, {
                  goLive: false,
                  newlyCreated: false,
                })
          "
          @duplicate="
            (slide) => {
              const newSlide = duplicateSlide(slide)
              slides.push(newSlide)
              makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
              uploadOfflineSlides()
            }
          "
          @delete="deleteSlide"
          @save-slide="saveSlide(slide)"
          @save-as-template="openSaveTemplateModal(slide)"
          @bulk-selected="addToSelectedSlides(slide?.id, $event)"
        />
      </div>
      <EmptyState
        v-else
        icon="i-tabler-device-desktop-plus"
        class="dark:text-white"
        sub="No slides yet"
        action="new-slide"
        action-text="Create new slide"
      />
    </div>
    <EditLiveContent
      :slide="activeSlide"
      @slide-update="onUpdateSlide"
      @inactive-slide-update="onUpdateInactiveSlide"
      @goto-verse="gotoAction"
      @update-bible-version="gotoAction(activeSlide?.title!!, $event)"
      @take-live="
        makeSlideActive(activeSlide!!, {
          goLive: true,
          newlyCreated: false,
        })
      "
    />

    <SaveAsTemplateModal
      v-model="showSaveTemplateModal"
      :slide="slideToSaveAsTemplate"
    />
  </AppSection>
</template>

<script setup lang="ts">
import { useDebounceFn, useThrottleFn, useOnline } from "@vueuse/core"
import { go } from "fuzzysort"
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type {
  Hymn,
  Scripture,
  Slide,
  Song,
  Countdown,
  Schedule,
  ExtendedFileT,
} from "~/types"
import { appWideActions } from "~/utils/constants"
import { tabSessionId } from "~/composables/useRealtimeSlides"

const appStore = useAppStore()
const authStore = useAuthStore()
const toast = useToast()
const churchId = authStore.user?.churchId

// Composables
const {
  slides,
  updateLiveOutput,
  batchCreateSlides,
  updateSlide: updateSlideAPI,
  deleteSlide: deleteSlideAPI,
  batchUpdateSlides,
} = useSlides()
const { getLibraryItem } = useLibrary()
const { createSchedule } = useSchedules()
const {
  createTextSlide,
  createBibleSlide,
  createHymnSlide,
  createSongSlide,
  createMediaSlide,
  createMultipleMediaSlides,
  createCountdownSlide,
  saveSlideToLib,
  duplicateSlide,
} = useSlideCreation()
const { gotoVerse } = useSlideNavigation()

// Online status for conditional API/WS calls
const online = useOnline()

/**
 * Send slide update via Socket.IO for realtime collaboration
 * Only sends when online. Includes tabId to allow same user on different tabs/devices to receive updates
 */
const broadcastSlideUpdate = (action: string, data: any) => {
  // Don't broadcast when offline
  if (!online.value) return

  const nuxtApp = useNuxtApp()
  const socket = nuxtApp.$socketio as any
  if (socket?.connected) {
    socket.emit(action, { ...data, tabId: tabSessionId })
  }
}

/**
 * Broadcast a single slide creation for immediate real-time feedback
 */
const broadcastSlideCreated = (slide: any) => {
  broadcastSlideUpdate("create-slide", slide)
}

/**
 * Get the name of the user currently editing a slide (if any)
 */
const getSlideEditor = (slideId: string): string | undefined => {
  const editInfo = appStore.currentState.slidesBeingEdited?.[slideId]
  if (editInfo && editInfo.userId !== authStore.user?._id) {
    return editInfo.userName
  }
  return undefined
}

// Countdown state - kept in component for tight coupling with slide updates
const activeCountdownInterval = ref<any>(null)
const countdownTimeLeft = ref<number>(0)
const countdownStartTime = ref<number>(0)
const countdownDuration = ref<number>(0)
const countdownRAF = ref<number>(0)

// Component state
const windowHeight = ref<number>(0)
const activeSlide = ref<Slide>()
const { currentState } = storeToRefs(appStore)
const slidesGrid = ref<HTMLDivElement | null>(null)
const bulkActionLabel = ref<string>("Select Slides")
const bulkActionIcon = ref<string>("")
const bulkSelectSlides = ref<boolean>(false)
const bulkSelectedSlides = ref<string[]>([])

// Save as Template Modal
const showSaveTemplateModal = ref(false)
const slideToSaveAsTemplate = ref<Slide | null>(null)

const makeSlideActive = (
  slide: Slide,
  options?: {
    goLive: boolean
    newlyCreated: boolean
  }
) => {
  activeSlide.value = slide
  if (options?.newlyCreated) {
    appStore.appendActiveSlide(slide)
  }
  if (options?.goLive) {
    updateLiveOutput(activeSlide.value, { forceGoLive: true })
  }
}

onMounted(() => {
  windowHeight.value = document.documentElement.offsetHeight
  addEventListener("resize", () => {
    windowHeight.value = document.documentElement.offsetHeight
  })
  uploadOfflineSlides()
})

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>
emitter.on("new-slide", () => {
  const newSlide = createTextSlide()
  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  uploadOfflineSlides()
})

emitter.on("new-text", (slide: Slide[]) => {
  let newSlide
  if (slide) {
    newSlide = duplicateSlide(slide?.[0] || slide)
  } else {
    newSlide = createTextSlide()
  }
  slides.value?.push(newSlide)
  makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
  // Broadcast slide creation immediately for real-time sync
  broadcastSlideCreated(newSlide)
  uploadOfflineSlides()
})

emitter.on("new-bible", async (data: string) => {
  if (data) {
    const scripture = await useScripture(data)
    if (scripture) {
      const newSlide = createBibleSlide(scripture)
      slides.value?.push(newSlide)
      makeSlideActive(newSlide, {
        goLive: true,
        newlyCreated: true,
      })
      appStore.setRecentBibleSearches(data)
      // Broadcast slide creation immediately for real-time sync
      broadcastSlideCreated(newSlide)
      uploadOfflineSlides()
    }
  }
})

emitter.on("update-or-create-bible", async (data: string) => {
  if (data) {
    // Find any existing Bible slide (prefer the live one)
    const existingBibleSlide =
      slides.value?.find(
        (s: Slide) =>
          s.type === slideTypes.bible &&
          s.id === currentState.value?.liveSlideId
      ) || slides.value?.find((s: Slide) => s.type === slideTypes.bible)

    const scripture = await useScripture(data)
    if (scripture) {
      if (existingBibleSlide) {
        // Update the existing Bible slide
        const updatedSlide = await gotoVerse(
          existingBibleSlide,
          scripture.label,
          scripture.version || "KJV"
        )
        if (updatedSlide) {
          const slideIndex = slides.value.findIndex(
            (s: Slide) => s.id === updatedSlide.id
          )
          slides.value.splice(slideIndex, 1, updatedSlide)
          makeSlideActive(updatedSlide, { goLive: true, newlyCreated: false })
          updateLiveOutput(updatedSlide)
          updateSlideOnline(updatedSlide)
        }
      } else {
        // No existing Bible slide - create a new one
        const newSlide = createBibleSlide(scripture)
        slides.value?.push(newSlide)
        makeSlideActive(newSlide, {
          goLive: true,
          newlyCreated: true,
        })
        // Broadcast slide creation immediately for real-time sync
        broadcastSlideCreated(newSlide)
        uploadOfflineSlides()
      }
      appStore.setRecentBibleSearches(data)
    }
  }
})

emitter.on("new-bible-whole-search", async (data: string) => {
  const scripture = await useScripture(data)
  if (scripture) {
    const newSlide = createBibleSlide(scripture, { fromWholeBibleSearch: true })
    slides.value?.push(newSlide)
    makeSlideActive(newSlide, {
      goLive: false,
      newlyCreated: true,
    })
    appStore.setRecentBibleSearches(data)
    // Broadcast slide creation immediately for real-time sync
    broadcastSlideCreated(newSlide)
    uploadOfflineSlides()
  }
})

emitter.on("new-hymn", async (data: string) => {
  const hymn = await useHymn(data)
  if (hymn) {
    const newSlide = createHymnSlide(hymn)
    slides.value?.push(newSlide)
    makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
    // Broadcast slide creation immediately for real-time sync
    broadcastSlideCreated(newSlide)
    uploadOfflineSlides()
  }
})

emitter.on("new-song", async (data: Song) => {
  if (data) {
    const song = await useSong(data)
    if (song) {
      const newSlide = createSongSlide(song)
      slides.value?.push(newSlide)
      makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
      // Save song to Library if it is added to schedule
      saveSlide(newSlide)
      // Broadcast slide creation immediately for real-time sync
      broadcastSlideCreated(newSlide)
      uploadOfflineSlides()
    }
  }
})

emitter.on("new-song-search", (query: string) => {
  // Do nothing
})

emitter.on("new-media", async (data: ExtendedFileT[]) => {
  if (data && data?.length > 0) {
    let newSlides

    if (data?.[0]?.fromTemplate) {
      newSlides = data
      newSlides.forEach((slide) => {
        delete slide._id
        slide.id = useObjectID()
      })
    } else if (data?.length > 0) {
      newSlides = await createMultipleMediaSlides(data)
    }

    // Update slides with new slides
    const updatedSlides = useMergeObjectArray(newSlides, [
      ...appStore.currentState.activeSlides,
    ])
    // Sort updated slides by createdAt
    updatedSlides.sort((a, b) => {
      if (!a.createdAt) return 1
      if (!b.createdAt) return -1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    appStore.setActiveSlides(updatedSlides)
    // Broadcast batch slide creation for real-time sync
    if (newSlides && newSlides.length > 0) {
      broadcastSlideUpdate("batch-create-slides", { slides: newSlides })
    }
    uploadOfflineSlides()
  }
})

emitter.on("new-active-slide", (data: Slide) => {
  if (data) {
    makeSlideActive(data, { goLive: false, newlyCreated: true })
  }
})

emitter.on("new-countdown", (data: Countdown) => {
  if (data) {
    // Remove existing countdown slides
    const tempSlides = slides.value?.filter(
      (slide) => slide.type !== slideTypes.countdown
    )
    slides.value = tempSlides
    stopCountdown()

    const newSlide = createCountdownSlide(data)
    slides.value?.push(newSlide)

    // Take slide live if current active slide is a countdown
    if (activeSlide.value?.type === slideTypes.countdown) {
      makeSlideActive(newSlide, { goLive: true, newlyCreated: true })
    } else {
      makeSlideActive(newSlide, { goLive: false, newlyCreated: true })
    }
    // Broadcast slide creation immediately for real-time sync
    broadcastSlideCreated(newSlide)
    uploadOfflineSlides()
  }
})

// This can start and temporarily pause a countdown
emitter.on("start-countdown", (data: Slide) => {
  startCountdown(data)
})

emitter.on("restart-countdown", (data: Slide) => {
  const countdown = data?.data as Countdown
  if (countdown?.time) {
    startCountdown(data, true)
  }
})

emitter.on("delete-slide", (data: Slide) => {
  deleteSlide(data?.id)
})

emitter.on("refresh-slides", () => {
  retrieveSlidesOnline(appStore.currentState.activeSchedule?._id!!)
})

emitter.on("upload-offline-slides", () => {
  uploadOfflineSlides()
})

emitter.on("batch-update-slides", (slides: Slide[]) => {
  appStore.setActiveSlides(slides)
  batchUpdateSlides(slides)
})

emitter.on("select-slides", () => {
  if (bulkActionLabel.value === "Select Slides") {
    bulkSelectSlides.value = !bulkSelectSlides.value
    bulkActionLabel.value = "Select All"
    bulkActionIcon.value = "i-bx-checkbox"
    toast.add({
      title: "Click button twice to cancel",
      icon: "i-bx-info-circle",
      color: "green",
    })
  } else if (bulkActionLabel.value === "Select All") {
    addAllSlidesToSelectedSlides()
    bulkActionLabel.value = "Cancel"
    bulkActionIcon.value = "i-mdi-close"
  } else if (bulkActionLabel.value === "Cancel") {
    removeAllSelectedSlides()
    bulkActionLabel.value = "Select Slides"
    bulkActionIcon.value = ""
    bulkSelectSlides.value = !bulkSelectSlides.value
  }
})

emitter.on("promote-active-slide-live", () => {
  if (activeSlide.value) {
    makeSlideActive(activeSlide.value!!, {
      goLive: true,
      newlyCreated: false,
    })
  }
})

// Utility functions for offline sync
const mergeSlides = (
  offlineSlides: Slide[],
  uploadedSlides: Slide[]
): Slide[] => {
  // Create a Map from uploadedSlides with id as the key
  const uploadedMap = new Map(
    uploadedSlides.map((slide) => [slide.id, slide._id])
  )
  // console.log("uploadedMap", uploadedMap)

  // Iterate over offlineSlides and merge special_id where ids match
  const tempOfflineSlides = [...offlineSlides]
  for (let offlineSlide of tempOfflineSlides) {
    if (uploadedMap.has(offlineSlide.id)) {
      offlineSlide._id = uploadedMap.get(offlineSlide.id)
    }
  }

  return tempOfflineSlides
}

const isArrayOfStrings = (arr: any[]) => {
  return arr.every((item) => typeof item === "string")
}

const uploadOfflineSlides = async () => {
  // Retrieve all offline slides (with a scheduleId)
  const offlineSlides = appStore.currentState.activeSlides
    .filter((slide) => slide._id === undefined)
    ?.filter((slide) => slide.scheduleId)
  if (offlineSlides.length > 0) {
    // Broadcast new slides via WebSocket for realtime collaboration
    broadcastSlideUpdate("batch-create-slides", { slides: offlineSlides })

    const uploadedSlides = await batchCreateSlides(offlineSlides)

    if (isArrayOfStrings(uploadedSlides)) {
      let slidesWithDuplicateErrors = [...uploadedSlides] as string[]
      const tempSlides = [...offlineSlides]
      const updatedTempSlides = []
      tempSlides.forEach((slide, index) => {
        if (slidesWithDuplicateErrors.includes(slide.id)) {
          tempSlides[index]._id = slide.id
          updatedTempSlides.push(tempSlides[index])
        }
      })

      const mergedSlides = mergeSlides([...offlineSlides], [
        ...uploadedSlides,
      ] as Slide[])
      appStore.appendActiveSlides(mergedSlides)
    }

    const mergedSlides = mergeSlides([...offlineSlides], [
      ...uploadedSlides,
    ] as Slide[])
    appStore.appendActiveSlides(mergedSlides)
  }
}

const retrieveSlidesOnline = async (scheduleId: string) => {
  // appStore.setSlidesLoading(true)
  const { data, error } = await useAPIFetch(
    `/church/${authStore.user?.churchId}/schedules/${scheduleId}/slides`
  )
  if (!error.value) {
    let tempSlides = data.value as Slide[]
    tempSlides.forEach((slide) => {
      if (
        slide.backgroundType === backgroundTypes.video &&
        (slide.backgroundVideoKey === "video-bg-1" ||
          slide.backgroundVideoKey === "/video-bg-1.mp4" ||
          slide.backgroundVideoKey === "video-bg-2" ||
          slide.backgroundVideoKey === "/video-bg-2.mp4" ||
          slide.backgroundVideoKey === "video-bg-3" ||
          slide.backgroundVideoKey === "/video-bg-3.mp4" ||
          slide.backgroundVideoKey === "video-bg-4" ||
          slide.backgroundVideoKey === "/video-bg-4.mp4" ||
          slide.backgroundVideoKey === "video-bg-5" ||
          slide.backgroundVideoKey === "/video-bg-5.mp4" ||
          slide.backgroundVideoKey === "video-bg-6" ||
          slide.backgroundVideoKey === "/video-bg-6.mp4")
      ) {
        slide.background = appStore.currentState.backgroundVideos?.find(
          (bg) => bg.id === slide.backgroundVideoKey
        )?.url
        // console.log(
        //   appStore.currentState.backgroundVideos?.find(
        //     (bg) => bg.id === slide.backgroundVideoKey
        //   )?.url
        // )
      } else if (
        slide.backgroundType === backgroundTypes.image &&
        slide.background?.includes("blob:")
      ) {
        const previousBackground = appStore.currentState.activeSlides.find(
          (s) => s.id === slide.id
        )?.background
        if (previousBackground) {
          slide.background = previousBackground
        }
      } else {
        // console.log("not found")
      }
    })
    // Sort slides by index
    tempSlides = [...tempSlides].sort((a, b) => a.index - b.index)

    appStore.setActiveSlides(
      useMergeObjectArray(tempSlides, [...appStore.currentState.activeSlides])
    )
    // appStore.setSlidesLoading(false)
    appStore.setLastSynced(new Date().toISOString())
  } else {
    throw new Error(error.value?.message)
  }
}

// Listen to see if active slide is in active schedule, and to scroll to newest slide if in active schedule
watch(
  () => ({
    length: slides.value?.length,
    activeId: activeSlide.value?.id,
  }),
  () => {
    nextTick(() => {
      const slideId = activeSlide.value?.id
      const newestSlide = slidesGrid.value?.querySelector(
        `#${slideId?.replace(/\d+/g, "")}`
      )
      newestSlide?.scrollIntoView({ behavior: "auto" })
    })
  }
)

// Update Slides order when they are updated in Slide schedule
watch(
  () => currentState.value.activeSlides,
  (newSlides) => {
    const scheduleId = appStore.currentState.activeSchedule?._id
    const tempSlides = newSlides?.filter(
      (slide) => slide.scheduleId === scheduleId
    )

    if (tempSlides.length > 0) {
      slides.value = tempSlides

      // Only update activeSlide if it exists in the filtered slides
      if (activeSlide.value?.id) {
        const updatedActiveSlide = tempSlides.find(
          (slide) => slide.id === activeSlide.value?.id
        )
        if (updatedActiveSlide) {
          activeSlide.value = updatedActiveSlide
          // sendNewSlideToWebsocket(updatedActiveSlide)
        }
      }
    }
  },
  { deep: true, immediate: true }
)

// Set slides to slides based on scheduler
watch(
  () => currentState.value.activeSchedule,
  (oldVal, newVal) => {
    if (oldVal?._id !== newVal?._id) {
      slides.value = currentState.value.activeSlides?.filter(
        (slide) =>
          slide.scheduleId === appStore.currentState.activeSchedule?._id
      )

      // Check if activeSchedule is remote object
      if (!currentState.value.activeSchedule?.updatedAt) {
        createSchedule(currentState.value.activeSchedule as Schedule)
      } else {
        // retrieve all slides online
        retrieveSlidesOnline(currentState.value.activeSchedule?._id)
      }
    }
  },
  { immediate: true }
)

const updateSlideOnline = useThrottleFn(
  async (slide: Slide) => {
    // Don't make API calls when offline
    if (!online.value) return

    const tempSlide: Slide | any = { ...slide }
    delete tempSlide._id

    // Remove already added slide properties when updating slide online
    delete tempSlide.id
    delete tempSlide.churchId
    delete tempSlide.type

    if (tempSlide.backgroundType !== backgroundTypes.video) {
      tempSlide.backgroundVideoKey = null
    }

    // If slide is a media (video) slide, do not update it
    if (
      slide?._id &&
      !(
        slide.type === slideTypes.media &&
        slide.backgroundType === backgroundTypes.video
      )
    ) {
      // Broadcast update via WebSocket for realtime collaboration
      broadcastSlideUpdate("update-slide", {
        ...slide,
        slideId: slide.id,
      })

      // UPDATE OVER HTTP for persistence
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${appStore.currentState.activeSchedule?._id}/slides/${slide?._id}`,
        {
          method: "PUT",
          body: tempSlide,
        }
      )
      if (!error.value) {
        appStore.setLastSynced(new Date().toISOString())
        return data.value
      } else {
        throw new Error(error.value?.message)
      }
    }
  },
  2000,
  true
)

const deleteSlide = async (slideId: string, addToast: boolean = true) => {
  const tempSlide = slides.value.find((s) => s.id === slideId) as Slide

  // Clear countdown animation if slide is a countdown slide before deleting
  if (tempSlide?.type === slideTypes.countdown) {
    stopCountdown()
  }

  const slideIndex = slides.value.findIndex((s) => s.id === slideId)
  slides.value.splice(slideIndex, 1)
  appStore.removeActiveSlide(tempSlide)

  // Broadcast deletion via WebSocket for realtime collaboration
  broadcastSlideUpdate("delete-slide", { slideId })

  // Delete slide online if it has an _id
  if (tempSlide?._id) {
    await deleteSlideAPI(tempSlide)
  }

  // Delete Probable Media files linked in DB (as long as they are not saved in Library)
  const db = useIndexedDB()
  const itemSaved = await getLibraryItem(slideId)
  if (!itemSaved) {
    await db.media
      .delete(slideId)
      .catch((err) => console.error("Failed to delete media:", err))
  }

  if (addToast) {
    toast.add({ title: `${tempSlide?.name} deleted`, icon: "i-tabler-trash" })
  }
  usePosthogCapture("DELETE_SLIDE")
}

const deleteMultipleSlides = (slideIds: Array<string>) => {
  // Broadcast batch deletion via WebSocket
  broadcastSlideUpdate("batch-delete-slides", { slideIds })

  slideIds.forEach((slideId) => {
    deleteSlide(slideId, false)
  })
  toast.add({ title: "Multiple slides deleted", icon: "i-tabler-trash" })
  bulkSelectedSlides.value = []
  bulkActionLabel.value = "Select Slides"
  bulkActionIcon.value = ""
  bulkSelectSlides.value = false
}

const onUpdateSlide = (slide: Slide) => {
  // Always pause countdown slide before updating it
  if (slide.type === slideTypes.countdown) {
    // pause the active countdown animation so edits don't conflict
    stopCountdown()
  }

  makeSlideActive(slide)
  const slideIndex = slides.value?.findIndex(
    (slideInner: Slide) => slide.id === slideInner.id
  )
  slides.value?.splice(slideIndex || 0, 1, slide)

  updateSlideOnline(slide)
  updateLiveOutput(slide)

  // When updating of countdown slide is done, resume timer
  if (slide.type === slideTypes.countdown) {
    startCountdown(slide)
  }
}

// This function updates specific slide that is not active
const onUpdateInactiveSlide = (slide: Slide) => {
  const slideIndex = slides.value?.findIndex(
    (slideInner: Slide) => slide.id === slideInner.id
  )
  slides.value?.splice(slideIndex || 0, 1, slide)

  // Every 3 seconds
  // const debouncedTextSlideUpdate = useDebounceFn(updateSlideOnline, 3000)
  updateSlideOnline(slide)
  updateLiveOutput(slide)
}

// Countdown management functions
const updateCountdownSlide = (
  slide: Slide,
  timeRemaining: number,
  isPlaying: boolean = true
) => {
  const tempSlide = { ...slide }
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  tempSlide.data = {
    ...tempSlide.data,
    timeLeft: useMilliToTimeString(timeRemaining),
  } as Countdown
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    isMediaPlaying: isPlaying,
  }
  tempSlide.contents = useSlideContent(tempSlide, tempSlide?.data!!)
  slides.value.splice(slideIndex, 1, tempSlide)
  updateLiveOutput(tempSlide)
}

const startCountdown = (slide: Slide, restartCountdown: boolean = false) => {
  const countdown = slide?.data as Countdown
  if (countdown?.time) {
    const duration = useTimeStringToMilli(
      restartCountdown
        ? (slide.data as Countdown)?.time
        : (slide.data as Countdown)?.timeLeft
    )

    if (activeCountdownInterval.value === null || restartCountdown) {
      // Stop any existing animation
      if (countdownRAF.value) {
        cancelAnimationFrame(countdownRAF.value)
      }

      // Reset or initialize countdown state
      if (restartCountdown) {
        countdownTimeLeft.value = duration
        countdownDuration.value = duration
      } else {
        countdownTimeLeft.value =
          countdownTimeLeft.value === 0 ? duration : countdownTimeLeft.value
        countdownDuration.value = duration
      }

      // Record start time
      countdownStartTime.value = performance.now()
      const startTimeLeft = countdownTimeLeft.value

      // Animation function
      const animate = (currentTime: number) => {
        const elapsed = currentTime - countdownStartTime.value
        const remaining = Math.max(0, startTimeLeft - elapsed)

        // Update only when we cross a second boundary to maintain the same visual update rate
        if (
          Math.floor(remaining / 1000) !==
          Math.floor(countdownTimeLeft.value / 1000)
        ) {
          countdownTimeLeft.value = remaining
          updateCountdownSlide(slide, remaining)
        }

        if (remaining > 0) {
          countdownRAF.value = requestAnimationFrame(animate)
          activeCountdownInterval.value = true
        } else {
          countdownTimeLeft.value = 0
          updateCountdownSlide(slide, 0, false)
          activeCountdownInterval.value = null
        }
      }

      // Start the animation
      countdownRAF.value = requestAnimationFrame(animate)
      activeCountdownInterval.value = true
    } else {
      // Pause the countdown
      cancelAnimationFrame(countdownRAF.value)
      activeCountdownInterval.value = null
      updateCountdownSlide(slide, countdownTimeLeft.value, false)
    }
  }
}

const stopCountdown = () => {
  if (countdownRAF.value) {
    cancelAnimationFrame(countdownRAF.value)
  }
  activeCountdownInterval.value = null
  countdownTimeLeft.value = 0
}

const gotoAction = async (title: string, version: string) => {
  if (!activeSlide.value) return

  const updatedSlide = await gotoVerse(activeSlide.value, title, version)
  if (updatedSlide) {
    const slideIndex = slides.value.findIndex((s) => s.id === updatedSlide.id)
    activeSlide.value = updatedSlide
    slides.value.splice(slideIndex, 1, updatedSlide)
    updateLiveOutput(activeSlide.value)
    updateSlideOnline(activeSlide.value)
  }
}

const saveSlide = async (item: Slide) => {
  await saveSlideToLib(item)
}

const openSaveTemplateModal = (slide: Slide) => {
  slideToSaveAsTemplate.value = slide
  showSaveTemplateModal.value = true
}

const addAllSlidesToSelectedSlides = () => {
  bulkSelectedSlides.value = currentState.value.activeSlides.map(
    (slide) => slide?.id
  )
}

const removeAllSelectedSlides = () => {
  bulkSelectedSlides.value = []
  usePosthogCapture("REMOVE_ALL_SELECTED_SLIDES_BTN_CLICKED")
}

const addToSelectedSlides = (slideId: string, isSelected: boolean) => {
  if (isSelected) {
    bulkSelectedSlides.value.push(slideId)
  } else {
    bulkSelectedSlides.value.splice(
      bulkSelectedSlides.value.findIndex((id) => id === slideId),
      1
    )
  }
}

const removeFromSelectedSlides = (slideId: string) => {
  bulkSelectedSlides.value.splice(
    bulkSelectedSlides.value.findIndex((id) => id === slideId),
    0
  )
}
</script>

<style scoped>
.slides-ctn {
  scroll-behavior: smooth;
}
/* .slides-ctn * {
  position: static;
} */
.slides-ctn-3-rows {
  height: 336px;
}

.slides-ctn-2-rows {
  height: 260px;
}
</style>
