import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import { splitVerseByLines } from "~/composables/useHymn"
import { safeDBOperation } from "~/composables/useIndexedDB"
import type {
  Slide,
  Scripture,
  Hymn,
  Song,
  Countdown,
  ExtendedFileT,
  PresentationObject,
  TimeSlideData,
} from "~/types"
import { tabSessionId } from "./useRealtimeSlides"
import { mediaCloudFailureReason } from "~/utils/mediaCloudSync"

/**
 * Composable for creating different types of slides
 * Handles Bible, Hymn, Song, Media, Countdown, and Text slides
 */
export default function useSlideCreation() {
  const appStore = useAppStore()
  const authStore = useAuthStore()
  const toast = useToast()
  const { overlaySettings } = useOverlaySettings()
  const { saveSlideOnline } = useSlides()
  const { saveSong, saveSlide: saveSlideToLibrary, getLibraryItem } = useLibrary()
  const localMedia = useLocalMediaStorage()
  const {
    beginLocalSave,
    setLocalSaveProgress,
    completeLocalSave,
    failLocalSave,
  } = useMediaDownloadProgress()

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Pre-populate a slide with default settings from the store.
   */
  const preSlideCreation = (): Slide => {
    const tempSlide: Slide = {
      id: useObjectID(),
      index: appStore.activeSlides.length,
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
        backgroundImageKey:
          appStore.currentState.settings.defaultBackground.default?.backgroundImageKey,
      }),
      scheduleId: appStore.currentState.activeSchedule?._id as string,
      slideStyle: {
        alignment: appStore.currentState.settings.slideStyles.alignment,
        fontSizePercent: appStore.currentState.settings.slideStyles.fontSizePercent,
        font: appStore.currentState.settings.defaultFont,
        isMediaMuted: true,
        isMediaPlaying: false,
        lettercase: appStore.currentState.settings.slideStyles.lettercase,
        // Never leave this unset — with no lineSpacing the rendered slide gets
        // no line-spacing class and long content (scripture especially) draws
        // with overlapping lines.
        lineSpacing:
          appStore.currentState.settings.slideStyles.lineSpacing ||
          lineSpacingTypes.normal,
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
    // Text-slide typography is stored in its TipTap HTML. Do not seed it with
    // global typography, otherwise global alignment/case/font/weight settings
    // override the formatting chosen in the text toolbar.
    tempSlide.slideStyle = {
      isMediaMuted: tempSlide.slideStyle?.isMediaMuted,
      isMediaPlaying: tempSlide.slideStyle?.isMediaPlaying,
      backgroundFillType: tempSlide.slideStyle?.backgroundFillType,
    }
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

  const duplicateSlideAsOverlay = (slideToDuplicate?: Slide): Slide | null => {
    const isCompatibleTextSlide =
      slideToDuplicate?.type === slideTypes.text &&
      [slideLayoutTypes.full_text, slideLayoutTypes.heading_sub].includes(
        slideToDuplicate.layout
      )
    const isTimeSlide = slideToDuplicate?.type === slideTypes.time

    if (!slideToDuplicate || (!isCompatibleTextSlide && !isTimeSlide)) {
      return null
    }

    const duplicatedData = isTimeSlide
      ? { ...(slideToDuplicate.data as TimeSlideData), id: useID() }
      : slideToDuplicate.data

    const tempSlide: Slide = {
      ...slideToDuplicate,
      id: useObjectID(),
      index: appStore.activeSlides.length,
      name: `${slideToDuplicate.name || (isTimeSlide ? "Live Time" : "Text")}`,
      slideMode: "overlay",
      contents: [...slideToDuplicate.contents],
      data: duplicatedData,
      slideStyle: {
        ...slideToDuplicate.slideStyle,
        overlayPlacement: overlaySettings.value.position,
        overlayScale: overlaySettings.value.scale,
      },
    }

    if (isTimeSlide) {
      tempSlide.contents = useSlideContent(
        tempSlide,
        duplicatedData as TimeSlideData
      )
    }

    delete tempSlide._id
    usePosthogCapture("SLIDE_DUPLICATED_AS_OVERLAY", {
      sourceType: slideToDuplicate.type,
    })
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
    tempSlide.backgroundImageKey =
      appStore.currentState.settings.defaultBackground.default?.backgroundImageKey ||
      appStore.currentState.settings.defaultBackground.bible?.backgroundImageKey
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
      // Bible-only default, set in Bible Slide Settings. Seeded per slide so an
      // existing slide keeps its theme when the default later changes.
      theme: appStore.currentState.settings.slideStyles.theme || "default",
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
    tempSlide.backgroundImageKey =
      appStore.currentState.settings.defaultBackground.default?.backgroundImageKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundImageKey
    tempSlide.backgroundType =
      appStore.currentState.settings.defaultBackground.default?.backgroundType ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundType
    tempSlide.songId = hymn.number
    tempSlide.hasChorus = hymn.chorus === "false" ? false : !!hymn.chorus
    tempSlide.title = "Verse 1"
    tempSlide.hymnVerseIndex = 0
    tempSlide.name = useSlideName(tempSlide)
    const rawHymnVerse = hymn.verses?.[0]?.trim() ?? ""
    const linesPerSlide = appStore.currentState.settings.slideStyles.linesPerSlide
    const hymnChunks = splitVerseByLines(rawHymnVerse, linesPerSlide)
    const currentHymnVerse = hymnChunks[0] ?? ""
    tempSlide.hymnSubVerseIndex = 0
    tempSlide.hymnSubVerseTotal = hymnChunks.length
    const fontSize = useScreenFontSize(currentHymnVerse)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
      font: appStore.currentState.settings.defaultFont,
      ...(linesPerSlide !== undefined && { linesPerSlide }),
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
    tempSlide.backgroundImageKey =
      appStore.currentState.settings.defaultBackground.default?.backgroundImageKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundImageKey
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
    tempSlide.backgroundImageKey =
      appStore.currentState.settings.defaultBackground.default?.backgroundImageKey ||
      appStore.currentState.settings.defaultBackground.hymn?.backgroundImageKey
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
      const slideWithSong = await appendSongToSetlist(tempSlide, song)
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
   * Side-effect: streams the raw Blob to the platform media store so the slide
   * can be rendered after a page reload (temporary blob: URLs are session-scoped).
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
      tempSlide.backgroundImageKey = null
      tempSlide.data = externalVideo
      tempSlide.name = file.name || `${file.type} Video`

      safeDBOperation((db) => db.media.put({
        id: tempSlide.id,
        content: { type: file.type },
        data: externalVideo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
    } else {
      // ── Regular file (image / video / audio) ─────────────────────────────
      tempSlide.backgroundType = file.type === "audio" ? "image" : file.type
      tempSlide.background = file.type === "audio" ? randomImage : file.url
      // Uploaded media has no preset background video. Its own bytes are
      // rehydrated by slide.id (not backgroundVideoKey), so
      // inheriting the church default preset key here only mis-tags the slide
      // and lets retrieveSlidesOnline overwrite it with an unrelated preset.
      tempSlide.backgroundVideoKey = null
      tempSlide.backgroundImageKey = null
      tempSlide.data = file
      tempSlide.name = useSlideName(tempSlide)

      // Multi-file creation compresses images first and persists the final
      // bytes as one coordinated background step below.
      if (file.blob && !options?.oneOfManySlides) {
        const sourceBlob = file.blob
        beginLocalSave(tempSlide.id)
        void (async () => {
          const finalBlob =
            file.type === "image"
              ? await useCompressedImage(sourceBlob)
              : sourceBlob
          await localMedia.saveBlob({
            key: tempSlide.id,
            groupId: tempSlide.id,
            category: "slide",
            kind:
              file.type === "audio"
                ? "audio"
                : file.type === "video"
                ? "video"
                : "image",
            blob: finalBlob,
            mimeType: finalBlob.type,
            originalName: file.name,
            recoverable: false,
            userInitiated: true,
            onProgress: (fraction) =>
              setLocalSaveProgress(tempSlide.id, fraction),
          })
          const url = await localMedia.getPlaybackUrl(tempSlide.id)
          if (url && tempSlide.data) {
            ;(tempSlide.data as ExtendedFileT).url = url
            if (file.type !== "audio") tempSlide.background = url
          }
          completeLocalSave(tempSlide.id)
          delete file.blob
        })()
          .catch((error) => {
            failLocalSave(tempSlide.id, error)
            console.error("Failed to persist local media:", error)
            useToast().add({
              title: "Media was not saved locally",
              description:
                "The preview remains available for this session. Retry after freeing storage or remove the slide.",
              icon: "i-bx-error",
              color: "red",
            })
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
   * │  Step 2 (async,  a. Compress image blobs (>500KB).      │
   * │  background)     b. Save compressed bytes locally      │
   * │                     (both plans).                       │
   * │                  c. Upload compressed blobs to cloud    │
   * │                     (Teams plan only).                  │
   * │                  d. Patch slides with hosted URLs.      │
   * │                  e. POST all slides to the backend      │
   * │                     via batchCreateSlides.              │
   * │                  f. Emit batch-create-slides via        │
   * │                     WebSocket so other clients sync.    │
   * └─────────────────────────────────────────────────────────┘
   *
   * NOTE: The caller (PreviewContent.vue) must NOT emit its own
   * socket event for these slides — the background step handles it.
   */
  const createMultipleMediaSlides = (files: ExtendedFileT[]): Slide[] => {
    useGlobalEmit(appWideActions.appLoading, true)

    // ── Step 1 — build local slide objects synchronously ──────────────────
    // Capture blob references for compression, local persistence, and upload.
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

          // 2a — Compress image blobs in the background (both plans).
          // useCompressedImage returns the original untouched for files <=500KB,
          // so small images skip the worker. This runs after the slides are
          // already on screen, so the user never waits on it.
          const compressedBlobs = await Promise.all(
            capturedBlobs.map(async (blob) => {
              if (!blob?.type?.includes("image")) return blob
              try {
                return await useCompressedImage(blob)
              } catch (err) {
                console.error("Background image compression failed", err)
                return blob
              }
            })
          )

          // 2b — Persist the final bytes before cloud upload or projection.
          // Large files are written sequentially to avoid competing 1 GB disk
          // streams and memory pressure.
          for (const [index, blob] of compressedBlobs.entries()) {
            const slide = newSlides[index]
            const file = files[index]
            if (!blob || !slide || !file || (file as any).isExternal) continue
            beginLocalSave(slide.id)
            try {
              await localMedia.saveBlob({
                key: slide.id,
                groupId: slide.id,
                category: "slide",
                kind: blob.type.includes("audio")
                  ? "audio"
                  : blob.type.includes("video")
                  ? "video"
                  : "image",
                blob,
                mimeType: blob.type,
                originalName: file.name,
                recoverable: false,
                userInitiated: true,
                onProgress: (fraction) =>
                  setLocalSaveProgress(slide.id, fraction),
              })
              const localUrl = await localMedia.getPlaybackUrl(slide.id)
              if (localUrl && slide.data) {
                ;(slide.data as ExtendedFileT).url = localUrl
                if (!blob.type.includes("audio")) slide.background = localUrl
              }
              completeLocalSave(slide.id)
              delete file.blob
            } catch (error) {
              failLocalSave(slide.id, error)
              throw error
            }
          }

          // 2c — Upload compressed image blobs to the cloud (every plan gets
          // durable cross-device storage up to its quota — 100MB free, 5GB
          // Teams — the server rejects with a quota error once exceeded).
          // Promise.all ensures batchCreateSlides never fires until every image
          // upload has finished.
          const remoteUrls = new Map<number, string>()
          let quotaExceeded = false
          // Videos are the heaviest thing a church can push to the cloud, so
          // they get their own opt-out (Settings → Storage). Off means the video
          // stays device-local; images and audio are unaffected.
          const uploadVideos =
            appStore.currentState.settings.uploadVideosToCloud !== false
          if (navigator.onLine) {
            const uploadPromises = files.map(async (file: ExtendedFileT, index: number) => {
              const blob = compressedBlobs[index]
              // Upload image and video files for durable, cross-device storage.
              // (Videos pass through compressedBlobs uncompressed, so the blob is
              // the original.) The local durable copy remains the playback
              // source on every device — the hosted URL is only a fetch fallback.
              // Audio and external files are still skipped.
              const isVideo = !!blob?.type?.includes("video")
              const isUploadable =
                !!blob &&
                (blob.type?.includes("image") ||
                  (isVideo && uploadVideos) ||
                  blob.type?.includes("audio"))
              if (isVideo && !uploadVideos) {
                await localMedia.setCloudSyncState(newSlides[index]!.id, {
                  groupId: newSlides[index]!.id,
                  status: "local-only",
                  reason: "disabled",
                })
              }
              if (!isUploadable || !blob) return null
              try {
                // useUploadFile routes small images through the direct path and
                // videos (which exceed 5 MB / are media) through the presigned
                // multipart path. Pass the original filename so the server-side
                // record and multipart initiation carry a meaningful name.
                const uploaded = await useUploadFile(blob, { name: file.name })
                return { uploaded, index }
              } catch (err) {
                const storedSlide = newSlides[index]
                if (storedSlide) {
                  await localMedia.setCloudSyncState(storedSlide.id, {
                    groupId: storedSlide.id,
                    status: "failed",
                    reason: mediaCloudFailureReason(err),
                    error: err,
                  })
                }
                if (/quota|storage limit|storage full/i.test(String(err))) {
                  quotaExceeded = true
                } else {
                  console.error("Image upload failed for", file.name, err)
                }
                return null
              }
            })

            // Wait for ALL uploads to complete before proceeding to the batch call
            const results = await Promise.all(uploadPromises)

            // 2d — Record hosted URLs for the server copy. The active local
            // slides keep platform playback URLs.
            for (const res of results) {
              if (!res?.uploaded) continue
              remoteUrls.set(res.index, res.uploaded.file.url)
              const storedSlide = newSlides[res.index]
              if (storedSlide) {
                await localMedia.setCloudSyncState(storedSlide.id, {
                  groupId: storedSlide.id,
                  status: "uploaded",
                  remoteUrl: res.uploaded.file.url,
                })
              }
            }
          }

          if (quotaExceeded) {
            toast.add({
              title: isTeamsPlan.value
                ? "Cloud storage full"
                : "Free cloud storage full",
              description: isTeamsPlan.value
                ? "This media will only be available on this device until you free up cloud storage."
                : "This media will only be available on this device. Upgrade to Teams for 5GB of synced cloud storage.",
              icon: "i-bx-cloud",
              color: "amber",
            })
          }

          // 2e — POST all new slides to the backend with their final URLs
          const sanitizedSlides = newSlides.map((slide, index) => {
            const sanitizedSlide = { ...slide }
            const remoteUrl = remoteUrls.get(index)
            const file = files[index]
            if (sanitizedSlide.data && typeof sanitizedSlide.data === "object") {
              const sanitizedData = {
                ...(sanitizedSlide.data as unknown as Record<string, unknown>)
              }
              delete sanitizedData.blob
              if (!(file as any)?.isExternal && "url" in sanitizedData) {
                sanitizedData.url = remoteUrl || ""
              }
              sanitizedSlide.data = sanitizedData as unknown as typeof sanitizedSlide.data
            }
            if (
              !(file as any)?.isExternal &&
              (slide.data as any)?.type !== "audio"
            ) {
              sanitizedSlide.background = remoteUrl || ""
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

          // 2f — Broadcast to other clients only after server confirms creation
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
   * │  Step 2 (async,  a. Persist each page in local storage  │
   * │  background)        (survives reload).                  │
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
    tempSlide.backgroundVideoKey = null
    tempSlide.backgroundImageKey = null
    tempSlide.contents = []

      // ── Step 2 — background ───────────────────────────────────────────────
      ; (async () => {
        const { isTeamsPlan } = useSubscription()
        const { createSlide } = useSlides()
        const nuxtApp = useNuxtApp()
        const socket = nuxtApp.$socketio as any

        beginLocalSave(tempSlide.id)
        let localSaveFailed = false
        let quotaExceeded = false
        const remotePageUrls = new Map<number, string>()
        for (const obj of presentationObjects) {
          try {
            const blobResponse = await fetch(obj.imageUrl)
            const blob = await blobResponse.blob()

            // 2a — Persist to the platform media store.
            await localMedia.saveBlob({
              key: `${tempSlide.id}-page-${obj.page}`,
              groupId: tempSlide.id,
              category: "presentation-page",
              kind: "image",
              blob,
              mimeType: "image/png",
              originalName: `${fileName}-page-${obj.page}.png`,
              recoverable: false,
              userInitiated: true,
              onProgress: (fraction) =>
                setLocalSaveProgress(tempSlide.id, fraction),
            })
            const localUrl = await localMedia.getPlaybackUrl(
              `${tempSlide.id}-page-${obj.page}`
            )
            if (localUrl) {
              obj.imageUrl = localUrl
              if (obj.page === 1) tempSlide.background = localUrl
            }

            // 2b — Upload to cloud (every plan, up to its storage quota — the
            // server rejects with a quota error once exceeded).
            if (navigator.onLine) {
              try {
                const uploaded = await useUploadImage(blob)
                remotePageUrls.set(obj.page, uploaded.file.url)
                await localMedia.setCloudSyncState(
                  `${tempSlide.id}-page-${obj.page}`,
                  {
                    groupId: tempSlide.id,
                    status: "uploaded",
                    remoteUrl: uploaded.file.url,
                  }
                )
              } catch (uploadErr) {
                await localMedia.setCloudSyncState(
                  `${tempSlide.id}-page-${obj.page}`,
                  {
                    groupId: tempSlide.id,
                    status: "failed",
                    reason: mediaCloudFailureReason(uploadErr),
                    error: uploadErr,
                  }
                )
                if (/quota|storage limit|storage full/i.test(String(uploadErr))) {
                  quotaExceeded = true
                } else {
                  console.error(`Cloud upload failed for page ${obj.page}:`, uploadErr)
                }
              }
            }
          } catch (err) {
            localSaveFailed = true
            console.error(`Failed to process presentation page ${obj.page}:`, err)
          }
        }
        if (localSaveFailed) {
          failLocalSave(
            tempSlide.id,
            "One or more presentation pages could not be saved locally."
          )
          return
        }
        completeLocalSave(tempSlide.id)

        if (quotaExceeded) {
          toast.add({
            title: isTeamsPlan.value
              ? "Cloud storage full"
              : "Free cloud storage full",
            description: isTeamsPlan.value
              ? "This presentation will only be available on this device until you free up cloud storage."
              : "This presentation will only be available on this device. Upgrade to Teams for 5GB of synced cloud storage.",
            icon: "i-bx-cloud",
            color: "amber",
          })
        }

        // 2c — Create a transport-safe server copy. Local object URLs never
        // leave this document and each projection window resolves its own URL.
        const serverPresentationObjects = presentationObjects.map((obj) => ({
          ...obj,
          imageUrl: remotePageUrls.get(obj.page) || "",
        }))
        const serverSlide: Slide = {
          ...tempSlide,
          presentationObjects: serverPresentationObjects,
          background: remotePageUrls.get(1) || "",
        }
        let createdSlide: Slide | null = null
        try {
          createdSlide = await createSlide(serverSlide)
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
    tempSlide.backgroundImageKey =
      appStore.currentState.settings.defaultBackground.hymn?.backgroundImageKey
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

  const createTimeSlide = (label = ""): Slide => {
    const tempSlide = { ...preSlideCreation() }
    const timeData: TimeSlideData = { id: useID(), label }

    tempSlide.layout = slideLayoutTypes.time
    tempSlide.type = slideTypes.time
    tempSlide.slideMode = "slide"
    tempSlide.data = timeData
    tempSlide.name = "Live Time"
    tempSlide.contents = useSlideContent(tempSlide, timeData)
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: 17.5,
      alignment: "center",
      font: appStore.currentState.settings.defaultFont,
    }
    usePosthogCapture("NEW_TIME_SLIDE_CREATED")
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
    createTimeSlide,
    createPresentationSlide,
    saveSlideToLib,
    duplicateSlide,
    duplicateSlideAsOverlay,
  }
}
