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
          @duplicate="createNewSlide(slide)"
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
      @goto-chorus="gotoChorus"
      @update-bible-version="gotoScripture(activeSlide?.title!!, $event)"
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
import { useDebounceFn, useThrottleFn } from "@vueuse/core"
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
const appStore = useAppStore()
const authStore = useAuthStore()
const { slides, updateLiveOutput, saveSlideOnline } = useSlides()
const churchId = authStore.user?.churchId
const toast = useToast()

const windowHeight = ref<number>(0)
const activeSlide = ref<Slide>()
const { currentState } = storeToRefs(appStore)
const slidesGrid = ref<HTMLDivElement | null>(null)
const bulkActionLabel = ref<string>("Select Slides")
const bulkActionIcon = ref<string>("")
const bulkSelectSlides = ref<boolean>(false)
const bulkSelectedSlides = ref<string[]>([])
const activeCountdownInterval = ref<any>(null)
const countdownTimeLeft = ref<number>(0)
const countdownStartTime = ref<number>(0)
const countdownDuration = ref<number>(0)
const countdownRAF = ref<number>(0)

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
  createNewSlide()
})

emitter.on("new-text", (slide: Slide[]) => {
  createNewSlide(slide?.[0] || slide)
})

emitter.on("new-bible", async (data: string) => {
  if (data) {
    const scripture = await useScripture(data)
    if (scripture) {
      createNewBibleSlide(scripture)
      appStore.setRecentBibleSearches(data)
    }
  }
})

emitter.on("new-bible-whole-search", async (data: string) => {
  const scripture = await useScripture(data)
  if (scripture) {
    createNewBibleSlide(scripture, { fromWholeBibleSearch: true })
    appStore.setRecentBibleSearches(data)
  }
})

emitter.on("new-hymn", async (data: string) => {
  const hymn = await useHymn(data)
  if (hymn) {
    createNewHymnSlide(hymn)
  }
})

emitter.on("new-song", async (data: Song) => {
  if (data) {
    const song = await useSong(data)
    if (song) {
      createNewSongSlide(song)
    }
  }
})

emitter.on("new-song-search", (query: string) => {
  // Do nothing
})

emitter.on("new-media", async (data: ExtendedFileT[]) => {
  if (data) {
    // console.log("media-data", data)
    if (data?.length > 0) {
      await createMultipleNewMediaSlides(data)
    }
  }
})

emitter.on("new-active-slide", (data: Slide) => {
  if (data) {
    makeSlideActive(data, { goLive: false, newlyCreated: true })
  }
})

emitter.on("new-countdown", (data: Countdown) => {
  if (data) {
    createNewCountdownSlide(data)
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
  batchUpdateSlideOnline(slides)
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

// const sendNewSlideToWebsocket = useDebounceFn((slide: Slide) => {
//   // console.log("activeSlide", slide)
//   const socket = useNuxtApp().$socket as WebSocket
//   socket.send(
//     JSON.stringify({
//       action: "new-slide",
//       data: slide,
//     })
//   )
// }, 500)

const preSlideCreation = (): Slide => {
  const tempSlide: Slide = {
    id: useObjectID(),
    index: appStore.currentState.activeSlides.length,
    name: "Untitled",
    type: slideTypes.text,
    layout: slideLayoutTypes.full_text,
    contents: [],
    userId: authStore.user?._id as string,
    churchId: authStore?.user?.churchId as string,
    ...(appStore.currentState.settings.defaultBackground?.default && {
      backgroundType:
        appStore.currentState.settings.defaultBackground.default
          ?.backgroundType,
      background:
        appStore.currentState.settings.defaultBackground.default?.background,
      backgroundVideoKey:
        appStore.currentState.settings.defaultBackground.default
          ?.backgroundVideoKey,
    }),
    scheduleId: appStore.currentState.activeSchedule?._id as string,
    slideStyle: {
      alignment: appStore.currentState.settings.slideStyles.alignment,
      fontSizePercent:
        appStore.currentState.settings.slideStyles.fontSizePercent,
      font: appStore.currentState.settings.defaultFont,
      isMediaMuted: true,
      isMediaPlaying: false,
      // Added comment here to indicate new feat
      lettercase: appStore.currentState.settings.slideStyles.lettercase,
      lineSpacing: appStore.currentState.settings.slideStyles.lineSpacing,
      textOutlined: appStore.currentState.settings.slideStyles.textOutlined,
    },
  }
  return tempSlide
}

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
    const uploadedSlides = await batchCreateSlideOnline(offlineSlides)

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
      // console.log("merged slides", mergedSlides)
      appStore.appendActiveSlides(mergedSlides)
    }

    const mergedSlides = mergeSlides([...offlineSlides], [
      ...uploadedSlides,
    ] as Slide[])
    // console.log("merged slides", mergedSlides)
    appStore.appendActiveSlides(mergedSlides)
    // return uploadedSlides
  }
}

