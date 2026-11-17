import { useAuthStore } from "~/store/auth"
import { useAuthToken } from "~/composables/useAuthToken"

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type UploadedFile = {
  id: string
  name: string
  size: number
  type: string
  url: string
  status?: string
  createdAt: string
}

export type UploadFileResult = {
  message: string
  file: UploadedFile
}

export type UploadFileOptions = {
  /** Original filename. Falls back to `(file as File).name` then a generated name. */
  name?: string
  /** Progress callback, `fraction` is 0..1 (byte-level, across all parts in flight). */
  onProgress?: (fraction: number) => void
  /** Abort the whole upload (cancels in-flight parts and aborts the S3 upload). */
  signal?: AbortSignal
}

type ApiError = {
  data?: { message?: string }
  message?: string
  statusCode?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing constants (mirror the File Uploads API)
// ─────────────────────────────────────────────────────────────────────────────

// Path A (direct, proxied through the API) caps at 5 MB and only accepts this
// exact allowlist. Everything else — media, webp/gif, or anything larger — must
// go through Path B (presigned multipart, bytes stream straight to S3).
const PATH_A_MAX_BYTES = 5 * 1024 * 1024
const PATH_A_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "text/plain",
])

// Upload 4 parts at a time; retry a failed part a few times before giving up.
const PART_CONCURRENCY = 4
const PART_MAX_RETRIES = 3
// Waits between attempts at one part. Back to back, every attempt landed in
// the same dropped-connection blip and the whole upload was abandoned.
const PART_RETRY_DELAYS_MS = [1000, 3000]

// Path A gets the same patience. A church uploading from a phone on patchy
// venue Wi-Fi lost single PDF pages to one dropped request, because nothing
// ever asked twice.
const DIRECT_MAX_ATTEMPTS = 3
const DIRECT_RETRY_DELAYS_MS = [1000, 3000]

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const abortError = () => new DOMException("Upload aborted", "AbortError")

const waitUnlessAborted = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })

/**
 * A 4xx is the server saying no (quota, bad type, too large, signed out) and
 * will say it again; only a dropped request or a 5xx is worth repeating.
 */
const isRetryableUploadError = (error: ApiError | null | undefined) => {
  const status = error?.statusCode
  if (/quota|storage limit|storage full/i.test(errorMessage(error, ""))) {
    return false
  }
  return !status || status >= 500 || status === 408 || status === 429
}

const errorMessage = (error: ApiError | null | undefined, fallback: string) =>
  error?.data?.message || error?.message || fallback

const resolveName = (file: Blob, options?: UploadFileOptions): string => {
  if (options?.name) return options.name
  const fileName = (file as File).name
  if (fileName) return fileName
  const ext = file.type?.split("/")?.[1]
  return ext ? `upload-${Date.now()}.${ext}` : `upload-${Date.now()}`
}

/**
 * Decide which upload path a file takes. Route to the direct path only for the
 * types the API's Path A actually accepts and under its 5 MB cap; send media
 * (video/audio), webp/gif, and anything larger through the multipart path.
 */
const usesDirectPath = (file: Blob): boolean =>
  file.size <= PATH_A_MAX_BYTES && PATH_A_TYPES.has(file.type)

// ─────────────────────────────────────────────────────────────────────────────
// Path A — direct upload (small non-media files)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST one file with XMLHttpRequest, the only browser API that reports how many
 * bytes have left. Mirrors what `useAPIFetch` adds for a request (base URL,
 * bearer token, dev token) and what it does on a 401, and rejects with the same
 * `{ statusCode, data: { message } }` shape `$fetch` errors have, so the retry
 * rules below do not care which one produced the error.
 */
const xhrPostForm = (
  path: string,
  formData: FormData,
  options?: UploadFileOptions
): Promise<UploadFileResult> =>
  new Promise((resolve, reject) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return reject(new Error("No internet connection"))
    }
    if (options?.signal?.aborted) return reject(abortError())

    const config = useRuntimeConfig()
    const authStore = useAuthStore()
    const token = useAuthToken().getToken()

    const xhr = new XMLHttpRequest()
    xhr.open("POST", `${config.public.BASE_URL}${path}`)
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    if (config.public.NODE_ENV === "development") {
      xhr.setRequestHeader("x-dev-token", String(config.public.DEV_TOKEN))
    }
    xhr.responseType = "json"

    const onAbort = () => xhr.abort()
    options?.signal?.addEventListener("abort", onAbort, { once: true })
    const cleanup = () => options?.signal?.removeEventListener("abort", onAbort)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !event.total) return
      // The last bit belongs to the server's reply, so it is not "done" yet.
      options?.onProgress?.(Math.min(0.99, event.loaded / event.total))
    }

    xhr.onload = () => {
      cleanup()
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        return resolve(xhr.response as UploadFileResult)
      }
      if (xhr.status === 401) {
        authStore.signOut()
        useToast().add({
          title: "Your session has expired",
          color: "red",
          icon: "i-bx-error",
        })
      }
      const body = (xhr.response || {}) as { message?: string }
      const error: ApiError = {
        statusCode: xhr.status,
        data: { message: body.message },
        message: body.message || `Upload failed: ${xhr.status}`,
      }
      reject(error)
    }
    xhr.onerror = () => {
      cleanup()
      reject(new Error("Network error during upload"))
    }
    xhr.onabort = () => {
      cleanup()
      reject(abortError())
    }

    xhr.send(formData)
  })

