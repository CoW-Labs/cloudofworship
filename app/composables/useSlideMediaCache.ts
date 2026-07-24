import { safeDBGet, safeDBOperation } from "~/composables/useIndexedDB"
import type { ExtendedFileT, Media, Slide } from "~/types"

/**
 * Local-first media caching for slides.
 *
 * Design principle: the cloud copy (hosted URL) exists only for durability and
 * cross-device sync. Every device plays video/media from a LOCAL IndexedDB copy
 * — it never streams the remote URL during a live service. This mirrors the
 * preset-background-video flow (`saveAllBackgroundVideos` in app.vue): download
 * once via `useDetailedFetch`, cache the blob, then serve a local object URL.
 *
 * - Media slides cache bytes in `db.media` keyed by `slide.id`.
 * - Background videos cache bytes in `db.cached` keyed by `backgroundVideoKey`.
 */
export default function useSlideMediaCache() {
  const isRemoteUrl = (url?: string | null): url is string =>
    !!url && (url.startsWith("http://") || url.startsWith("https://"))

  const toObjectUrl = (
    data: ArrayBuffer | Blob | undefined | null,
    type?: string
  ): string | null => {
    if (data instanceof Blob) return URL.createObjectURL(data)
    if (data instanceof ArrayBuffer) {
      return URL.createObjectURL(new Blob([data], { type: type || undefined }))
    }
    return null
  }

  const nowISO = () => new Date().toISOString()

  // ── Download helpers (one-time, populate IndexedDB) ──────────────────────
  // Reuse useDetailedFetch (progress-capable) exactly like saveAllBackgroundVideos.

  const downloadIntoMedia = async (id: string, url: string): Promise<void> => {
    try {
      const response = await useDetailedFetch(url, ref("0"))
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      await safeDBOperation((db) =>
        db.media.put({
          id,
          content: { size: blob.size, type: blob.type },
          data: arrayBuffer,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        })
      )
    } catch (err) {
      console.warn("Failed to download media for local cache:", id, err)
    }
  }

  const downloadIntoCached = async (id: string, url: string): Promise<void> => {
    try {
      const response = await useDetailedFetch(url, ref("0"))
      const blob = await response.blob()
      // Match saveAllBackgroundVideos' convention: store the raw Blob.
      await safeDBOperation((db) =>
        db.cached.put({
          id,
          data: blob,
          content: "video",
          createdAt: nowISO(),
          updatedAt: nowISO(),
        } as Media)
      )
    } catch (err) {
      console.warn("Failed to download background video for local cache:", id, err)
    }
  }

  // ── Per-type rehydration (IndexedDB-first → local object URL) ─────────────

  const rehydrateMediaSlide = async (
    slide: Slide,
    allowDownload: boolean
  ): Promise<Slide> => {
    const db = useIndexedDB()
    const isAudio = !!(slide.data as ExtendedFileT)?.type?.includes("audio")

    let mediaObj = await safeDBGet(db.media, slide.id)

    // Download-on-demand: no local bytes yet, but a durable remote copy exists.
    // Audio's `background` is a decorative image (not the media), so never
    // download it — audio is not uploaded to the cloud anyway.
    if (
      !mediaObj?.data &&
      allowDownload &&
      !isAudio &&
      isRemoteUrl(slide.background)
    ) {
      await downloadIntoMedia(slide.id, slide.background)
      mediaObj = await safeDBGet(db.media, slide.id)
    }

    // External videos (YouTube/Vimeo) store an ExternalVideo object, not bytes —
    // leave them untouched.
    const fileUrl = toObjectUrl(
      mediaObj?.data as ArrayBuffer | Blob | undefined,
      mediaObj?.content?.type
    )
    if (!fileUrl) return slide

    if (slide.data) (slide.data as ExtendedFileT).url = fileUrl
    if (!isAudio) slide.background = fileUrl
    return slide
  }

  const rehydratePresentationSlide = async (slide: Slide): Promise<Slide> => {
    const db = useIndexedDB()
    const restored: NonNullable<Slide["presentationObjects"]> = []
    for (const obj of slide.presentationObjects ?? []) {
      const key = `${slide.id}-page-${obj.page}`
      const mediaObj = await safeDBGet(db.media, key)
      const url = toObjectUrl(mediaObj?.data as ArrayBuffer | undefined, "image/png")
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
  ): Promise<Slide> => {
    const db = useIndexedDB()
    const key = slide.backgroundVideoKey as string

    let cached = await safeDBGet(db.cached, key)

    if (!cached?.data && allowDownload && isRemoteUrl(slide.background)) {
      await downloadIntoCached(key, slide.background)
      cached = await safeDBGet(db.cached, key)
    }

    const fileUrl = toObjectUrl(
      cached?.data as ArrayBuffer | Blob | undefined,
      cached?.content?.type
    )
    if (fileUrl) slide.background = fileUrl
    return slide
  }

  /**
   * Ensure a slide's media exists locally, then point the slide at a fresh
   * object URL created in THIS document. Mutates and returns the slide.
   *
   * The IndexedDB lookup runs regardless of whether `background` is `blob:` or
   * `https:` — so a slide whose durable URL is a hosted https link still plays
   * from its local copy instead of streaming.
   *
   * @param allowDownload when true, a not-yet-cached slide whose `background`
   *   is a remote URL is downloaded once and cached before rehydrating.
   */
  const rehydrateSlideMedia = async (
    slide: Slide,
    opts: { allowDownload?: boolean } = {}
  ): Promise<Slide> => {
    const allowDownload = opts.allowDownload ?? false
    try {
      if (slide.type === slideTypes.media) {
        return await rehydrateMediaSlide(slide, allowDownload)
      }
      if (
        slide.type === slideTypes.presentation &&
        slide.presentationObjects?.length
      ) {
        return await rehydratePresentationSlide(slide)
      }
      if (slide.backgroundVideoKey) {
        return await rehydrateBackgroundVideoSlide(slide, allowDownload)
      }
    } catch (err) {
      console.error("rehydrateSlideMedia failed for slide", slide?.id, err)
    }
    return slide
  }

  /**
   * Non-blocking background prefetch: download every not-yet-cached video slide
   * in a schedule into IndexedDB so later on-demand/live rehydrates are instant
   * and local. Only populates the cache — does not swap object URLs. Batched
   * (2 at a time), mirroring saveAllBackgroundVideos.
   */
  const prefetchScheduleMedia = async (slides: Slide[]): Promise<void> => {
    const db = useIndexedDB()
    type Target = { kind: "media" | "cached"; id: string; url: string }
    const targets: Target[] = []

    for (const slide of slides ?? []) {
      if (slide.backgroundType !== backgroundTypes.video) continue
      if (!isRemoteUrl(slide.background)) continue

      if (slide.type === slideTypes.media) {
        const existing = await safeDBGet(db.media, slide.id)
        if (!existing?.data) {
          targets.push({ kind: "media", id: slide.id, url: slide.background })
        }
      } else if (slide.backgroundVideoKey) {
        const existing = await safeDBGet(db.cached, slide.backgroundVideoKey)
        if (!existing?.data) {
          targets.push({
            kind: "cached",
            id: slide.backgroundVideoKey,
            url: slide.background,
          })
        }
      }
    }

    const batchSize = 2
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize)
      await Promise.all(
        batch.map((t) =>
          t.kind === "media"
            ? downloadIntoMedia(t.id, t.url)
            : downloadIntoCached(t.id, t.url)
        )
      )
    }
  }

  return { rehydrateSlideMedia, prefetchScheduleMedia }
}
