import type {
  ExtendedFileT,
  LocalMediaCategory,
  LocalMediaKind,
  Slide,
} from "~/types"

/**
 * Local-first media resolution for operator, projection, and livestream
 * documents. Binary bytes are stored by useLocalMediaStorage in OPFS on the
 * web and AppLocalData in Tauri. Every document resolves its own playback URL.
 */
export type RehydrateOptions = {
  allowDownload?: boolean
  /**
   * Keep retrying in the background when media that exists in the cloud could
   * not be pulled down (weak or dropped connection). Defaults to the value of
   * `allowDownload`, so a pass that was allowed to download is also allowed to
   * recover on its own instead of leaving the slide blank until a reload.
   */
  retry?: boolean
  /**
   * Called with the freshly resolved slide after a background retry succeeds.
   * Callers that rehydrate a detached copy (the projection window) need this
   * to re-apply the URLs; callers that pass the store's own object do not,
   * because rehydration writes into it in place.
   */
  onRecovered?: (slide: Slide) => void
}

export default function useSlideMediaCache() {
  const localMedia = useLocalMediaStorage()
  const { beginDownload, setProgress, endDownload } = useMediaDownloadProgress()
  const { retryMediaUntilResolved, cancelMediaRetry } = useMediaRetryQueue()

  const isOutOfSpace = (error: unknown) =>
    (error as DOMException)?.name === "QuotaExceededError"

  const isRemoteUrl = (url?: string | null): url is string =>
    !!url && (url.startsWith("http://") || url.startsWith("https://"))

  const mediaKind = (type?: string): LocalMediaKind => {
    if (type?.includes("audio")) return "audio"
    if (type?.includes("video")) return "video"
    return "image"
  }

  /**
   * Keys whose bytes are recoverable from the cloud but are not on this device
   * yet — the download was never attempted, or it failed. A key with no remote
   * source at all is never collected: no amount of retrying will find it.
   */
  type PendingCollector = { keys: string[] }

  const resolveLocalUrl = async (
    key: string,
    source: {
      url?: string
      category: LocalMediaCategory
      kind: LocalMediaKind
      groupId?: string
      mimeType?: string
    },
    allowDownload: boolean,
    pending?: PendingCollector
  ) => {
    const remoteUrl =
      allowDownload && isRemoteUrl(source.url) ? source.url : undefined
    if (remoteUrl) beginDownload(key)
    try {
      const url = await localMedia.ensureLocal(key, {
        ...source,
        url: remoteUrl,
        recoverable: !!remoteUrl,
        onProgress: (fraction) =>
          setProgress(key, Number.isFinite(fraction) ? fraction * 100 : Number.NaN),
      })
      // No local copy came back even though a cloud copy exists: the fetch was
      // refused or the connection dropped mid-stream. Worth another attempt.
      if (!url && remoteUrl) pending?.keys.push(key)
      return url
    } catch (error) {
      if (remoteUrl) {
        // A full disk is not a connectivity problem — retrying it just burns
        // bandwidth on a write that cannot land.
        if (!isOutOfSpace(error)) pending?.keys.push(key)
        console.warn(`Local media download failed for ${key}:`, error)
        return null
      }
      throw error
    } finally {
      if (remoteUrl) endDownload(key)
    }
  }

  const rehydrateMediaSlide = async (
    slide: Slide,
    allowDownload: boolean,
    pending?: PendingCollector
  ) => {
    const data = slide.data as ExtendedFileT | undefined
    const kind = mediaKind(data?.type || slide.backgroundType)
    const candidateUrl =
      kind === "audio"
        ? data?.url || slide.mediaCloudSync?.[slide.id]?.remoteUrl
        : isRemoteUrl(slide.background)
        ? slide.background
        : data?.url || slide.mediaCloudSync?.[slide.id]?.remoteUrl
    const fileUrl = await resolveLocalUrl(
      slide.id,
      {
        url: candidateUrl,
        category: "slide",
        kind,
        groupId: slide.id,
        mimeType: data?.type,
      },
      allowDownload,
      pending
    )
    if (!fileUrl) return slide

    if (slide.data) (slide.data as ExtendedFileT).url = fileUrl
    if (kind !== "audio") slide.background = fileUrl
    return slide
  }

  const rehydratePresentationSlide = async (
    slide: Slide,
    allowDownload: boolean,
    pending?: PendingCollector
  ) => {
    const restored: NonNullable<Slide["presentationObjects"]> = []
    for (const obj of slide.presentationObjects ?? []) {
      const key = `${slide.id}-page-${obj.page}`
      const remoteUrl = obj.imageUrl || slide.mediaCloudSync?.[key]?.remoteUrl
      let url: string | null = null
      try {
        url = await resolveLocalUrl(
          key,
          {
            url: remoteUrl,
            category: "presentation-page",
            kind: "image",
            groupId: slide.id,
            mimeType: "image/png",
          },
          allowDownload,
          pending
        )
      } catch (error) {
        // One unreadable page must not cost the deck its other pages, which is
        // what an escaping throw did — the whole `restored` list was discarded.
        console.warn(`Presentation page ${key} could not be resolved:`, error)
        if (isRemoteUrl(remoteUrl)) pending?.keys.push(key)
      }
      restored.push(url ? { page: obj.page, imageUrl: url } : obj)
    }
    slide.presentationObjects = restored
    slide.background =
      restored[slide.presentationPageIndex ?? 0]?.imageUrl || slide.background
    return slide
  }

  const rehydrateBackgroundVideoSlide = async (
    slide: Slide,
    allowDownload: boolean,
    pending?: PendingCollector
  ) => {
    const key = slide.backgroundVideoKey as string
    const fileUrl = await resolveLocalUrl(
      key,
      {
        url:
          slide.background || slide.mediaCloudSync?.[key]?.remoteUrl,
        category: key.startsWith("/video-bg-") ? "preset" : "background",
        kind: "video",
        groupId: key,
        mimeType: "video/mp4",
      },
      allowDownload,
      pending
    )
    if (fileUrl) slide.background = fileUrl
    return slide
  }

  const rehydrateBackgroundImageSlide = async (
    slide: Slide,
    allowDownload: boolean,
    pending?: PendingCollector
  ) => {
    const key = slide.backgroundImageKey as string
    const fileUrl = await resolveLocalUrl(
      key,
      {
        url:
          slide.background || slide.mediaCloudSync?.[key]?.remoteUrl,
        category: key.startsWith("/preset-image-bg-")
          ? "preset"
          : "background",
        kind: "image",
        groupId: key,
      },
      allowDownload,
      pending
    )
    if (fileUrl) slide.background = fileUrl
    return slide
  }


  const rehydrateOnce = async (
    slide: Slide,
    allowDownload: boolean,
    pending: PendingCollector
  ) => {
    try {
      if (slide.type === slideTypes.media) {
        const fileType = (slide.data as any)?.type
        if (fileType === "youtube" || fileType === "vimeo") return slide
        await rehydrateMediaSlide(slide, allowDownload, pending)
      }
      if (
        slide.type === slideTypes.presentation &&
        slide.presentationObjects?.length
      ) {
        await rehydratePresentationSlide(slide, allowDownload, pending)
      }
      if (slide.backgroundImageKey) {
        await rehydrateBackgroundImageSlide(slide, allowDownload, pending)
      }
      if (slide.backgroundVideoKey) {
        await rehydrateBackgroundVideoSlide(slide, allowDownload, pending)
      }
    } catch (error) {
      console.error("rehydrateSlideMedia failed for slide", slide?.id, error)
    }
    return slide
  }

  /**
   * Resolve a slide's media against local storage, reporting the keys that are
   * still only in the cloud so the caller can decide whether to wait for them.
   */
  const rehydrateSlideMediaWithStatus = async (
    slide: Slide,
    opts: RehydrateOptions = {}
  ): Promise<{ slide: Slide; pendingKeys: string[] }> => {
    const allowDownload = opts.allowDownload ?? false
    const pending: PendingCollector = { keys: [] }
    await rehydrateOnce(slide, allowDownload, pending)

    const shouldRetry = opts.retry ?? allowDownload
    if (!shouldRetry || !slide?.id) {
      return { slide, pendingKeys: pending.keys }
    }

    if (!pending.keys.length) {
      cancelMediaRetry(slide.id)
      return { slide, pendingKeys: pending.keys }
    }

    // Retry against the same slide object so an in-place URL swap reaches the
    // DOM, and hand the result to `onRecovered` for callers holding a copy.
    retryMediaUntilResolved(slide.id, async () => {
      const retryPending: PendingCollector = { keys: [] }
      await rehydrateOnce(slide, true, retryPending)
      if (retryPending.keys.length) return false
      opts.onRecovered?.(slide)
      return true
    })

    return { slide, pendingKeys: pending.keys }
  }

  const rehydrateSlideMedia = async (
    slide: Slide,
    opts: RehydrateOptions = {}
  ): Promise<Slide> => (await rehydrateSlideMediaWithStatus(slide, opts)).slide

  /**
   * Prefetch all downloadable media referenced by the selected schedule. The
   * live slide is first, then schedule order, with bounded concurrency.
   */
  const prefetchScheduleMedia = async (
    slides: Slide[],
    liveSlideId?: string | null
  ) => {
    const ordered = [...(slides || [])].sort((a, b) => {
      if (a.id === liveSlideId) return -1
      if (b.id === liveSlideId) return 1
      return 0
    })
    const batchSize = 2
    for (let index = 0; index < ordered.length; index += batchSize) {
      await Promise.all(
        ordered
          .slice(index, index + batchSize)
          .map((slide) =>
            rehydrateSlideMedia(slide, { allowDownload: true })
          )
      )
    }
  }

  return {
    rehydrateSlideMedia,
    rehydrateSlideMediaWithStatus,
    prefetchScheduleMedia,
  }
}
