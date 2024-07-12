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
          @click="bulkSelectSlides ? null : makeSlideActive(slide)"
          @duplicate="createNewSlide(slide)"
          @delete="deleteSlide"
          @save-slide="saveSlide(slide)"
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
      @goto-verse="gotoAction"
      @goto-chorus="gotoChorus"
      @update-bible-version="gotoScripture(activeSlide?.title!!, $event)"
      @take-live="makeSlideActive(activeSlide!!, true)"
    />
  </AppSection>
</template>

<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core"
import type { Emitter } from "mitt"
import { merge } from "rxjs"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Hymn, Scripture, Slide, Song, Countdown, Schedule } from "~/types"
const appStore = useAppStore()
const authStore = useAuthStore()
const churchId = authStore.user?.churchId
const toast = useToast()

const windowHeight = ref<number>(0)
const slides = ref<Array<Slide>>(appStore.activeSlides || [])
const activeSlide = ref<Slide>()
const { activeSlides, activeSchedule } = storeToRefs(appStore)
const slidesGrid = ref<HTMLDivElement | null>(null)
const bulkActionLabel = ref<string>("Select Slides")
const bulkActionIcon = ref<string>("")
const bulkSelectSlides = ref<boolean>(false)
const bulkSelectedSlides = ref<string[]>([])
const activeCountdownInterval = ref<any>(null)
const countdownTimeLeft = ref<number>(0)

watch(
  slides,
  (newVal, oldVal) => {
    setTimeout(() => {
      // Scroll down to newest slide on slide create
      const slideId = activeSlide.value?.id
      const newestSlide = slidesGrid.value?.querySelector(
        `#${slideId?.replace(/\d+/g, "")}`
      )
      newestSlide?.scrollIntoView()
    }, 100)
  },
  { deep: true, immediate: true }
)

// Update Slides order when they are updated in live content
watch(activeSlides, () => {
  const tempSlides = activeSlides.value?.filter(
    (slide) => slide.scheduleId === appStore.activeSchedule?._id
  )
  if (tempSlides.length > 0) {
    slides.value = tempSlides
  }
  if (tempSlides?.find((slide) => slide.id === activeSlide.value?.id)) {
    activeSlide.value = tempSlides?.find(
      (slide) => slide.id === activeSlide.value?.id
    )
  }
})

