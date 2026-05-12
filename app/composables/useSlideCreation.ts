import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type {
  Slide,
  Scripture,
  Hymn,
  Song,
  Countdown,
  ExtendedFileT,
  PresentationObject,
} from "~/types"
import { tabSessionId } from "./useRealtimeSlides"

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

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Pre-populate a slide with default settings from the store.
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
          appStore.currentState.settings.defaultBackground.default?.backgroundType,
        background:
          appStore.currentState.settings.defaultBackground.default?.background,
        backgroundVideoKey:
          appStore.currentState.settings.defaultBackground.default?.backgroundVideoKey,
      }),
      scheduleId: appStore.currentState.activeSchedule?._id as string,
      slideStyle: {
        alignment: appStore.currentState.settings.slideStyles.alignment,
        fontSizePercent: appStore.currentState.settings.slideStyles.fontSizePercent,
        font: appStore.currentState.settings.defaultFont,
        isMediaMuted: true,
        isMediaPlaying: false,
        lettercase: appStore.currentState.settings.slideStyles.lettercase,
        lineSpacing: appStore.currentState.settings.slideStyles.lineSpacing,
        textOutlined: appStore.currentState.settings.slideStyles.textOutlined,
        textBold: appStore.currentState.settings.slideStyles.textBold,
        textLinesBackground:
          appStore.currentState.settings.slideStyles.textLinesBackground,
        backgroundFillType: appStore.currentState.settings.slideStyles.backgroundFillType,
      },
    }
    return tempSlide
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Slide creators
  // ─────────────────────────────────────────────────────────────────────────

  const createTextSlide = (): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.slideStyle = { ...tempSlide.slideStyle, alignment: "left" }
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.text?.background
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.text?.backgroundType
    tempSlide.id = useObjectID()
    usePosthogCapture("NEW_TEXT_SLIDE_CREATED")
    return tempSlide
  }

  const duplicateSlide = (slideToDuplicate?: Slide): Slide | null => {
    if (!slideToDuplicate) return null
    const tempSlide = { ...slideToDuplicate }
    delete tempSlide._id
    tempSlide.id = useObjectID()
    usePosthogCapture("SLIDE_DUPLICATED")
    return tempSlide
  }

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
      appStore.currentState.settings.defaultBackground.default?.backgroundVideoKey ||
      appStore.currentState.settings.defaultBackground.bible?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.bible?.backgroundType
    tempSlide.title = scripture?.label
    tempSlide.name = useSlideName(tempSlide)
    const fontSize = useScreenFontSize(scripture?.content as string)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
      font: appStore.currentState.settings.defaultFont,
    }
    tempSlide.contents = useSlideContent(tempSlide, scripture)
    usePosthogCapture("NEW_BIBLE_SLIDE_CREATED")
    return tempSlide
  }

  const createHymnSlide = (hymn: Hymn): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.bible
    tempSlide.type = slideTypes.hymn
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.hymn?.background
    tempSlide.backgroundVideoKey =
      appStore.currentState.settings.defaultBackground.default?.backgroundVideoKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundType
    tempSlide.songId = hymn.number
    tempSlide.hasChorus = hymn.chorus === "false" ? false : !!hymn.chorus
    tempSlide.title = "Verse 1"
    tempSlide.hymnVerseIndex = 0
    tempSlide.name = useSlideName(tempSlide)
    const currentHymnVerse = hymn.verses?.[0]?.trim() ?? ""
    const fontSize = useScreenFontSize(currentHymnVerse)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
      font: appStore.currentState.settings.defaultFont,
    }
    tempSlide.contents = useSlideContent(tempSlide, hymn, currentHymnVerse)
    tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
      ? slideLayoutTypes.bible
      : slideLayoutTypes.full_text
    tempSlide.name = useSlideName(tempSlide)
    usePosthogCapture("NEW_HYMN_SLIDE_CREATED")
    return tempSlide
  }

  const createSongSlide = (song: Song): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.bible
    tempSlide.type = slideTypes.song
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.hymn?.background
    tempSlide.backgroundVideoKey =
      appStore.currentState.settings.defaultBackground.default?.backgroundVideoKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundType
    tempSlide.songId = song._id || song.id
    tempSlide.title = "Verse 1"
    const currentSongVerse = song.verses?.[0]?.trim() ?? ""
    const fontSize = useScreenFontSize(currentSongVerse as string)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
      font: appStore.currentState.settings.defaultFont,
    }
    tempSlide.data = song
    tempSlide.contents = useSlideContent(tempSlide, song, currentSongVerse)
    tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
      ? slideLayoutTypes.bible
      : slideLayoutTypes.full_text
    tempSlide.name = useSlideName(tempSlide)
    usePosthogCapture("NEW_SONG_SLIDE_CREATED")
    return tempSlide
  }

  const createSongSetlistSlide = async (song?: Song): Promise<Slide> => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = appStore.currentState.settings.songAndHymnLabelsVisibility
      ? slideLayoutTypes.bible
      : slideLayoutTypes.full_text
    tempSlide.type = slideTypes.songSetlist
    tempSlide.background =
      appStore.currentState.settings.defaultBackground.default?.background ||
      appStore.currentState.settings.defaultBackground.hymn?.background
    tempSlide.backgroundVideoKey =
      appStore.currentState.settings.defaultBackground.default?.backgroundVideoKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundVideoKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundType
    tempSlide.title = "Song Setlist"
    tempSlide.data = {
      songs: [],
      activeSongIndex: 0,
    }
    tempSlide.contents = ["", "<p class=\"song-content\">Add songs to this setlist</p>"]
    tempSlide.name = useSlideName(tempSlide)

    if (song) {
      const { appendSongToSetlist } = useSongSetlist()
      const slideWithSong = await appendSongToSetlist(tempSlide, song, {
        makeActive: true,
      })
      if (slideWithSong) {
        usePosthogCapture("NEW_SONG_SETLIST_SLIDE_CREATED")
        return slideWithSong
      }
    }

    usePosthogCapture("NEW_SONG_SETLIST_SLIDE_CREATED")
    return tempSlide
  }

  /**
   * Build a single media slide object from a file.
   * Returns immediately with a local Blob URL — no uploads happen here.
   * Side-effect: saves the raw Blob as an ArrayBuffer in IndexedDB so the
   * slide can be rendered after a page reload (blob: URLs are session-scoped).
   */
  const createMediaSlide = (
    file: ExtendedFileT & { isExternal?: boolean },
    options?: { oneOfManySlides: boolean }
  ): Slide => {
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.empty
    tempSlide.type = slideTypes.media

    const randomImage =
      "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=1740"

    if (file.isExternal) {
      // ── External video (YouTube / Vimeo) ──────────────────────────────────
      const externalVideo: any = {
        url: file.url,
        type: file.type,
        thumbnail: (file as any).thumbnail,
        name: file.name,
      }
      tempSlide.backgroundType = "video"
      tempSlide.background = randomImage
      tempSlide.backgroundVideoKey = null
      tempSlide.data = externalVideo
      tempSlide.name = file.name || `${file.type} Video`

      useIndexedDB()
        .media.add({
          id: tempSlide.id,
          content: { type: file.type },
          data: externalVideo,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .catch((err) => console.error("Failed to add external video slide:", err))
    } else {
      // ── Regular file (image / video / audio) ─────────────────────────────
      tempSlide.backgroundType = file.type === "audio" ? "image" : file.type
      tempSlide.background = file.type === "audio" ? randomImage : file.url
      tempSlide.backgroundVideoKey = file.type?.includes("video")
        ? appStore.currentState.settings.defaultBackground.default?.backgroundVideoKey
        : null
      tempSlide.data = file
      tempSlide.name = useSlideName(tempSlide)

      // Persist Blob → ArrayBuffer in IndexedDB for post-reload rendering
      if (file.blob) {
        const fileReader = new FileReader()
        fileReader.readAsArrayBuffer(file.blob)
        fileReader.addEventListener("loadend", async () => {
          const arrayBuffer = fileReader.result as ArrayBuffer
          await useIndexedDB()
            .media.add({
              id: tempSlide.id,
              content: { size: file.blob?.size, type: file.blob?.type },
              data: arrayBuffer,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .catch((err) => console.error("Failed to persist media blob:", err))
          // Remove blob from the in-memory file object after it is stored
          delete file.blob
        })
      }
    }

    usePosthogCapture("NEW_MEDIA_SLIDE_CREATED", {
      file_type: (tempSlide.data as any)?.type ?? file.type,
    })

    return tempSlide
  }

  /**
   * Create multiple media slides from a files array.
   *
   * ┌─────────────────────────────────────────────────────────┐
   * │  Step 1 (sync)   Build slide objects with local Blob    │
   * │                  URLs → returned immediately so the     │
   * │                  current user sees them right away.     │
   * ├─────────────────────────────────────────────────────────┤
   * │  Step 2 (async,  a. Upload image blobs to the cloud     │
   * │  background)        (Teams plan only).                  │
   * │                  b. Patch slides with hosted URLs.      │
   * │                  c. POST all slides to the backend      │
   * │                     via batchCreateSlides.              │
   * │                  d. Emit batch-create-slides via        │
   * │                     WebSocket so other clients sync.    │
   * └─────────────────────────────────────────────────────────┘
   *
   * NOTE: The caller (PreviewContent.vue) must NOT emit its own
   * socket event for these slides — the background step handles it.
   */
  const createMultipleMediaSlides = (files: ExtendedFileT[]): Slide[] => {
    useGlobalEmit(appWideActions.appLoading, true)

    // ── Step 1 — build local slide objects synchronously ──────────────────
    // Capture blob references NOW before createMediaSlide's async FileReader
    // can delete them (it calls `delete file.blob` after persisting to IndexedDB).
    const capturedBlobs: Array<Blob | null> = files.map((file) =>
      file.blob instanceof Blob ? file.blob : null
    )

    const newSlides: Slide[] = files.map((file) =>
      createMediaSlide(file, { oneOfManySlides: true })
    )

    useGlobalEmit(appWideActions.appLoading, false)

      // ── Step 2 — background: upload → server create → socket broadcast ────
      ; (async () => {
        try {
          const { isTeamsPlan } = useSubscription()

          // 2a — Upload image blobs to the cloud (Teams plan, images only).
          // capturedBlobs holds references taken before createMediaSlide's async
          // FileReader could delete file.blob — so they are always available here.
          // Promise.all ensures batchCreateSlides never fires until every image
          // upload has finished.
          if (isTeamsPlan.value) {
            const uploadPromises = files.map(async (file: ExtendedFileT, index: number) => {
              const blob = capturedBlobs[index]
              // Only upload image files; skip videos, audio, and external files
              if (!blob?.type?.includes("image")) return null
              try {
                const uploaded = await useUploadImage(blob)
                return { uploaded, index }
              } catch (err) {
                console.error("Image upload failed for", file.name, err)
                return null
              }
            })

            // Wait for ALL uploads to complete before proceeding to the batch call
            const results = await Promise.all(uploadPromises)

            // 2b — Patch local slide objects with hosted URLs
            results.forEach((res) => {
              if (!res?.uploaded) return
              const slide = newSlides[res.index]
              if (!slide) return
              slide.background = res.uploaded.file.url
              // Keep data.url in sync so LiveContent renders the hosted URL
              if (slide.data && (slide.data as any).url) {
                ; (slide.data as any).url = res.uploaded.file.url
              }
            })
          }

          // 2c — POST all new slides to the backend with their final URLs
          const sanitizedSlides = newSlides.map((slide) => {
            const sanitizedSlide = { ...slide }
            if (sanitizedSlide.data && typeof sanitizedSlide.data === "object") {
              const sanitizedData = {
                ...(sanitizedSlide.data as unknown as Record<string, unknown>)
              }
              delete sanitizedData.blob
              sanitizedSlide.data = sanitizedData as unknown as typeof sanitizedSlide.data
            }
            return sanitizedSlide
          })

          const { batchCreateSlides } = useSlides()
          const { inserted } = await batchCreateSlides(sanitizedSlides)

          // Backfill _id from the server response onto our local objects
          inserted.forEach((serverSlide) => {
            const local = newSlides.find((s) => s.id === serverSlide.id)
            if (local && serverSlide._id) local._id = serverSlide._id
          })

          // 2d — Broadcast to other clients only after server confirms creation
          const nuxtApp = useNuxtApp()
          const socket = nuxtApp.$socketio as any
          if (socket?.connected && inserted.length > 0) {
            socket.emit("batch-create-slides", {
              slides: inserted.map((s) => ({ ...s })),
              tabId: tabSessionId,
            })
          }
        } catch (err) {
          console.error("createMultipleMediaSlides background flow failed", err)
          toast.add({
            title: "Error saving media slides",
            icon: "i-bx-error",
            color: "red",
          })
        }
      })()

    // Return slides immediately — caller adds them to the active slide list
    return newSlides
  }

  /**
   * Create a presentation slide from an array of rendered page images.
   *
   * ┌─────────────────────────────────────────────────────────┐
   * │  Step 1 (sync)   Build slide object → returned          │
   * │                  immediately with Blob image URLs.      │
   * ├─────────────────────────────────────────────────────────┤
   * │  Step 2 (async,  a. Persist each page as ArrayBuffer    │
   * │  background)        in IndexedDB (survives reload).     │
   * │                  b. On Teams plan: upload each page to  │
   * │                     the cloud, replace Blob URLs with   │
   * │                     hosted URLs.                        │
   * │                  c. POST the slide to the backend via   │
   * │                     createSlide.                        │
   * │                  d. Emit create-slide via WebSocket.    │
   * └─────────────────────────────────────────────────────────┘
   *
   * NOTE: The caller must NOT emit its own socket event.
   */
  const createPresentationSlide = (
    fileName: string,
    presentationObjects: PresentationObject[]
  ): Slide => {
    // ── Step 1 — build slide object synchronously ─────────────────────────
    const tempSlide = { ...preSlideCreation() }
    tempSlide.layout = slideLayoutTypes.empty
    tempSlide.type = slideTypes.presentation
    tempSlide.name = fileName.replace(/\.[^/.]+$/, "") || "Presentation"
    tempSlide.presentationObjects = presentationObjects
    tempSlide.presentationPageIndex = 0
    tempSlide.backgroundType = "image"
    tempSlide.background = presentationObjects[0]?.imageUrl ?? ""
    tempSlide.contents = []

      // ── Step 2 — background ───────────────────────────────────────────────
      ; (async () => {
        const db = useIndexedDB()
        const { isTeamsPlan } = useSubscription()
        const { createSlide } = useSlides()
        const nuxtApp = useNuxtApp()
        const socket = nuxtApp.$socketio as any

        for (const obj of presentationObjects) {
          try {
            const blobResponse = await fetch(obj.imageUrl)
            const arrayBuffer = await blobResponse.arrayBuffer()
            const blob = new Blob([arrayBuffer], { type: "image/png" })

            // 2a — Persist to IndexedDB (works for all plans / offline)
            await db.media
              .add({
                id: `${tempSlide.id}-page-${obj.page}`,
                content: { type: "image/png", slideId: tempSlide.id },
                data: arrayBuffer,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
              .catch((err) =>
                console.error(`Failed to persist presentation page ${obj.page}:`, err)
              )

            // 2b — Upload to cloud on Teams plan
            if (isTeamsPlan.value && navigator.onLine) {
              try {
                const uploaded = await useUploadImage(blob)
                obj.imageUrl = uploaded.file.url
                if (obj.page === 1) tempSlide.background = uploaded.file.url
              } catch (uploadErr) {
                console.error(`Cloud upload failed for page ${obj.page}:`, uploadErr)
              }
            }
          } catch (err) {
            console.error(`Failed to process presentation page ${obj.page}:`, err)
          }
        }

        // 2c — Create the slide on the backend (with final hosted URLs if any)
        let createdSlide: Slide | null = null
        try {
          createdSlide = await createSlide(tempSlide)
        } catch (err) {
          console.error("Failed to create presentation slide on server:", err)
        }

        if (!createdSlide) return

        // Backfill the server-assigned _id onto the local object
        if (createdSlide._id) tempSlide._id = createdSlide._id

        // 2d — Notify other clients that this slide now exists
        if (socket?.connected) {
          socket.emit("create-slide", { ...createdSlide, tabId: tabSessionId })
        }
      })()

    usePosthogCapture("NEW_PRESENTATION_SLIDE_CREATED", {
      page_count: presentationObjects.length,
    })

    return tempSlide
  }

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
    usePosthogCapture("NEW_COUNTDOWN_SLIDE_CREATED")
    return tempSlide
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Library
  // ─────────────────────────────────────────────────────────────────────────

  const saveSlideToLib = async (item: Slide): Promise<void> => {
    const tempItem = { ...item }
    let tempSong = { ...tempItem?.data } as Song

    if (tempItem.type === slideTypes.hymn) {
      const hymn = (await useHymn(tempItem.songId as string)) as Hymn
      const verses = [...hymn?.verses]
      if (hymn?.chorus !== "false") verses.splice(1, 0, hymn?.chorus)
      const lyrics = verses.join("\n")
      if (verses[0]) verses.push(verses[0])
      tempSong = {
        id: useID(),
        title: hymn?.title ?? "",
        artist: hymn?.author ?? "",
        lyrics: lyrics ?? "",
        createdBy: "me",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    tempItem.slideStyle = { ...tempItem?.slideStyle }
    tempItem.contents = [...tempItem?.contents]
    tempItem.data = { ...tempItem.data } as any

    if (tempItem.type === slideTypes.song || tempItem.type === slideTypes.hymn) {
      tempSong.verses = [...(tempSong?.verses ?? [])] as []
      await saveSong(tempSong)
    } else {
      delete (tempItem?.data as ExtendedFileT)?.blob
      await saveSlideToLibrary(tempItem)
      saveSlideOnline(tempItem)
    }

    usePosthogCapture("LIBRARY_SAVE_SLIDE")
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  return {
    preSlideCreation,
    createTextSlide,
    createBibleSlide,
    createHymnSlide,
    createSongSlide,
    createSongSetlistSlide,
    createMediaSlide,
    createMultipleMediaSlides,
    createCountdownSlide,
    createPresentationSlide,
    saveSlideToLib,
    duplicateSlide,
  }
}