const createScheduleOnline = async (schedule: Schedule) => {
  // console.log("createScheduleOnline", schedule)
  // appStore.setSlidesLoading(true)
  const { data, error } = await useAPIFetch(`/church/${churchId}/schedules`, {
    method: "POST",
    body: schedule,
  })
  if (!error.value) {
    const tempSchedule = data.value as Schedule
    appStore.setActiveSchedule(tempSchedule)
    // appStore.setSlidesLoading(false)
    appStore.setLastSynced(new Date().toISOString())
    return tempSchedule
  } else {
    throw new Error(error.value?.message)
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
        createScheduleOnline(currentState.value.activeSchedule as Schedule)
      } else {
        // retrieve all slides online
        retrieveSlidesOnline(currentState.value.activeSchedule?._id)
      }
    }
  },
  { immediate: true }
)

const batchCreateSlideOnline = async (
  slides: Slide[]
): Promise<Slide[] | string[]> => {
  // Find song slides and update
  const tempSlides = [...slides]
  tempSlides.forEach((slide) => {
    slide.userId = authStore.user?._id!!
    slide.churchId = churchId!!
    if (slide.type === slideTypes.song) {
      // console.log("song-data", slide?.data)
      slide.songId = (slide.data as Song)?._id || (slide.data as Song)?.id
      // delete slide.data
      // console.log("new-slide", slide)
    }
  })

  // appStore.setSlidesLoading(true)

  const { data, error } = await useAPIFetch(
    `/church/${churchId}/schedules/${appStore.currentState.activeSchedule?._id}/slides/batch`,
    {
      method: "POST",
      body: tempSlides,
      key: "batch-create-slides",
      dedupe: "defer",
    }
  )
  if (!error.value) {
    // appStore.setSlidesLoading(false)
    appStore.setLastSynced(new Date().toISOString())
    return data.value as Slide[]
  } else {
    if (error.value?.data?.data) {
      return error.value?.data?.data
    }
    throw new Error(error.value?.message)
  }
}

const batchUpdateSlideOnline = async (slides: Slide[]) => {
  // appStore.setSlidesLoading(true)
  const { data, error } = await useAPIFetch(
    `/church/${churchId}/schedules/${appStore.currentState.activeSchedule?._id}/slides/batch`,
    {
      method: "PUT",
      body: slides,
      key: "batch-update-slides",
      dedupe: "defer",
    }
  )
  if (!error.value) {
    // appStore.setSlidesLoading(false)
    appStore.setLastSynced(new Date().toISOString())
    return data.value as Slide[]
  } else {
    throw new Error(error.value?.message)
  }
}