const makeSlideActive = (slide: Slide, goLive: boolean = false) => {
  // console.log(goLive, slide)
  activeSlide.value = slide
  appStore.appendActiveSlide(slide)
  if (goLive) {
    appStore.setLiveSlide(activeSlide.value.id)
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

emitter.on("new-media", (data: any) => {
  if (data) {
    // console.log("media-data", data)
    if (data?.length > 0) {
      createMultipleNewMediaSlides(data)
    }
  }
})

emitter.on("new-active-slide", (data: Slide) => {
  if (data) {
    makeSlideActive(data)
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
  retrieveSlidesOnline(appStore.activeSchedule?._id!!)
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

const preSlideCreation = (): Slide => {
  const tempSlide: Slide = {
    id: useID(),
    name: "Untitled",
    type: slideTypes.text,
    layout: slideLayoutTypes.full_text,
    contents: [],
    userId: authStore.user?._id as string,
    churchId: authStore?.user?.churchId as string,
    scheduleId: appStore.activeSchedule?._id as string,
    slideStyle: {
      alignment: "left",
      fontSizePercent: 100,
      font: "Inter",
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

const uploadOfflineSlides = async () => {
  // Retrieve all offline slides
  const offlineSlides = appStore.activeSlides.filter(
    (slide) => slide._id === undefined
  )
  if (offlineSlides.length > 0) {
    const uploadedSlides = await batchCreateSlideOnline(offlineSlides)
    // console.log("uploadedSlides", uploadedSlides)

    const mergedSlides = mergeSlides([...offlineSlides], [...uploadedSlides])
    // console.log("merged slides", mergedSlides)
    appStore.appendActiveSlides(mergedSlides)
  }
}

const createScheduleOnline = async (schedule: Schedule) => {
  // console.log("createScheduleOnline", schedule)
  appStore.setSlidesLoading(true)
  const { data, error } = await useAPIFetch(`/church/${churchId}/schedules`, {
    method: "POST",
    body: schedule,
  })
  if (!error.value) {
    const tempSchedule = data.value as Schedule
    console.log("tempSchedule", tempSchedule)
    appStore.setActiveSchedule(tempSchedule)
    appStore.setSlidesLoading(false)
    appStore.setLastSynced(new Date().toISOString())
    return tempSchedule
  } else {
    throw new Error(error.value?.message)
  }
}

const retrieveSlidesOnline = async (scheduleId: string) => {
  appStore.setSlidesLoading(true)
  const { data, error } = await useAPIFetch(
    `/church/${authStore.user?.churchId}/schedules/${scheduleId}/slides`
  )
  if (!error.value) {
    const tempSlides = data.value as Slide[]
    tempSlides.forEach((slide) => {
      if (slide.backgroundType === backgroundTypes.video) {
        slide.background = appStore.backgroundVideos?.find(
          (bg) => bg.id === slide.backgroundVideoKey
        )?.url
      } else {
      }
    })
    appStore.setActiveSlides(
      useMergeObjectArray(tempSlides, [...appStore.activeSlides])
    )
    appStore.setSlidesLoading(false)
    appStore.setLastSynced(new Date().toISOString())
  } else {
    throw new Error(error.value?.message)
  }
}

// Set slides to slides based on scheduler
watch(
  activeSchedule,
  () => {
    slides.value = activeSlides.value?.filter(
      (slide) => slide.scheduleId === appStore.activeSchedule?._id
    )

    // Check if activeSchedule is remote object
    if (!activeSchedule.value?.updatedAt) {
      createScheduleOnline(activeSchedule.value as Schedule)
    } else {
      // retrieve all slides online
      retrieveSlidesOnline(activeSchedule.value?._id)
    }
  },
  { immediate: true }
)

const batchCreateSlideOnline = async (slides: Slide[]): Promise<Slide[]> => {
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

  appStore.setSlidesLoading(true)
  const { data, error } = await useAPIFetch(
    `/church/${churchId}/schedules/${appStore.activeSchedule?._id}/slides/batch`,
    {
      method: "POST",
      body: tempSlides,
      key: "batch-create-slides",
      dedupe: "defer",
    }
  )
  if (!error.value) {
    appStore.setSlidesLoading(false)
    appStore.setLastSynced(new Date().toISOString())
    return data.value as Slide[]
  } else {
    throw new Error(error.value?.message)
  }
}

const updateSlideOnline = useDebounceFn(async (slide: Slide) => {
  const tempSlide = { ...slide }
  delete tempSlide._id
  delete tempSlide.id
  delete tempSlide.churchId
  delete tempSlide.type

  if (tempSlide.backgroundType !== backgroundTypes.video) {
    tempSlide.backgroundVideoKey = ""
  }

  if (slide?._id) {
    appStore.setSlidesLoading(true)
    const { data, error } = await useAPIFetch(
      `/church/${churchId}/schedules/${appStore.activeSchedule?._id}/slides/${slide?._id}`,
      {
        method: "PUT",
        body: tempSlide,
      }
    )
    if (!error.value) {
      appStore.setSlidesLoading(false)
      appStore.setLastSynced(new Date().toISOString())
      return data.value
    } else {
      throw new Error(error.value?.message)
    }
  }
}, 2000)

const deleteSlideOnline = async (slide: Slide) => {
  if (slide?._id) {
    appStore.setSlidesLoading(true)
    const { data, error } = await useAPIFetch(
      `/church/${churchId}/schedules/${appStore.activeSchedule?._id}/slides/${slide?._id}`,
      {
        method: "DELETE",
      }
    )
    if (!error.value) {
      appStore.setSlidesLoading(false)
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
    tempSlide.background = appStore.settings.defaultBackground.text.background
    tempSlide.backgroundVideoKey =
      appStore.settings.defaultBackground.text.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.settings.defaultBackground.text.backgroundType
  }
  tempSlide.id = useID()

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide)
  toast.add({
    title: `${tempSlide?.name} created`,
    icon: "i-bx-slideshow",
  })
  uploadOfflineSlides()
}

const deleteSlide = async (slideId: string, addToast: boolean = true) => {
  const tempSlide = appStore.activeSlides.find((s) => s.id === slideId) as Slide

  // Clear interval if slide is a countdown slide before deleting
  if (tempSlide?.type === slideTypes.countdown) {
    // console.log("clearing interval", activeCountdownInterval.value)
    clearInterval(activeCountdownInterval.value)
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
    await db.media.delete(slideId)
  }
  // await db.media.delete(slideId)

  if (addToast) {
    toast.add({ title: `${tempSlide?.name} deleted`, icon: "i-tabler-trash" })
  }
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
  console.log("updated", slide)
  // Always pause countdown slide before updating it
  if (slide.type === slideTypes.countdown) {
    useGlobalEmit("start-countdown", slide)
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
    useGlobalEmit("start-countdown", slide)
  }
}

const createNewBibleSlide = (
  scripture: Scripture,
  options?: { fromWholeBibleSearch: boolean }
) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.bible
  tempSlide.background = appStore.settings.defaultBackground.bible.background
  tempSlide.backgroundVideoKey =
    appStore.settings.defaultBackground.bible.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.settings.defaultBackground.bible.backgroundType
  tempSlide.title = scripture?.label
  tempSlide.name = useSlideName(tempSlide)

  // Calculate font-size of scripture content
  let fontSize = useScreenFontSize(scripture?.content)
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
    font: appStore.settings.defaultFont,
  }
  tempSlide.contents = useSlideContent(tempSlide, scripture)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide, !options?.fromWholeBibleSearch)
  toast.add({ title: "Bible slide created", icon: "i-bx-bible" })
  uploadOfflineSlides()
}

const createNewHymnSlide = (hymn: Hymn) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.hymn
  tempSlide.background = appStore.settings.defaultBackground.hymn.background
  tempSlide.backgroundVideoKey =
    appStore.settings.defaultBackground.hymn.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.settings.defaultBackground.hymn.backgroundType
  tempSlide.songId = hymn.number
  tempSlide.hasChorus = !!hymn.chorus
  tempSlide.title = "Verse 1"
  tempSlide.name = useSlideName(tempSlide)

  const currentHymnVerse = hymn.verses?.[0].trim()

  // Calculate font-size of scripture content
  let fontSize = useScreenFontSize(currentHymnVerse)
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
    font: appStore.settings.defaultFont,
  }
  tempSlide.contents = useSlideContent(tempSlide, hymn, currentHymnVerse)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide)
  toast.add({ title: "Hymn slide created", icon: "i-bx-church" })
  uploadOfflineSlides()
}

const createNewSongSlide = (song: Song) => {
  // console.log("song", song)
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.song
  tempSlide.background = appStore.settings.defaultBackground.hymn.background
  tempSlide.backgroundVideoKey =
    appStore.settings.defaultBackground.hymn.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.settings.defaultBackground.hymn.backgroundType
  tempSlide.songId = song._id || song.id
  tempSlide.title = "Verse 1"

  const currentSongVerse = song.verses?.[0].trim()

  // Calculate font-size of scripture content
  let fontSize = useScreenFontSize(currentSongVerse as string)
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
    font: appStore.settings.defaultFont,
  }
  tempSlide.data = song
  tempSlide.contents = useSlideContent(tempSlide, song, currentSongVerse)
  tempSlide.name = useSlideName(tempSlide)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide)
  // console.log("called")
  toast.add({ title: "Song slide created", icon: "i-bx-music" })
  uploadOfflineSlides()
}

