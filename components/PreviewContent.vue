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
      :class="[slides?.length === 0 ? 'bg-primary-100' : '']"
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
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type { Hymn, Scripture, Slide, Song } from "~/types"
const appStore = useAppStore()
const toast = useToast()

const windowHeight = ref<number>(0)
const slides = ref<Array<Slide>>(appStore.activeSlides || [])
const activeSlide = ref<Slide>()
const { activeSlides } = storeToRefs(appStore)
const slidesGrid = ref<HTMLDivElement | null>(null)
const bulkActionLabel = ref<string>("Select Slides")
const bulkActionIcon = ref<string>("")
const bulkSelectSlides = ref<boolean>(false)
const bulkSelectedSlides = ref<string[]>([])

watch(
  slides,
  (newVal, oldVal) => {
    appStore.setActiveSlides(slides.value)

    setTimeout(() => {
      // Scroll down to newest slide on slide create
      const slideId = activeSlide.value?.id
      const newestSlide = slidesGrid.value?.querySelector(
        `#${slideId?.replace(/\d+/g, "")}`
      )
      newestSlide?.scrollIntoView()
    }, 100)
  },
  { deep: true }
)

// Update Slides order when they are updated in live content
watch(activeSlides, () => {
  slides.value = activeSlides.value
})

const makeSlideActive = (slide: Slide, goLive: boolean = false) => {
  activeSlide.value = slide

  if (goLive) {
    appStore.setActiveSlides(slides.value)
    appStore.setLiveSlide(activeSlide.value.id)
  }
}

onMounted(() => {
  windowHeight.value = document.documentElement.offsetHeight
  addEventListener("resize", () => {
    windowHeight.value = document.documentElement.offsetHeight
  })
})

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>
emitter.on("new-slide", () => {
  createNewSlide()
})

emitter.on("new-text", (slide: Slide) => {
  createNewSlide(slide)
})

emitter.on("new-bible", (data: string) => {
  const scripture = useScripture(data)
  if (scripture) {
    createNewBibleSlide(scripture)
  }
})

emitter.on("new-hymn", (data: string) => {
  const hymn = useHymn(data)
  if (hymn) {
    createNewHymnSlide(hymn)
  }
})

emitter.on("new-song", (data: Song) => {
  if (data) {
    const song = useSong(data)
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
    slideStyle: {
      alignment: "left",
      fontSizePercent: 100,
      font: "Inter",
    },
  }
  return tempSlide
}

const createNewSlide = (duplicateSlide?: Slide) => {
  let tempSlide = { ...preSlideCreation() }
  if (duplicateSlide) {
    tempSlide = { ...duplicateSlide }
  } else {
    tempSlide.background = appStore.settings.defaultBackground.text.background
    tempSlide.backgroundType =
      appStore.settings.defaultBackground.text.backgroundType
  }
  tempSlide.id = useID()

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide)
  toast.add({
    title: `${duplicateSlide?.name} duplicated`,
    icon: "i-bx-slideshow",
  })
}

const deleteSlide = async (slideId: string, addToast: boolean = true) => {
  const tempSlide = appStore.activeSlides.find((s) => s.id === slideId)
  const slideIndex = slides.value.findIndex((s) => s.id === slideId)
  slides.value.splice(slideIndex, 1)
  appStore.setActiveSlides(slides.value)

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
  makeSlideActive(slide)
  const slideIndex = slides.value?.findIndex(
    (slideInner: Slide) => slide.id === slideInner.id
  )
  slides.value?.splice(slideIndex || 0, 1, slide)

  updateLiveOutput(slide)
}

const createNewBibleSlide = (scripture: Scripture) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.bible
  tempSlide.background = appStore.settings.defaultBackground.bible.background
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
  makeSlideActive(tempSlide, true)
  toast.add({ title: "Bible slide created", icon: "i-bx-bible" })
}

const createNewHymnSlide = (hymn: Hymn) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.hymn
  tempSlide.background = appStore.settings.defaultBackground.hymn.background
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
}

const createNewSongSlide = (song: Song) => {
  const tempSlide = { ...preSlideCreation() }
  tempSlide.layout = slideLayoutTypes.bible
  tempSlide.type = slideTypes.song
  tempSlide.background = appStore.settings.defaultBackground.hymn.background
  tempSlide.backgroundType =
    appStore.settings.defaultBackground.hymn.backgroundType
  tempSlide.songId = song.id
  tempSlide.title = "Verse 1"

  const currentSongVerse = song.verses?.[0].trim()

  // Calculate font-size of scripture content
  let fontSize = useScreenFontSize(currentSongVerse)
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
  console.log("called")
  toast.add({ title: "Song slide created", icon: "i-bx-music" })
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

  tempSlide.type = slideTypes.media
  tempSlide.backgroundType = file.type
  tempSlide.background = file.url
  tempSlide.data = file
  tempSlide.name = useSlideName(tempSlide)

  slides.value?.push(tempSlide)
  makeSlideActive(tempSlide)
  if (!options?.oneOfManySlides) {
    toast.add({ title: "Media slide created", icon: "i-bx-image" })
  }
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

const updateLiveOutput = (updatedSlide: Slide) => {
  appStore.setActiveSlides(slides.value || [])

  // If the current slide in the live output is being edited, then update LiveOutput immediately
  if (updatedSlide.id === appStore.liveSlideId) {
    appStore.setLiveSlide(updatedSlide.id)
  }
}

const gotoAction = (title: string, version: string) => {
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

const gotoScripture = (title: string, version: string) => {
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

  const scripture = useScripture(scriptureShortLabel, version)
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
    updateLiveOutput(activeSlide.value)
  }
}

const gotoHymnVerse = (title: string) => {
  const tempSlide = { ...activeSlide.value } as Slide
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  const hymn = useHymn(tempSlide.songId as string)
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
      updateLiveOutput(activeSlide.value)
    }
  }
}

const gotoSongVerse = (title: string) => {
  const tempSlide = { ...activeSlide.value } as Slide
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  const song = useSong(activeSlide.value?.data as Song)
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
      updateLiveOutput(activeSlide.value)
    }
  }
}

const gotoChorus = () => {
  const tempSlide = { ...activeSlide.value } as Slide
  const slideIndex = slides.value.findIndex((s) => s.id === tempSlide.id)
  const hymn = useHymn(tempSlide.songId as string)

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
      tempSong.verses = [...tempSong?.verses] as []
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
.slides-ctn-3-rows {
  height: 336px;
}

.slides-ctn-2-rows {
  height: 260px;
}
</style>