const updateSlideOnline = useThrottleFn(
  async (slide: Slide) => {
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
      // UPDATE OVER WEBSOCKET
      const socket = useNuxtApp().$socket as WebSocket
      socket.send(
        JSON.stringify({
          action: "update-slide",
          data: slide,
        })
      )

      // UPDATE OVER HTTP
      // TODO: Take out http update in future when WS is stable and can store in DB
      // appStore.setSlidesLoading(true)
      const { data, error } = await useAPIFetch(
        `/church/${churchId}/schedules/${appStore.currentState.activeSchedule?._id}/slides/${slide?._id}`,
        {
          method: "PUT",
          body: tempSlide,
        }
      )
      if (!error.value) {
        // appStore.setSlidesLoading(false)
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

const deleteSlideOnline = async (slide: Slide) => {
  if (slide?._id) {
    // appStore.setSlidesLoading(true)
    const { data, error } = await useAPIFetch(
      `/church/${churchId}/schedules/${appStore.currentState.activeSchedule?._id}/slides/${slide?._id}`,
      {
        method: "DELETE",
      }
    )
    if (!error.value) {
      // appStore.setSlidesLoading(false)
      appStore.setLastSynced(new Date().toISOString())
      return data.value
    } else {
      throw new Error(error.value?.message)
    }
  }
}

const createNewSlide = (duplicateSlide?: Slide) => {
  let tempSlide = { ...preSlideCreation() }
  if (duplicateSlide) {
    tempSlide = { ...duplicateSlide }
    delete tempSlide._id
  } else {
    tempSlide.slideStyle = { ...tempSlide.slideStyle, alignment: "left" }
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.default?.background
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default
        ?.backgroundType ||
      appStore.currentState.settings.defaultBackground.text.backgroundType
  }
  tempSlide.id = useObjectID()

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide, { goLive: false, newlyCreated: true })
  toast.add({
    title: `${tempSlide?.name} created`,
    icon: "i-bx-slideshow",
  })
  usePosthogCapture("NEW_TEXT_SLIDE_CREATED")
  uploadOfflineSlides()
}

const deleteSlide = async (slideId: string, addToast: boolean = true) => {
  const tempSlide = slides.value.find((s) => s.id === slideId) as Slide

  // Clear countdown animation if slide is a countdown slide before deleting
  if (tempSlide?.type === slideTypes.countdown) {
    if (countdownRAF.value) {
      cancelAnimationFrame(countdownRAF.value)
    }
    activeCountdownInterval.value = null
    countdownTimeLeft.value = 0
  }

  const slideIndex = slides.value.findIndex((s) => s.id === slideId)
  slides.value.splice(slideIndex, 1)
  appStore.removeActiveSlide(tempSlide)
  deleteSlideOnline(tempSlide)

  // Delete Probable Media files linked in DB (as long as they are not saved in Library)
  const db = useIndexedDB()
  const itemSaved = await db.library.get(slideId)
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
  // console.log("updated", slide)
  // Always pause countdown slide before updating it
  if (slide.type === slideTypes.countdown) {
    useGlobalEmit(appWideActions.startCountdown, slide)
  }
  makeSlideActive(slide)
  const slideIndex = slides.value?.findIndex(
    (slideInner: Slide) => slide.id === slideInner.id
  )
  slides.value?.splice(slideIndex || 0, 1, slide)

  // Every 3 seconds
  // const debouncedTextSlideUpdate = useDebounceFn(updateSlideOnline, 3000)
  updateSlideOnline(slide)

  updateLiveOutput(slide)

  // when updating of countdown slide is done, continue timer
  if (slide.type === slideTypes.countdown) {
    useGlobalEmit(appWideActions.startCountdown, slide)
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

const createNewBibleSlide = (
  scripture: Scripture,
  options?: { fromWholeBibleSearch: boolean }
) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.bible
  tempSlide.background =
    appStore.currentState.settings.defaultBackground.default?.background ||
    appStore.currentState.settings.defaultBackground.bible.background
  tempSlide.backgroundVideoKey =
    appStore.currentState.settings.defaultBackground.default
      ?.backgroundVideoKey ||
    appStore.currentState.settings.defaultBackground.bible.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.currentState.settings.defaultBackground.default?.backgroundType ||
    appStore.currentState.settings.defaultBackground.bible.backgroundType
  tempSlide.title = scripture?.label
  tempSlide.name = useSlideName(tempSlide)

  // Calculate font-size of scripture content
  let fontSize = useScreenFontSize(scripture?.content as string)
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
    font: appStore.currentState.settings.defaultFont,
  }
  tempSlide.contents = useSlideContent(tempSlide, scripture)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide, {
    goLive: !options?.fromWholeBibleSearch,
    newlyCreated: true,
  })
  toast.add({ title: "Bible slide created", icon: "i-bx-bible" })
  usePosthogCapture("NEW_BIBLE_SLIDE_CREATED")
  uploadOfflineSlides()
}

const createNewHymnSlide = (hymn: Hymn) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.hymn
  tempSlide.background =
    appStore.currentState.settings.defaultBackground.default?.background ||
    appStore.currentState.settings.defaultBackground.hymn.background
  tempSlide.backgroundVideoKey =
    appStore.currentState.settings.defaultBackground.default
      ?.backgroundVideoKey ||
    appStore.currentState.settings.defaultBackground.hymn.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.currentState.settings.defaultBackground.default?.backgroundType ||
    appStore.currentState.settings.defaultBackground.hymn.backgroundType
  tempSlide.songId = hymn.number
  tempSlide.hasChorus = hymn.chorus === "false" ? false : !!hymn.chorus
  tempSlide.title = "Verse 1"
  tempSlide.name = useSlideName(tempSlide)

  const currentHymnVerse = hymn.verses?.[0].trim()

  // Calculate font-size of scripture content
  let fontSize = useScreenFontSize(currentHymnVerse)
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
    font: appStore.currentState.settings.defaultFont,
  }
  tempSlide.contents = useSlideContent(tempSlide, hymn, currentHymnVerse)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide, { goLive: false, newlyCreated: true })
  toast.add({ title: "Hymn slide created", icon: "i-bx-church" })
  usePosthogCapture("NEW_HYMN_SLIDE_CREATED")
  uploadOfflineSlides()
}

