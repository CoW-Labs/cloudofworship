import { useAuthStore } from "~/store/auth"

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
  /** Progress callback, `fraction` is 0..1 (part-granular for large uploads). */
  onProgress?: (fraction: number) => void
  /** Abort the whole upload (cancels in-flight parts and aborts the S3 upload). */
  signal?: AbortSignal
}

type ApiError = { data?: { message?: string }; message?: string }

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

const directUpload = async (
  churchId: string,
  file: Blob,
  name: string
): Promise<UploadFileResult> => {
  const formData = new FormData()
  formData.append("file", file, name)

  const { data, error } = await useAPIFetch<UploadFileResult, ApiError>(
    `/church/${churchId}/files`,
    {
      method: "POST",
      body: formData,
      // do NOT set Content-Type — the browser adds the multipart boundary
      key: `upload-file-${name}-${file.size}`,
    }
  )

  if (error.value) {
    throw new Error(errorMessage(error.value, "File upload failed"))
  }
  if (!data.value) {
    throw new Error("File upload completed without a response")
  }
  return data.value
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

/** PUT a single part straight to the presigned S3 URL and return its ETag. */
const putPart = async (
  url: string,
  chunk: Blob,
  signal?: AbortSignal
): Promise<string> => {
  let lastError: unknown
  for (let attempt = 0; attempt < PART_MAX_RETRIES; attempt++) {
    try {
      // No auth header, no Content-Type override — the URL is already signed.
      const res = await fetch(url, { method: "PUT", body: chunk, signal })
      if (!res.ok) throw new Error(`Part upload failed: ${res.status}`)
      const etag = res.headers.get("ETag")
      if (!etag) {
        // Not a client bug: the bucket CORS config is missing ExposeHeaders:[ETag].
        throw new Error(
          "S3 did not expose the ETag header (bucket CORS ExposeHeaders must include ETag)"
        )
      }
      return etag
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Part upload failed after retries")
}

/** Upload every part with bounded concurrency; report part-granular progress. */
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

  const worker = async () => {
    while (true) {
      const index = cursor++
      if (index >= total) break
      if (options?.signal?.aborted) {
        throw new DOMException("Upload aborted", "AbortError")
      }
      const start = index * partSize
      const chunk = file.slice(start, start + partSize)
      const etag = await putPart(partUrls[index] as string, chunk, options?.signal)
      // Parts are 1-indexed on the completion call.
      parts[index] = { PartNumber: index + 1, ETag: etag }
      completed++
      options?.onProgress?.(completed / total)
    }
  }

  const workerCount = Math.min(PART_CONCURRENCY, total)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
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
    const result = await directUpload(churchId, file, name)
    options?.onProgress?.(1)
    return result
  }

  return multipartUpload(churchId, file, name, options)
}

export default useUploadFile
