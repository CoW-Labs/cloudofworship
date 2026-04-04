import { useAuthStore } from "~/store/auth"
import type { PresentationObject } from "~/types"

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

  if (file.type === "application/pdf") {
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
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString()

  const pdfDoc = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise
  const totalPages = pdfDoc.numPages
  const presentationObjects: PresentationObject[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 })

    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext("2d")!

    await page.render({ canvasContext: ctx, viewport, canvas }).promise

    const imageUrl = await new Promise<string>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error(`Failed to render page ${pageNum}`))
        resolve(URL.createObjectURL(blob))
      }, "image/png")
    })

    presentationObjects.push({ page: pageNum, imageUrl })
  }

  return presentationObjects
}

export default usePowerpointToImage