const createNewSongSlide = (song: Song) => {
  // console.log("song", song)
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.song
  tempSlide.background =
    appStore.currentState.settings.defaultBackground.default?.background ||
    appStore.currentState.settings.defaultBackground.hymn.background
  tempSlide.backgroundVideoKey =
    appStore.currentState.settings.defaultBackground.default
      ?.backgroundVideoKey ||
    appStore.currentState.settings.defaultBackground.hymn.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.currentState.settings.defaultBackground.default?.backgroundType ||
    appStore.currentState.settings.defaultBackground.hymn.backgroundType
  tempSlide.songId = song._id || song.id
  tempSlide.title = "Verse 1"

  const currentSongVerse = song.verses?.[0].trim()

  // Calculate font-size of scripture content
  let fontSize = useScreenFontSize(currentSongVerse as string)
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
    font: appStore.currentState.settings.defaultFont,
  }
  tempSlide.data = song
  tempSlide.contents = useSlideContent(tempSlide, song, currentSongVerse)
  tempSlide.name = useSlideName(tempSlide)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide, { goLive: false, newlyCreated: true })
  // console.log("called")
  toast.add({ title: "Song slide created", icon: "i-bx-music" })

  // Save song to Library if it is added to schedule.
  saveSlide(tempSlide)

  usePosthogCapture("NEW_SONG_SLIDE_CREATED")
  uploadOfflineSlides()
}

