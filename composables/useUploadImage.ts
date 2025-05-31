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

const useUploadImage = async (image: Blob) : Promise<UploadImageResponseT> => {
  // console.log("uploading image", image?.name)
  const authStore = useAuthStore()
  const churchId = authStore.user?.churchId
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