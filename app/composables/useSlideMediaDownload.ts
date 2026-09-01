import type { ExtendedFileT, Slide } from "~/types"

/**
 * Saves the media a slide is built from to the user's own machine — the
 * Downloads folder on desktop, the browser's download flow on the web.
 *
 * Bytes always come from the local media store (via `useSlideMediaCache`), so a
 * slide whose media only lives in the cloud is fetched down first.
 */

// Fallbacks for media whose slide name carries no extension (cloud-restored
// slides, presets). Only the formats the app actually accepts are listed.
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
}

const EXTENSION_BY_KIND: Record<string, string> = {
  image: "jpg",
  video: "mp4",
  audio: "mp3",
}

export default function useSlideMediaDownload() {
  const { rehydrateSlideMedia } = useSlideMediaCache()
  const { isTauri } = useTauri()

  const isExternalVideo = (slide?: Slide) => {
    const type = (slide?.data as any)?.type
    return type === "youtube" || type === "vimeo"
  }

  // YouTube/Vimeo slides hold a link, not bytes, so there is nothing to save.
  const canDownloadMedia = (slide?: Slide) =>
    slide?.type === slideTypes.media && !isExternalVideo(slide)

  /**
   * "Sunday Service Promo.MP4" → "sunday_service_promo.mp4"
   * Diacritics are folded, everything else collapses to single underscores.
   */
  const slugify = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "slide"

  const extensionOf = (name?: string) => {
    const extension = name?.split(".").pop()?.toLowerCase()
    // A dotless name returns the whole string from `pop()` — reject that, and
    // anything too long or non-alphanumeric to be a real extension.
    if (!name?.includes(".") || !extension) return ""
    return /^[a-z0-9]{1,5}$/.test(extension) ? extension : ""
  }

  const fileNameFor = (slide: Slide, blob: Blob) => {
    const data = slide.data as ExtendedFileT | undefined
    const sourceName = slide.name || data?.name || "slide"
    const extension =
      extensionOf(sourceName) ||
      extensionOf(data?.name) ||
      EXTENSION_BY_MIME[blob.type?.toLowerCase()] ||
      EXTENSION_BY_MIME[(data?.type || "").toLowerCase()] ||
      EXTENSION_BY_KIND[(data?.type || "").toLowerCase()] ||
      EXTENSION_BY_KIND[blob.type?.split("/")?.[0] || ""] ||
      "bin"

    const base = sourceName.includes(".")
      ? sourceName.slice(0, sourceName.lastIndexOf("."))
      : sourceName

    return `${slugify(base)}.${extension}`
  }

  /**
   * The URL holding this slide's bytes. Audio slides keep a decorative image as
   * their background, so their file lives on `data.url` instead.
   */
  const sourceUrlFor = (slide: Slide) => {
    const data = slide.data as ExtendedFileT | undefined
    const isAudio = (data?.type || "").includes("audio")
    return (isAudio ? data?.url : slide.background) || data?.url || ""
  }

  const fetchMediaBlob = async (slide: Slide) => {
    // Pulls the media into local storage when it is not there yet, and points
    // the slide at a URL we can actually read.
    await rehydrateSlideMedia(slide, { allowDownload: true })

    const url = sourceUrlFor(slide)
    if (!url) throw new Error("This slide has no media file attached")

    const response = await fetch(url)
    if (!response.ok) throw new Error(`Media request failed (${response.status})`)
    return await response.blob()
  }

  const saveInBrowser = (blob: Blob, fileName: string) => {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = fileName
    anchor.style.display = "none"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Give the browser a beat to start the transfer before dropping the URL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  }

  /** Writes into the OS Downloads folder, never overwriting an existing file. */
  const saveOnDesktop = async (blob: Blob, fileName: string) => {
    const { writeFile, exists, BaseDirectory } = await import(
      "@tauri-apps/plugin-fs"
    )
    const dotIndex = fileName.lastIndexOf(".")
    const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
    const extension = dotIndex > 0 ? fileName.slice(dotIndex) : ""

    let candidate = fileName
    for (let suffix = 1; suffix < 100; suffix++) {
      if (!(await exists(candidate, { baseDir: BaseDirectory.Download }))) break
      candidate = `${base}_${suffix}${extension}`
    }

    await writeFile(candidate, new Uint8Array(await blob.arrayBuffer()), {
      baseDir: BaseDirectory.Download,
    })
    return candidate
  }

  const downloadSlideMedia = async (slide: Slide) => {
    const toast = useToast()

    if (!canDownloadMedia(slide)) {
      toast.add({
        icon: "i-bx-error",
        title: isExternalVideo(slide)
          ? "Online videos can't be downloaded"
          : "This slide has no media file to download",
        color: "red",
      })
      return false
    }

    try {
      const blob = await fetchMediaBlob(slide)
      const fileName = fileNameFor(slide, blob)

      if (isTauri) {
        const savedName = await saveOnDesktop(blob, fileName)
        toast.add({
          icon: "i-bx-check-circle",
          title: "Media saved",
          description: `Saved to your Downloads folder as ${savedName}`,
        })
      } else {
        saveInBrowser(blob, fileName)
        toast.add({
          icon: "i-bx-check-circle",
          title: "Media downloaded",
          description: fileName,
        })
      }

      usePosthogCapture("SLIDE_MEDIA_DOWNLOADED", {
        slide_type: slide.type,
        media_type: (slide.data as ExtendedFileT)?.type,
      })
      return true
    } catch (error) {
      console.error("Failed to download slide media", slide?.id, error)
      toast.add({
        icon: "i-bx-error",
        title: "Could not download this media",
        description:
          error instanceof Error
            ? error.message
            : "Check your connection and try again",
        color: "red",
      })
      return false
    }
  }

  return { canDownloadMedia, downloadSlideMedia }
}