const createNewMediaSlide = async (
  file: any,
  options?: { oneOfManySlides: boolean }
) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.empty
  let data = null

  // Read Blob as array buffer
  const fileReader = new FileReader()
  if (file.blob) {
    fileReader.readAsArrayBuffer(file.blob)
    fileReader.addEventListener("loadend", async (event) => {
      data = fileReader.result
      // Store Blob in DB for easy retrieval on reload
      await useIndexedDB().media.add({
        id: tempSlide.id,
        content: file.blob,
        data: data as ArrayBuffer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      delete file.blob
    })
  }

  const randomImage =
    "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=1740"
  tempSlide.type = slideTypes.media
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    backgroundFillType: backgroundFillTypes.crop,
  }
  tempSlide.backgroundType = file.type === "audio" ? "image" : file.type
  tempSlide.background = file.type === "audio" ? randomImage : file.url
  tempSlide.data = file
  tempSlide.name = useSlideName(tempSlide)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide)
  if (!options?.oneOfManySlides) {
    toast.add({ title: "Media slide created", icon: "i-bx-image" })
  }
  uploadOfflineSlides()
}

const createMultipleNewMediaSlides = async (files: any[]) => {
  useGlobalEmit("app-loading", true)
  const multipleSlidesPromise: Promise<any>[] = []
  files?.forEach((file) => {
    multipleSlidesPromise.push(
      createNewMediaSlide(file, { oneOfManySlides: true })
    )
  })
  await Promise.all(multipleSlidesPromise)
  useGlobalEmit("app-loading", false)
  toast.add({ title: "Media slides created", icon: "i-bx-image" })
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
  tempSlide.background = appStore.settings.defaultBackground.hymn.background
  tempSlide.backgroundVideoKey =
    appStore.settings.defaultBackground.hymn.backgroundVideoKey
  tempSlide.backgroundType =
    appStore.settings.defaultBackground.hymn.backgroundType
  ;(tempSlide.data = countdown),
    (tempSlide.name = `${countdown.time?.replace("00:", "")}`)
  tempSlide.contents = useSlideContent(tempSlide, countdown)

  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: 17.5,
    alignment: "center",
    font: appStore.settings.defaultFont,
  }

  slides.value?.push(tempSlide)

  // Take slide live if current active slide is a countdown
  if (activeSlide.value?.type === slideTypes.countdown) {
    makeSlideActive(tempSlide, true)
  } else {
    makeSlideActive(tempSlide)
  }
  toast.add({ title: "Countdown slide created", icon: "i-bx-time" })
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
    const countdownTimeout = useTimeStringToMilli(
      restartCountdown
        ? (slide.data as Countdown)?.time
        : (slide.data as Countdown)?.timeLeft
    )
    if (activeCountdownInterval.value === null || restartCountdown) {
      // console.log("play or restart")
      if (restartCountdown) {
        clearInterval(activeCountdownInterval.value)
        countdownTimeLeft.value = countdownTimeout
      } else {
        countdownTimeLeft.value =
          countdownTimeLeft.value === 0
            ? countdownTimeout
            : countdownTimeLeft.value
      }
      const countdownInterval = setInterval(() => {
        // console.log("1 second gone", countdownTimeLeft.value)
        if (countdownTimeLeft.value - 1000 < 1000) {
          countdownTimeLeft.value = 0
          clearInterval(activeCountdownInterval.value)
        } else {
          countdownTimeLeft.value = countdownTimeLeft.value - 1000
        }

        updateCountdownSlide(slide, countdownTimeLeft.value)
        activeCountdownInterval.value = countdownInterval
      }, 1000)
      activeCountdownInterval.value = countdownInterval

      setTimeout(() => {
        clearInterval(countdownInterval)
        activeCountdownInterval.value = null
        updateCountdownSlide(slide, countdownTimeLeft.value, false)
      }, countdownTimeout)
    } else {
      // console.log("reached pause section", activeCountdownInterval.value)
      // console.log("reached pause section", countdownTimeLeft.value)
      clearInterval(activeCountdownInterval.value)
      activeCountdownInterval.value = null
      updateCountdownSlide(slide, countdownTimeLeft.value, false)
    }
  }
}

