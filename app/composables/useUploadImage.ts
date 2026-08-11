import useUploadFile from "~/composables/useUploadFile"

type UploadImageResponseT = {
  message: string
  file: {
    id: string
    name: string
    size: number
    type: string
    url: string
    createdAt: string
  }
}

/**
 * Upload a single image blob and return its hosted record.
 *
 * Thin wrapper around {@link useUploadFile}: images under 5 MB take the direct
 * upload path, while anything larger transparently falls back to the presigned
 * multipart path. Kept as a named helper so existing image call sites read
 * clearly and don't have to know about the routing.
 */
const useUploadImage = async (image: Blob): Promise<UploadImageResponseT> => {
  return useUploadFile(image)
}

export default useUploadImage