const directUpload = async (
  churchId: string,
  file: Blob,
  name: string,
  options?: UploadFileOptions
): Promise<UploadFileResult> => {
  for (let attempt = 1; ; attempt++) {
    const formData = new FormData()
    formData.append("file", file, name)

    let failure: ApiError | null = null
    try {
      return await xhrPostForm(`/church/${churchId}/files`, formData, options)
    } catch (err) {
      if (options?.signal?.aborted) throw err
      failure = err as ApiError
    }

    const canRetry =
      attempt < DIRECT_MAX_ATTEMPTS &&
      navigator.onLine &&
      isRetryableUploadError(failure)
    if (!canRetry) {
      throw new Error(errorMessage(failure, "File upload failed"))
    }
    await waitUnlessAborted(
      DIRECT_RETRY_DELAYS_MS[attempt - 1] ?? 3000,
      options?.signal
    )
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Path B — presigned multipart upload (large / media files, bytes → S3 direct)
// ─────────────────────────────────────────────────────────────────────────────

type InitiateResponse = {
  fileId: string
  uploadId: string
  partSize: number
  partCount: number
  partUrls: string[]
}

type CompletedPart = { PartNumber: number; ETag: string }

/**
 * PUT one part to its presigned URL with XMLHttpRequest, so progress inside the
 * part is reported (fetch only says when a whole part is done, which for a
 * 60 MB video is twice). Resolves with the status and ETag; a dropped request
 * rejects.
 */
const xhrPutPart = (
  url: string,
  chunk: Blob,
  signal?: AbortSignal,
  onBytes?: (loaded: number) => void
): Promise<{ status: number; etag: string | null }> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const xhr = new XMLHttpRequest()
    // No auth header, no Content-Type override: the URL is already signed.
    xhr.open("PUT", url)
    const onAbort = () => xhr.abort()
    signal?.addEventListener("abort", onAbort, { once: true })
    const cleanup = () => signal?.removeEventListener("abort", onAbort)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onBytes?.(event.loaded)
    }
    xhr.onload = () => {
      cleanup()
      resolve({ status: xhr.status, etag: xhr.getResponseHeader("ETag") })
    }
    xhr.onerror = () => {
      cleanup()
      reject(new Error("Network error during part upload"))
    }
    xhr.onabort = () => {
      cleanup()
      reject(abortError())
    }
    xhr.send(chunk)
  })

/**
 * PUT a single part straight to the presigned S3 URL and return its ETag. A
 * dropped request, a 5xx, 408 or 429 is retried; any other 4xx (an expired or
 * rejected presigned URL) and a missing ETag fail the same way every time.
 */
const putPart = async (
  url: string,
  chunk: Blob,
  signal?: AbortSignal,
  onBytes?: (loaded: number) => void
): Promise<string> => {
  let lastError: unknown
  for (let attempt = 0; attempt < PART_MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await waitUnlessAborted(PART_RETRY_DELAYS_MS[attempt - 1] ?? 3000, signal)
    }
    // A retried part starts over.
    onBytes?.(0)

    let res: { status: number; etag: string | null }
    try {
      res = await xhrPutPart(url, chunk, signal, onBytes)
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err
      continue
    }

    if (res.status < 200 || res.status >= 300) {
      lastError = new Error(`Part upload failed: ${res.status}`)
      if (res.status >= 500 || res.status === 408 || res.status === 429) {
        continue
      }
      throw lastError
    }

    if (!res.etag) {
      // Not a client bug: the bucket CORS config is missing ExposeHeaders:[ETag].
      throw new Error(
        "S3 did not expose the ETag header (bucket CORS ExposeHeaders must include ETag)"
      )
    }
    return res.etag
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Part upload failed after retries")
}

