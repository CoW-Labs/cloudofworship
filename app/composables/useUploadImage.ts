import { useAuthStore } from "~/store/auth";

type UploadImageResponseT = {
  message: string,
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    url: string;
    createdAt: string;
  }
}

const useUploadImage = async (image: Blob): Promise<UploadImageResponseT> => {
  const authStore = useAuthStore()
  const churchId = authStore.user?.churchId
  if (!churchId) {
    useToast().add({
      title: "Hymn not found",
      icon: "i-bx-error",
      color: "red",
    })
    authStore.signOut()
  }
  const formdata = new FormData()
  formdata.append("file", image)

  const { data, error } = await useAPIFetch(`/church/${churchId}/files`, {
    method: "POST",
    body: formdata,
    key: `upload-image-${image?.size}`,
  })
  if (error.value) {
    throw new Error(error.value.message)
  }
  return (data.value as unknown as UploadImageResponseT)
}

export default useUploadImage;