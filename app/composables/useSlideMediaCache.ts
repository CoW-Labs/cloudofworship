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
export default function useSlideMediaCache() {
  const localMedia = useLocalMediaStorage()
  const { beginDownload, setProgress, endDownload } = useMediaDownloadProgress()

  const isRemoteUrl = (url?: string | null): url is string =>
    !!url && (url.startsWith("http://") || url.startsWith("https://"))

  const mediaKind = (type?: string): LocalMediaKind => {
    if (type?.includes("audio")) return "audio"
    if (type?.includes("video")) return "video"
    return "image"
  }

  const resolveLocalUrl = async (
    key: string,
    source: {
      url?: string
      category: LocalMediaCategory
      kind: LocalMediaKind
      groupId?: string
      mimeType?: string
    },
    allowDownload: boolean
  ) => {
    const remoteUrl =
      allowDownload && isRemoteUrl(source.url) ? source.url : undefined
    if (remoteUrl) beginDownload(key)
    try {
      return await localMedia.ensureLocal(key, {
        ...source,
        url: remoteUrl,
        recoverable: !!remoteUrl,
        onProgress: (fraction) =>
          setProgress(key, Number.isFinite(fraction) ? fraction * 100 : Number.NaN),
      })
    } finally {
      if (remoteUrl) endDownload(key)
    }
  }

  const rehydrateMediaSlide = async (
    slide: Slide,
    allowDownload: boolean
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
      allowDownload
    )
    if (!fileUrl) return slide

    if (slide.data) (slide.data as ExtendedFileT).url = fileUrl
    if (kind !== "audio") slide.background = fileUrl
    return slide
  }

  const rehydratePresentationSlide = async (
    slide: Slide,
    allowDownload: boolean
  ) => {
    const restored: NonNullable<Slide["presentationObjects"]> = []
    for (const obj of slide.presentationObjects ?? []) {
      const key = `${slide.id}-page-${obj.page}`
      const url = await resolveLocalUrl(
        key,
        {
          url: obj.imageUrl || slide.mediaCloudSync?.[key]?.remoteUrl,
          category: "presentation-page",
          kind: "image",
          groupId: slide.id,
          mimeType: "image/png",
        },
        allowDownload
      )
      restored.push(url ? { page: obj.page, imageUrl: url } : obj)
    }
    slide.presentationObjects = restored
    slide.background =
      restored[slide.presentationPageIndex ?? 0]?.imageUrl || slide.background
    return slide
  }

  const rehydrateBackgroundVideoSlide = async (
    slide: Slide,
    allowDownload: boolean
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
      allowDownload
    )
    if (fileUrl) slide.background = fileUrl
    return slide
  }

  const rehydrateBackgroundImageSlide = async (
    slide: Slide,
    allowDownload: boolean
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
      allowDownload
    )
    if (fileUrl) slide.background = fileUrl
    return slide
  }

  const rehydrateSlideMedia = async (
    slide: Slide,
    opts: { allowDownload?: boolean } = {}
  ): Promise<Slide> => {
    const allowDownload = opts.allowDownload ?? false
    try {
      if (slide.type === slideTypes.media) {
        const fileType = (slide.data as any)?.type
        if (fileType === "youtube" || fileType === "vimeo") return slide
        await rehydrateMediaSlide(slide, allowDownload)
      }
      if (
        slide.type === slideTypes.presentation &&
        slide.presentationObjects?.length
      ) {
        await rehydratePresentationSlide(slide, allowDownload)
      }
      if (slide.backgroundImageKey) {
        await rehydrateBackgroundImageSlide(slide, allowDownload)
      }
      if (slide.backgroundVideoKey) {
        await rehydrateBackgroundVideoSlide(slide, allowDownload)
      }
    } catch (error) {
      console.error("rehydrateSlideMedia failed for slide", slide?.id, error)
    }
    return slide
  }

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

  return { rehydrateSlideMedia, prefetchScheduleMedia }
}