/** Upload every part with bounded concurrency; report byte-level progress. */
const uploadParts = async (
  file: Blob,
  partUrls: string[],
  partSize: number,
  options?: UploadFileOptions
): Promise<CompletedPart[]> => {
  const total = partUrls.length
  const parts = new Array<CompletedPart>(total)
  let completed = 0
  let cursor = 0

  // Bytes sent so far for each part, so the parts in flight add up to one
  // percentage for the whole file.
  const sentByPart = new Array<number>(total).fill(0)
  const reportProgress = () => {
    if (!options?.onProgress || !file.size) return
    const sent = sentByPart.reduce((sum, bytes) => sum + bytes, 0)
    // Not 100% until the server has joined the parts (see multipartUpload).
    options.onProgress(Math.min(0.99, sent / file.size))
  }

  // One failed part fails the upload. Cancel the parts still in flight and
  // stop the rest, rather than spend the church's bandwidth mid-service on an
  // upload that is about to be aborted.
  const controller = new AbortController()
  const forwardAbort = () => controller.abort()
  if (options?.signal?.aborted) controller.abort()
  options?.signal?.addEventListener("abort", forwardAbort, { once: true })
  const signal = controller.signal

  const worker = async () => {
    while (true) {
      const index = cursor++
      if (index >= total) break
      if (signal.aborted) throw abortError()
      const start = index * partSize
      const chunk = file.slice(start, start + partSize)
      const etag = await putPart(partUrls[index] as string, chunk, signal, (loaded) => {
        sentByPart[index] = loaded
        reportProgress()
      })
      // Parts are 1-indexed on the completion call.
      parts[index] = { PartNumber: index + 1, ETag: etag }
      sentByPart[index] = chunk.size
      completed++
      reportProgress()
    }
  }

  const workerCount = Math.min(PART_CONCURRENCY, total)
  try {
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
  } catch (err) {
    controller.abort()
    throw err
  } finally {
    options?.signal?.removeEventListener("abort", forwardAbort)
  }
  return parts
}

const multipartUpload = async (
  churchId: string,
  file: Blob,
  name: string,
  options?: UploadFileOptions
): Promise<UploadFileResult> => {
  const base = `/church/${churchId}/files/uploads`

  // Step 1 — initiate. Storage is reserved here, so quota errors surface now.
  const { data: initData, error: initError } = await useAPIFetch<
    InitiateResponse,
    ApiError
  >(base, {
    method: "POST",
    body: { name, type: file.type, size: file.size },
    key: `upload-init-${name}-${file.size}`,
  })

  if (initError.value) {
    throw new Error(errorMessage(initError.value, "Could not start upload"))
  }
  const init = initData.value
  if (!init?.fileId || !init?.uploadId || !init?.partUrls?.length) {
    throw new Error("Upload initiation returned an incomplete response")
  }

  const { fileId, uploadId, partSize, partUrls } = init

  try {
    // Step 2 — upload the parts directly to S3.
    const parts = await uploadParts(file, partUrls, partSize, options)

    // Step 3 — complete. The server sorts parts, so order does not matter.
    const { data: doneData, error: doneError } = await useAPIFetch<
      UploadFileResult,
      ApiError
    >(`${base}/${fileId}/complete`, {
      method: "POST",
      body: { uploadId, parts },
      key: `upload-complete-${fileId}`,
    })

    if (doneError.value) {
      throw new Error(errorMessage(doneError.value, "Could not finish upload"))
    }
    if (!doneData.value) {
      throw new Error("Upload completed without a response")
    }
    options?.onProgress?.(1)
    return doneData.value
  } catch (err) {
    // Best-effort cleanup so the reserved storage is released on failure/cancel.
    await useAPIFetch(`${base}/${fileId}/abort`, {
      method: "POST",
      key: `upload-abort-${fileId}`,
    }).catch(() => {})
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point — routes to the correct path automatically
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a single file to the church's storage, automatically choosing between
 * the direct (Path A) and presigned-multipart (Path B) upload flows based on
 * the file's type and size. Returns the created file record either way.
 */
const useUploadFile = async (
  file: Blob,
  options?: UploadFileOptions
): Promise<UploadFileResult> => {
  const authStore = useAuthStore()
  const churchId = authStore.church?._id || authStore.user?.churchId
  if (!churchId) {
    useToast().add({
      title: "Church account not found",
      description: "Please sign in again before uploading a file.",
      icon: "i-bx-error",
      color: "red",
    })
    authStore.signOut()
    throw new Error("No church ID available for file upload")
  }

  const name = resolveName(file, options)

  if (usesDirectPath(file)) {
    const result = await directUpload(churchId, file, name, options)
    options?.onProgress?.(1)
    return result
  }

  return multipartUpload(churchId, file, name, options)
}

export default useUploadFile