const updateLiveOutput = (updatedSlide: Slide) => {
  appStore.replaceScheduleActiveSlides(slides.value || [])

  // If the current slide in the live output/slide schedule is being edited, then update LiveOutput immediately
  if (updatedSlide.id === appStore.liveSlideId) {
    appStore.setLiveSlide(updatedSlide.id)
  }
}

const gotoAction = (title: string, version: string) => {
  useGlobalEmit("goto-verse", title)
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
  const scriptureLabel = `${title?.slice(0, title.lastIndexOf(" "))} ${
    scriptureSplitted?.[1]
  }:${scriptureSplitted?.[2]}`
  const scriptureShortLabel = `${scriptureSplitted?.[0]}:${scriptureSplitted?.[1]}:${scriptureSplitted?.[2]}`

  const scripture = await useScripture(scriptureShortLabel, version)
  appStore.setRecentBibleSearches(scriptureShortLabel)
  if (scripture) {
    // Calculate font-size of scripture content
    tempSlide.title = scriptureLabel
    tempSlide.data = scripture
    let fontSize = useScreenFontSize(scripture?.content)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
    }

    tempSlide.contents = useSlideContent(tempSlide, scripture)
    tempSlide.name = useSlideName(tempSlide)
    activeSlide.value = tempSlide
    slides.value.splice(slideIndex, 1, tempSlide)

    // Every 10 seconds
    // const debouncedSlideUpdate = useDebounceFn(updateSlideOnline, 10000)
    updateSlideOnline(activeSlide.value)
    updateLiveOutput(activeSlide.value)
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
}

