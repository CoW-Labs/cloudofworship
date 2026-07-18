import { useAuthStore } from "~/store/auth"

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

type UploadImageErrorT = {
  data?: { message?: string }
  message?: string
}

const useUploadImage = async (image: Blob): Promise<UploadImageResponseT> => {
  const authStore = useAuthStore()
  const churchId = authStore.user?.churchId
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
  const formdata = new FormData()
  formdata.append("file", image)

  const { data, error } = await useAPIFetch<
    UploadImageResponseT,
    UploadImageErrorT
  >(`/church/${churchId}/files`, {
    method: "POST",
    body: formdata,
    key: `upload-image-${image?.size}`,
  })
  if (error.value) {
    throw new Error(
      error.value.data?.message ||
        error.value.message ||
        "File upload failed"
    )
  }
  if (!data.value) {
    throw new Error("File upload completed without a response")
  }

  return data.value
}

export default useUploadImage
