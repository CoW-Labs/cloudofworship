import type {
  ExtendedFileT,
  LocalMediaCategory,
  LocalMediaKind,
  Slide,
} from "~/types"
import { isRetryableMediaDownloadError } from "~/utils/mediaDownloadErrors"

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
  const { setProgress, endDownload } = useMediaDownloadProgress()
  const { retryMediaUntilResolved, cancelMediaRetry } = useMediaRetryQueue()

  // `withProgress` in the storage layer only wraps a stream it is actually
  // reading, so the first call marks the point where bytes started moving.
  const reportProgress = (key: string, fraction: number) =>
    setProgress(key, Number.isFinite(fraction) ? fraction * 100 : Number.NaN)

  const isRemoteUrl = (url?: string | null): url is string =>
    !!url && (url.startsWith("http://") || url.startsWith("https://"))

  /**
   * The first candidate that can actually be fetched over the network.
   *
   * A slide rehydrated earlier in this session carries a blob:/asset: URL on
   * `background` and `data.url`, and those used to shadow the cloud copy: the
   * `||` chain stopped at the first truthy value, `isRemoteUrl` then rejected
   * that session URL, and the download was never attempted — even though
   * `mediaCloudSync` further down the chain knew exactly where the bytes were.
   */
  const firstRemoteUrl = (
    ...candidates: (string | null | undefined)[]
  ): string | undefined => candidates.find(isRemoteUrl)

  /**
   * Remember where a file was fetched from before its URL is overwritten.
   *
   * Rehydration replaces `background` and `data.url` with the device-local
   * playback URL, and on slides that carry no `mediaCloudSync` entry that
   * erased the only pointer to the cloud copy. A later pass in the same
   * session — after the local bytes were evicted, or the blob revoked — then
   * had nothing remote left to fall back on and left the slide aimed at a dead
   * blob: URL, even though the durable row still knew the CDN address.
   *
   * `mediaCloudSync` is where a cloud location already belongs, it is already
   * the last candidate `firstRemoteUrl` consults, and it survives transport.
   */
  const rememberRemoteUrl = (slide: Slide, key: string, url?: string) => {
    if (!isRemoteUrl(url)) return
    const existing = slide.mediaCloudSync?.[key]
    if (existing?.remoteUrl) return
    const now = new Date().toISOString()
    slide.mediaCloudSync = {
      ...(slide.mediaCloudSync || {}),
      [key]: {
        key,
        groupId: existing?.groupId || slide.id,
        status: existing?.status || "uploaded",
        ...existing,
        remoteUrl: url,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      },
    }
  }

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
  type PendingCollector = {
    keys: Set<string>
    retryableKeys: Set<string>
  }

  const collectPending = (
    pending: PendingCollector | undefined,
    key: string,
    retryable: boolean
  ) => {
    pending?.keys.add(key)
    if (retryable) pending?.retryableKeys.add(key)
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
    allowDownload: boolean,
    pending?: PendingCollector,
    signal?: AbortSignal,
    heartbeat?: () => void
  ) => {
    const remoteUrl =
      allowDownload && isRemoteUrl(source.url) ? source.url : undefined
    // Deliberately not opened here. A remote URL only means the bytes *may*
    // need fetching — `ensureLocal` returns straight from the local copy most
    // of the time, and opening the entry up front bracketed that local hit too:
    // the key appeared and vanished within a couple of frames, so every UI
    // watching `isDownloading` flickered for ~20ms instead of showing a loader.
    // The first progress chunk below only fires on a real network transfer.
    try {
      heartbeat?.()
      const url = await localMedia.ensureLocal(key, {
        ...source,
        url: remoteUrl,
        recoverable: !!remoteUrl,
        signal,
        onProgress: (fraction) => {
          heartbeat?.()
          reportProgress(key, fraction)
        },
      })
      // No local copy came back even though a cloud copy exists: the fetch was
      // refused or the connection dropped mid-stream. Worth another attempt.
      if (!url && remoteUrl) collectPending(pending, key, true)
      return url
    } catch (error) {
      if (remoteUrl) {
        collectPending(pending, key, isRetryableMediaDownloadError(error))
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
    pending?: PendingCollector,
    signal?: AbortSignal,
    heartbeat?: () => void
  ) => {
    const data = slide.data as ExtendedFileT | undefined
    const kind = mediaKind(data?.type || slide.backgroundType)
    // Audio slides keep a decorative image on `background`, so their file is
    // only ever on `data.url` — everything else prefers the background.
    const candidateUrl =
      kind === "audio"
        ? firstRemoteUrl(
            data?.url,
            slide.mediaCloudSync?.[slide.id]?.remoteUrl
          )
        : firstRemoteUrl(
            slide.background,
            data?.url,
            slide.mediaCloudSync?.[slide.id]?.remoteUrl
          )
    rememberRemoteUrl(slide, slide.id, candidateUrl)
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
      pending,
      signal,
      heartbeat
    )
    if (!fileUrl) return slide

    if (slide.data) (slide.data as ExtendedFileT).url = fileUrl
    if (kind !== "audio") slide.background = fileUrl
    return slide
  }

  const rehydratePresentationSlide = async (
    slide: Slide,
    allowDownload: boolean,
    pending?: PendingCollector,
    signal?: AbortSignal,
    onlyKeys?: ReadonlySet<string>,
    heartbeat?: () => void
  ) => {
    const restored: NonNullable<Slide["presentationObjects"]> = []
    for (const obj of slide.presentationObjects ?? []) {
      const key = `${slide.id}-page-${obj.page}`
      if (onlyKeys && !onlyKeys.has(key)) {
        restored.push(obj)
        continue
      }
      const remoteUrl = firstRemoteUrl(
        obj.imageUrl,
        slide.mediaCloudSync?.[key]?.remoteUrl
      )
      rememberRemoteUrl(slide, key, remoteUrl)
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
          pending,
          signal,
          heartbeat
        )
      } catch (error) {
        // One unreadable page must not cost the deck its other pages, which is
        // what an escaping throw did — the whole `restored` list was discarded.
        console.warn(`Presentation page ${key} could not be resolved:`, error)
        if (isRemoteUrl(remoteUrl)) {
          collectPending(pending, key, isRetryableMediaDownloadError(error))
        }
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
    pending?: PendingCollector,
    signal?: AbortSignal,
    heartbeat?: () => void
  ) => {
    const key = slide.backgroundVideoKey as string
    const remoteUrl = firstRemoteUrl(
      slide.background,
      slide.mediaCloudSync?.[key]?.remoteUrl
    )
    rememberRemoteUrl(slide, key, remoteUrl)
    const fileUrl = await resolveLocalUrl(
      key,
      {
        url: remoteUrl,
        category: key.startsWith("/video-bg-") ? "preset" : "background",
        kind: "video",
        groupId: key,
        mimeType: "video/mp4",
      },
      allowDownload,
      pending,
      signal,
      heartbeat
    )
    if (fileUrl) slide.background = fileUrl
    return slide
  }

  const rehydrateBackgroundImageSlide = async (
    slide: Slide,
    allowDownload: boolean,
    pending?: PendingCollector,
    signal?: AbortSignal,
    heartbeat?: () => void
  ) => {
    const key = slide.backgroundImageKey as string
    const remoteUrl = firstRemoteUrl(
      slide.background,
      slide.mediaCloudSync?.[key]?.remoteUrl
    )
    rememberRemoteUrl(slide, key, remoteUrl)
    const fileUrl = await resolveLocalUrl(
      key,
      {
        url: remoteUrl,
        category: key.startsWith("/preset-image-bg-")
          ? "preset"
          : "background",
        kind: "image",
        groupId: key,
      },
      allowDownload,
      pending,
      signal,
      heartbeat
    )
    if (fileUrl) slide.background = fileUrl
    return slide
  }


  const rehydrateOnce = async (
    slide: Slide,
    allowDownload: boolean,
    pending: PendingCollector,
    options?: {
      signal?: AbortSignal
      onlyKeys?: ReadonlySet<string>
      heartbeat?: () => void
    }
  ) => {
    try {
      if (slide.type === slideTypes.media) {
        const fileType = (slide.data as any)?.type
        if (fileType === "youtube" || fileType === "vimeo") return slide
        if (!options?.onlyKeys || options.onlyKeys.has(slide.id)) {
          await rehydrateMediaSlide(
            slide,
            allowDownload,
            pending,
            options?.signal,
            options?.heartbeat
          )
        }
      }
      if (
        slide.type === slideTypes.presentation &&
        slide.presentationObjects?.length
      ) {
        await rehydratePresentationSlide(
          slide,
          allowDownload,
          pending,
          options?.signal,
          options?.onlyKeys,
          options?.heartbeat
        )
      }
      if (
        slide.backgroundImageKey &&
        (!options?.onlyKeys || options.onlyKeys.has(slide.backgroundImageKey))
      ) {
        await rehydrateBackgroundImageSlide(
          slide,
          allowDownload,
          pending,
          options?.signal,
          options?.heartbeat
        )
      }
      if (
        slide.backgroundVideoKey &&
        (!options?.onlyKeys || options.onlyKeys.has(slide.backgroundVideoKey))
      ) {
        await rehydrateBackgroundVideoSlide(
          slide,
          allowDownload,
          pending,
          options?.signal,
          options?.heartbeat
        )
      }
    } catch (error) {
      console.error("rehydrateSlideMedia failed for slide", slide?.id, error)
    }
    return slide
  }

  const mediaSourceFingerprint = (slide: Slide) => {
    const sources: string[] = [slide.id]
    const add = (key: string, ...urls: (string | null | undefined)[]) => {
      sources.push(`${key}:${firstRemoteUrl(...urls) || ""}`)
    }

    if (slide.type === slideTypes.media) {
      const data = slide.data as ExtendedFileT | undefined
      const kind = mediaKind(data?.type || slide.backgroundType)
      if (kind === "audio") {
        add(slide.id, data?.url, slide.mediaCloudSync?.[slide.id]?.remoteUrl)
      } else {
        add(
          slide.id,
          slide.background,
          data?.url,
          slide.mediaCloudSync?.[slide.id]?.remoteUrl
        )
      }
    }
    for (const page of slide.presentationObjects || []) {
      const key = `${slide.id}-page-${page.page}`
      add(key, page.imageUrl, slide.mediaCloudSync?.[key]?.remoteUrl)
    }
    if (slide.backgroundImageKey) {
      add(
        slide.backgroundImageKey,
        slide.background,
        slide.mediaCloudSync?.[slide.backgroundImageKey]?.remoteUrl
      )
    }
    if (slide.backgroundVideoKey) {
      add(
        slide.backgroundVideoKey,
        slide.background,
        slide.mediaCloudSync?.[slide.backgroundVideoKey]?.remoteUrl
      )
    }
    return sources.join("|")
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
    const fingerprint = mediaSourceFingerprint(slide)
    const pending: PendingCollector = {
      keys: new Set<string>(),
      retryableKeys: new Set<string>(),
    }
    await rehydrateOnce(slide, allowDownload, pending)
    const pendingKeys = [...pending.keys]

    const shouldRetry = opts.retry ?? allowDownload
    if (!shouldRetry || !slide?.id) {
      return { slide, pendingKeys }
    }

    if (!pending.retryableKeys.size) {
      cancelMediaRetry(slide.id, fingerprint)
      return { slide, pendingKeys }
    }

    // Keep only keys that still need work. Large presentations no longer scan
    // every page again because one page failed to download.
    let retryKeys = new Set(pending.retryableKeys)
    const permanentKeys = new Set(
      [...pending.keys].filter((key) => !pending.retryableKeys.has(key))
    )
    retryMediaUntilResolved(
      slide.id,
      async (signal, heartbeat) => {
        const retryPending: PendingCollector = {
          keys: new Set<string>(),
          retryableKeys: new Set<string>(),
        }
        await rehydrateOnce(slide, true, retryPending, {
          signal,
          onlyKeys: retryKeys,
          heartbeat,
        })
        if (signal.aborted) return false

        for (const key of retryPending.keys) {
          if (!retryPending.retryableKeys.has(key)) permanentKeys.add(key)
        }
        retryKeys = new Set(retryPending.retryableKeys)
        if (retryKeys.size) return false

        // Stop once nothing retryable remains. Only report full recovery when
        // every original key resolved, otherwise the live window would cache a
        // partial presentation as complete.
        if (!permanentKeys.size) opts.onRecovered?.(slide)
        return true
      },
      fingerprint
    )

    return { slide, pendingKeys }
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