const saveSlide = async (item: Slide) => {
  const db = useIndexedDB()
  const tempItem = { ...item }
  const tempSong = { ...tempItem?.data } as Song
  tempItem.slideStyle = { ...tempItem?.slideStyle }
  tempItem.contents = [...tempItem?.contents]
  tempItem.data = { ...tempItem.data } as any
  try {
    if (tempItem.type === slideTypes.song) {
      tempSong.verses = [...tempSong?.verses!!] as []
      await db.library.add(
        {
          id: tempSong.id,
          type: "song",
          content: tempSong,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        tempSong.id
      )
      toast.add({ icon: "i-bx-save", title: "Song saved to Library" })
    } else {
      delete tempItem.data.blob
      await db.library.add(
        {
          id: tempItem.id,
          type: "slide",
          content: tempItem,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        tempItem.id
      )
      toast.add({ icon: "i-bx-save", title: "Slide saved to Library" })
    }
  } catch (err: any) {
    if (err.name === "ConstraintError") {
      if (tempItem.type === slideTypes.song) {
        db.library.update(tempSong.id, {
          id: tempSong.id,
          type: "song",
          content: tempSong,
          createdAt: tempItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        toast.add({ icon: "i-bx-save", title: "Updated song saved to Library" })
      } else {
        delete tempItem.data.blob
        db.library.update(tempItem.id, {
          id: tempItem.id,
          type: "slide",
          content: tempItem,
          createdAt: tempItem?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
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
}

const addAllSlidesToSelectedSlides = () => {
  bulkSelectedSlides.value = activeSlides.value.map((slide) => slide?.id)
}

const removeAllSelectedSlides = () => {
  bulkSelectedSlides.value = []
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
.slides-ctn-3-rows {
  height: 336px;
}

.slides-ctn-2-rows {
  height: 260px;
}
</style>