const createNewMediaSlide = async (
  file: ExtendedFileT & { isExternal?: boolean },
  options?: { oneOfManySlides: boolean }
) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.empty
  let data = null
  const blob = { ...file.blob }

  const randomImage =
    "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=1740"
  tempSlide.type = slideTypes.media
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    backgroundFillType: backgroundFillTypes.crop,
  }

  // Handle external videos (YouTube/Vimeo)
  if (file.isExternal) {
    const externalVideo: any = {
      url: file.url,
      type: file.type, // 'youtube' or 'vimeo'
      thumbnail: file.thumbnail,
      name: file.name,
    }
    tempSlide.backgroundType = "video"
    tempSlide.background = randomImage // Placeholder image
    tempSlide.backgroundVideoKey = null
    tempSlide.data = externalVideo
    tempSlide.name = file.name || `${file.type} Video`

    // Store external video data in IndexedDB
    await useIndexedDB()
      .media.add({
        id: tempSlide.id,
        content: { type: file.type },
        data: externalVideo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .catch((err) => console.error("Failed to add external video slide:", err))
  } else {
    // Handle regular files
    tempSlide.backgroundType = file.type === "audio" ? "image" : file.type
    tempSlide.background = file.type === "audio" ? randomImage : file.url
    tempSlide.backgroundVideoKey = file.type?.includes("video")
      ? appStore.currentState.settings.defaultBackground.default
          ?.backgroundVideoKey
      : null
    tempSlide.data = file
    tempSlide.name = useSlideName(tempSlide)

    // Read Blob as array buffer
    const fileReader = new FileReader()
    if (file.blob) {
      fileReader.readAsArrayBuffer(file.blob)
      fileReader.addEventListener("loadend", async (event) => {
        data = fileReader.result
        // Store Blob in DB for easy retrieval on reload
        await useIndexedDB()
          .media.add({
            id: tempSlide.id,
            content: { size: file?.blob?.size, type: file?.blob?.type },
            data: data as ArrayBuffer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .catch((err) => console.error("Failed to add media slide:", err))
        delete file.blob
      })
    }
  }

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide, { goLive: false, newlyCreated: true })
  if (!options?.oneOfManySlides) {
    toast.add({ title: "Media slide created", icon: "i-bx-image" })
    // uploadOfflineSlides()
  }
  usePosthogCapture("NEW_MEDIA_SLIDE_CREATED", {
    file_type: tempSlide?.data?.type || file.type,
  })
  return { ...tempSlide, blob }
}

const createMultipleNewMediaSlides = async (files: ExtendedFileT[]) => {
  useGlobalEmit(appWideActions.appLoading, true)
  const multipleSlidesPromise: Promise<any>[] = []
  files?.forEach((file) => {
    multipleSlidesPromise.push(
      createNewMediaSlide(file, { oneOfManySlides: true })
    )
  })

  useGlobalEmit(appWideActions.appLoading, false)
  toast.add({ title: "Media slides created", icon: "i-bx-image" })

  // Network call to create multiple slides
  let newSlides = await Promise.all(multipleSlidesPromise)

  // Upload image files as backgrounds
  newSlides = newSlides.filter((slide) => slide.backgroundType === "image")

  const uploadedImages = files.map((file: ExtendedFileT) =>
    file?.blob?.type.includes("image") ? useUploadImage(file?.blob) : null
  )
  const uploadedImagesResp = await Promise.all(uploadedImages)
  // console.log("files", files)
  // console.log("uploadedImages", uploadedImagesResp)
  newSlides.forEach((slide, index) => {
    const imageObject = uploadedImagesResp[index]
    // console.log("imageObject", imageObject)
    slide.background = imageObject?.file?.url || slide.background
  })

  // update [slides] with new slides
  const updatedSlides = useMergeObjectArray(newSlides, [
    ...appStore.currentState.activeSlides,
  ])
  // sort updated slides by createdAt
  updatedSlides.sort((a, b) => {
    if (!a.createdAt) return 1
    if (!b.createdAt) return -1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
  // console.log("updatedSlides", updatedSlides)
  appStore.setActiveSlides(updatedSlides)

  // uploadImageFileAsBackground(file.blob, tempSlide.id)
  uploadOfflineSlides()
}

const removeExistingCountdownSlides = () => {
  const tempSlides = slides.value?.filter(
    (slide) => slide.type !== slideTypes.countdown
  )
  slides.value = tempSlides
}

/**
 * This function updates any countdown slide that has been previously created rather than creating a new one
 * @param countdown
 */
const createNewCountdownSlide = (countdown: Countdown) => {
  // console.log(activeSlide.value)
  // Only one countdown slide can be active, clear any active interval
  removeExistingCountdownSlides()
  clearInterval(activeCountdownInterval.value)
  countdownTimeLeft.value = 0

  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.countdown
  tempSlide.type = slideTypes.countdown
  tempSlide.background =
    appStore.currentState.settings.defaultBackground.hymn.background
  tempSlide.backgroundVideoKey =
    appStore.currentState.settings.defaultBackground.hymn.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.currentState.settings.defaultBackground.hymn.backgroundType
  ;(tempSlide.data = countdown),
    (tempSlide.name = `${countdown.time?.replace("00:", "")}`)
  tempSlide.contents = useSlideContent(tempSlide, countdown)

  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: 17.5,
    alignment: "center",
    font: appStore.currentState.settings.defaultFont,
  }

  slides.value?.push(tempSlide)

  // Take slide live if current active slide is a countdown
  if (activeSlide.value?.type === slideTypes.countdown) {
    makeSlideActive(tempSlide, { goLive: true, newlyCreated: true })
  } else {
    makeSlideActive(tempSlide, { goLive: false, newlyCreated: true })
  }
  toast.add({ title: "Countdown slide created", icon: "i-bx-time" })
  usePosthogCapture("NEW_COUNTDOWN_SLIDE_CREATED")
  uploadOfflineSlides()
}

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
  // console.log("tempSlide", tempSlide.data)
  tempSlide.contents = useSlideContent(tempSlide, tempSlide?.data!!)
  // activeSlide.value = tempSlide
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

const gotoAction = (title: string, version: string) => {
  useGlobalEmit(appWideActions.gotoVerse, title)
  title = title
    .replaceAll("  ", " ")
    .replaceAll(" :", ":")
    .replaceAll(": ", ":")
    .replaceAll(" : ", ":")
  // console.log(title)
  switch (activeSlide.value?.type) {
    case slideTypes.bible:
      return gotoScripture(title, version)
    case slideTypes.hymn:
      return gotoHymnVerse(title)
    case slideTypes.song:
      return gotoSongVerse(title)
  }
}

const gotoScripture = async (title: string, version: string) => {
  // Check whether title format uses colon or not as delimiter, and replace if not
  const regex = /\b\d+\s*:\s*\d+\b|\b\d+\s\d+\b/g
  const match = title.match(regex)?.[0]?.replaceAll(" ", ":")
  if (match) {
    title = title.replace(regex, match)
  }
  // Check that [title] is not abbreviated or in short form
  // If it is, replace to long/unabbreviated form
  let bibleBook = title.substring(0, title?.lastIndexOf(" "))
  if (!bibleBooks.includes(bibleBook)) {
    bibleBook =
      bibleBooks.find((book) =>
        book.toLowerCase().startsWith(bibleBook.toLowerCase())
      ) || ""
    title = `${bibleBook} ${title.substring(title?.lastIndexOf(" ")).trim()}`
    // console.log(title)
  }
  const tempSlide = { ...activeSlide.value } as Slide
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  const scriptureSplitted = useScriptureLabel(title || "1:1:1")?.split(":")

  // added || 1 to make sure that if no verse is specified, it defaults to first chapter or first verse
  const scriptureLabel = `${title?.slice(0, title.lastIndexOf(" "))} ${
    scriptureSplitted?.[1] || 1
  }:${scriptureSplitted?.[2] || 1}`
  const scriptureShortLabel = `${scriptureSplitted?.[0]}:${
    scriptureSplitted?.[1] || 1
  }:${scriptureSplitted?.[2] || 1}`

  const scripture = await useScripture(scriptureShortLabel, version)
  appStore.setRecentBibleSearches(scriptureShortLabel)
  if (scripture) {
    // Calculate font-size of scripture content
    tempSlide.title = scriptureLabel
    tempSlide.data = scripture
    let fontSize = useScreenFontSize(scripture?.content as string)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
    }

    tempSlide.contents = useSlideContent(tempSlide, scripture)
    tempSlide.name = useSlideName(tempSlide)
    activeSlide.value = tempSlide
    slides.value.splice(slideIndex, 1, tempSlide)

    updateLiveOutput(activeSlide.value)

    // Every 10 seconds
    // const debouncedSlideUpdate = useDebounceFn(updateSlideOnline, 10000)
    usePosthogCapture("GOTO_SCRIPTURE_TOOLBAR_USED")
    updateSlideOnline(activeSlide.value)
  }
}

const gotoHymnVerse = async (title: string) => {
  const tempSlide = { ...activeSlide.value } as Slide
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  const hymn = await useHymn(tempSlide.songId as string)
  const realTitle = title

  if (hymn) {
    const verseIndex = Number(realTitle?.split(" ")?.[1]) - 1
    const nextVerse = hymn?.verses?.[verseIndex]?.trim()

    if (nextVerse) {
      tempSlide.title = realTitle
      // Calculate font-size of content
      let fontSize = useScreenFontSize(nextVerse)
      tempSlide.slideStyle = {
        ...tempSlide.slideStyle,
        fontSize: Number(fontSize),
      }
      tempSlide.contents = useSlideContent(tempSlide, hymn, nextVerse)
      activeSlide.value = tempSlide
      slides.value.splice(slideIndex, 1, tempSlide)

      // Every 10 seconds
      // const debouncedSlideUpdate = useDebounceFn(updateSlideOnline, 10000)
      updateSlideOnline(activeSlide.value)
      updateLiveOutput(activeSlide.value)
    }
    usePosthogCapture("GOTO_HYMN_TOOLBAR_USED")
  }
}

const gotoSongVerse = async (title: string) => {
  const tempSlide = { ...activeSlide.value } as Slide
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  // console.log("slide", activeSlide.value)
  const song = await useSong(
    (activeSlide.value?.data as Song) || activeSlide?.value?.songId
  )
  const realTitle = title // fake title is the one with the 0th index, but that is what is displayed in UI

  if (song) {
    const verseIndex = Number(realTitle?.split(" ")?.[1]) - 1
    const nextVerse = song?.verses?.[verseIndex]?.trim()

    if (nextVerse) {
      tempSlide.title = title
      // Calculate font-size of content
      let fontSize = useScreenFontSize(nextVerse)
      tempSlide.slideStyle = {
        ...tempSlide.slideStyle,
        fontSize: Number(fontSize),
      }
      tempSlide.data = song
      tempSlide.contents = useSlideContent(tempSlide, song, nextVerse)
      activeSlide.value = tempSlide
      slides.value.splice(slideIndex, 1, tempSlide)

      // Every 10 seconds
      // const debouncedSlideUpdate = useDebounceFn(updateSlideOnline, 10000)
      updateSlideOnline(activeSlide.value)
      updateLiveOutput(activeSlide.value)
    }
    usePosthogCapture("GOTO_SONG_TOOLBAR_USED")
  }
}

const gotoChorus = async () => {
  const tempSlide = { ...activeSlide.value } as Slide
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  const hymn = await useHymn(tempSlide.songId as string)

  if (hymn) {
    const chorus = hymn?.chorus as string
    // Calculate font-size of scripture content
    let fontSize = useScreenFontSize(chorus)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
    }

    tempSlide.contents = useSlideContent(tempSlide, hymn, chorus)
    activeSlide.value = tempSlide
    slides.value.splice(slideIndex, 1, tempSlide)
    updateLiveOutput(activeSlide.value)
  }
  usePosthogCapture("GOTO_CHORUS_TOOLBAR_USED")
}

const saveSlide = async (item: Slide) => {
  const db = useIndexedDB()
  const tempItem = { ...item }
  let tempSong = { ...tempItem?.data } as Song

  // If slide is a hymn slide, convert it to a song
  if (tempItem.type === slideTypes.hymn) {
    const hymn = (await useHymn(tempItem.songId as string)) as Hymn
    const verses = [...hymn?.verses]
    if (hymn?.chorus !== "false") {
      verses.splice(1, 0, hymn?.chorus)
    }
    const lyrics = verses.join("\n")
    verses.push(verses[0])
    tempSong = {
      id: useID(),
      title: hymn?.title || "",
      artist: hymn?.author || "",
      lyrics: lyrics || "",
      createdBy: "me",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  tempItem.slideStyle = { ...tempItem?.slideStyle }
  tempItem.contents = [...tempItem?.contents]
  tempItem.data = { ...tempItem.data } as any
  try {
    if (tempItem.type === slideTypes.song) {
      tempSong.verses = [...tempSong?.verses!!] as []
      await db.library
        .add(
          {
            id: tempSong.id,
            type: "song",
            content: tempSong,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          tempSong.id
        )
        .catch((err) => console.error("Failed to add song to library:", err))
      toast.add({ icon: "i-bx-save", title: "Song saved to Library" })
    } else if (tempItem.type === slideTypes.hymn) {
      await db.library
        .add(
          {
            id: tempSong.id,
            type: "song",
            content: tempSong,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          tempSong.id
        )
        .catch((err) => console.error("Failed to add hymn to library:", err))
      toast.add({ icon: "i-bx-save", title: "Song saved to Library" })
    } else {
      delete (tempItem?.data as ExtendedFileT)?.blob
      // delete tempItem.blob - Removed because I couldn't find a place where it was assigned, TODO: Check if it is needed
      await db.library
        .add(
          {
            id: tempItem.id,
            type: "slide",
            content: { ...tempItem },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          tempItem.id
        )
        .catch((err) => console.error("Failed to add slide to library:", err))
      saveSlideOnline(tempItem)
      toast.add({ icon: "i-bx-save", title: "Slide saved to Library" })
    }
  } catch (err: any) {
    if (err.name === "ConstraintError") {
      if (tempItem.type === slideTypes.song) {
        await db.library
          .update(tempSong.id, {
            id: tempSong.id,
            type: "song",
            content: tempSong,
            createdAt: tempItem?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .catch((err) => console.error("Failed to update song:", err))
        toast.add({ icon: "i-bx-save", title: "Updated song saved to Library" })
      } else {
        delete (tempItem?.data as ExtendedFileT)?.blob
        await db.library
          .update(tempItem.id, {
            id: tempItem.id,
            type: "slide",
            content: tempItem,
            createdAt: tempItem?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .catch((err) => console.error("Failed to update slide:", err))
        toast.add({
          icon: "i-bx-save",
          title: "Updated slide saved to Library",
        })
      }
    } else if (err.name === "DataCloneError") {
      // toast.add({ icon: 'i-bx-save', title: 'Item added to Library' })
    } else {
      console.log(err)
    }
  }
  usePosthogCapture("LIBRARY_SAVE_SLIDE")
}

// Save as Template Modal
const showSaveTemplateModal = ref(false)
const slideToSaveAsTemplate = ref<Slide | null>(null)

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
