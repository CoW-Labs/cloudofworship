import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type {
  Slide,
  Scripture,
  Hymn,
  Song,
  Countdown,
  ExtendedFileT,
} from "~/types"

/**
 * Composable for creating different types of slides
 * Handles Bible, Hymn, Song, Media, Countdown, and Text slides
 */
export default function useSlideCreation() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const { saveSlideOnline } = useSlides()
  const { saveSong, saveSlide: saveSlideToLibrary, getLibraryItem } = useLibrary()

  /**
   * Pre-populate slide with default settings
   */
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
        lettercase: appStore.currentState.settings.slideStyles.lettercase,
        lineSpacing: appStore.currentState.settings.slideStyles.lineSpacing,
        textOutlined: appStore.currentState.settings.slideStyles.textOutlined,
      },
    }
    return tempSlide
  }

  /**
   * Create a new text slide
   */
  const createTextSlide = (): Slide => {
    let tempSlide = { ...preSlideCreation() }

    tempSlide.slideStyle = { ...tempSlide.slideStyle, alignment: "left" }
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.text?.background
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default
        ?.backgroundType ||
      appStore.currentState.settings.defaultBackground.text?.backgroundType

    tempSlide.id = useObjectID()
    usePosthogCapture("NEW_TEXT_SLIDE_CREATED")

    return tempSlide
  }

  const duplicateSlide = (slideToDuplicate?: Slide): Slide | null => {
    if (!slideToDuplicate) return null;

    const tempSlide = { ...slideToDuplicate }
    delete tempSlide._id
    tempSlide.id = useObjectID()

    usePosthogCapture("SLIDE_DUPLICATED")

    return tempSlide
  }

  /**
   * Create a new Bible slide from scripture
   */
  const createBibleSlide = (
    scripture: Scripture,
    options?: { fromWholeBibleSearch: boolean }
  ): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.bible
    tempSlide.type = slideTypes.bible
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.bible?.background
    tempSlide.backgroundVideoKey =
      appStore.currentState.settings.defaultBackground.default
        ?.backgroundVideoKey ||
      appStore.currentState.settings.defaultBackground.bible?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.bible?.backgroundType
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

    toast.add({ title: "Bible slide created", icon: "i-bx-bible" })
    usePosthogCapture("NEW_BIBLE_SLIDE_CREATED")

    return tempSlide
  }

  /**
   * Create a new Hymn slide
   */
  const createHymnSlide = (hymn: Hymn): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.bible
    tempSlide.type = slideTypes.hymn
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.hymn?.background
    tempSlide.backgroundVideoKey =
      appStore.currentState.settings.defaultBackground.default
        ?.backgroundVideoKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundType
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

    toast.add({ title: "Hymn slide created", icon: "i-bx-church" })
    usePosthogCapture("NEW_HYMN_SLIDE_CREATED")

    return tempSlide
  }

  /**
   * Create a new Song slide
   */
  const createSongSlide = (song: Song): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.bible
    tempSlide.type = slideTypes.song
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.hymn?.background
    tempSlide.backgroundVideoKey =
      appStore.currentState.settings.defaultBackground.default
        ?.backgroundVideoKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundType
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

    toast.add({ title: "Song slide created", icon: "i-bx-music" })
    usePosthogCapture("NEW_SONG_SLIDE_CREATED")

    return tempSlide
  }

  /**
   * Create a new Media slide (Image/Video/Audio)
   */
  const createMediaSlide = async (
    file: ExtendedFileT & { isExternal?: boolean },
    options?: { oneOfManySlides: boolean }
  ): Promise<Slide> => {
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

    if (!options?.oneOfManySlides) {
      toast.add({ title: "Media slide created", icon: "i-bx-image" })
    }

    usePosthogCapture("NEW_MEDIA_SLIDE_CREATED", {
      file_type: tempSlide?.data?.type || file.type,
    })

    return { ...tempSlide, blob } as Slide
  }

  /**
   * Create multiple media slides from files array
   */
  const createMultipleMediaSlides = async (files: ExtendedFileT[]): Promise<Slide[]> => {
    useGlobalEmit(appWideActions.appLoading, true)

    const multipleSlidesPromise: Promise<any>[] = []
    files?.forEach((file) => {
      multipleSlidesPromise.push(
        createMediaSlide(file, { oneOfManySlides: true })
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

    newSlides.forEach((slide, index) => {
      const imageObject = uploadedImagesResp[index]
      slide.background = imageObject?.file?.url || slide.background
    })

    return newSlides
  }

  /**
   * Create a new Countdown slide
   */
  const createCountdownSlide = (countdown: Countdown): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.countdown
    tempSlide.type = slideTypes.countdown
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.hymn?.background
    tempSlide.backgroundVideoKey =
      appStore.currentState.settings.defaultBackground.hymn?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.hymn?.backgroundType
    tempSlide.data = countdown
    tempSlide.name = `${countdown.time?.replace("00:", "")}`
    tempSlide.contents = useSlideContent(tempSlide, countdown)

    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: 17.5,
      alignment: "center",
      font: appStore.currentState.settings.defaultFont,
    }

    toast.add({ title: "Countdown slide created", icon: "i-bx-time" })
    usePosthogCapture("NEW_COUNTDOWN_SLIDE_CREATED")

    return tempSlide
  }

  /**
   * Save slide to library (handles songs, hymns, and other slides)
   */
  const saveSlideToLib = async (item: Slide): Promise<void> => {
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

    // Save song or hymn to library
    if (tempItem.type === slideTypes.song || tempItem.type === slideTypes.hymn) {
      tempSong.verses = [...tempSong?.verses!!] as []
      await saveSong(tempSong)
    } else {
      // Save slide to library
      delete (tempItem?.data as ExtendedFileT)?.blob
      await saveSlideToLibrary(tempItem)
      saveSlideOnline(tempItem)
    }

    usePosthogCapture("LIBRARY_SAVE_SLIDE")
  }

  return {
    preSlideCreation,
    createTextSlide,
    createBibleSlide,
    createHymnSlide,
    createSongSlide,
    createMediaSlide,
    createMultipleMediaSlides,
    createCountdownSlide,
    saveSlideToLib,
    duplicateSlide
  }
}
