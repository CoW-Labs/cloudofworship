import { useAuthStore } from "~/store/auth"
import type { PresentationObject } from "~/types"
import { isPdfPresentationFile } from "~/utils/presentationFile"

const MAX_PAGE_EDGE_PX = 1920
const PAGE_JPEG_QUALITY = 0.9

/**
 * Converts a PPT/PPTX or PDF file to an array of PresentationObjects.
 *
 * Flow:
 * 1. POST the file to the backend `/church/:churchId/slide-convert/ppt-to-pdf`
 * 2. Backend proxies to the ops.api LibreOffice service and streams back a PDF
 * 3. PDF.js renders each page to a canvas and produces a blob URL
 *
 * NOTE: Uses native fetch (not useAPIFetch/useFetch) because the backend returns
 * a raw binary PDF. Nuxt's useFetch always tries to JSON-parse the response body,
 * which breaks binary responses.
 */
const usePowerpointToImage = async (file: File): Promise<PresentationObject[]> => {
  const authStore = useAuthStore()
  const churchId = authStore.user?.churchId
  const config = useRuntimeConfig()
  const { getToken } = useAuthToken()

  let pdfArrayBuffer: ArrayBuffer

  if (isPdfPresentationFile(file)) {
    // PDF: read directly in the browser — no backend round-trip needed
    pdfArrayBuffer = await file.arrayBuffer()
  } else {
    // PPT/PPTX: upload to backend which proxies to ops.api LibreOffice and returns a PDF
    // NOTE: Uses native fetch (not useAPIFetch/useFetch) because the backend returns
    // a raw binary PDF. Nuxt's useFetch always tries to JSON-parse the response body,
    // which breaks binary responses.
    const formData = new FormData()
    formData.append("file", file)

    const token = getToken()
    const response = await fetch(
      `${config.public.BASE_URL}/church/${churchId}/slide-convert/ppt-to-pdf`,
      {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(config.public.NODE_ENV === "development"
            ? { "x-dev-token": config.public.DEV_TOKEN as string }
            : {}),
        },
      }
    )

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as any)?.message || `Conversion failed: ${response.status}`)
    }

    pdfArrayBuffer = await response.arrayBuffer()
  }

  // Load PDF with PDF.js and render each page to a blob URL
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString()

  // Each document gets its own pdf.js worker thread, which only stops on
  // destroy(). Without it every import kept a thread and the whole parsed file
  // in memory for the rest of the session.
  const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer })
  const presentationObjects: PresentationObject[] = []

  try {
    const pdfDoc = await loadingTask.promise
    const totalPages = pdfDoc.numPages

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      // 1.5x keeps small pages (Letter, A4) sharp; big ones (Canva's 1440pt
      // slides) are held to a 1080p projector's long edge instead of 2160px.
      const { width, height } = page.getViewport({ scale: 1 })
      const scale = Math.min(1.5, MAX_PAGE_EDGE_PX / Math.max(width, height))
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement("canvas")
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext("2d")!
      // JPEG has no alpha: paint white so a page without its own background
      // doesn't come out black.
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      await page.render({ canvasContext: ctx, viewport, canvas }).promise

      // JPEG, not PNG: a photo-heavy page as PNG ran past 1 MB and the upload
      // was refused, while the same page as JPEG is a few hundred KB.
      const imageUrl = await new Promise<string>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error(`Failed to render page ${pageNum}`))
            resolve(URL.createObjectURL(blob))
          },
          "image/jpeg",
          PAGE_JPEG_QUALITY
        )
      })

      presentationObjects.push({ page: pageNum, imageUrl })

      // Let go of the page's parsed data and the canvas's pixels (up to 8 MB a
      // page) now, not whenever garbage collection gets round to a long deck.
      page.cleanup()
      canvas.width = 0
      canvas.height = 0
    }
  } finally {
    await loadingTask.destroy().catch(() => {})
  }

  return presentationObjects
}

export default usePowerpointToImage
