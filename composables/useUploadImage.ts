import { useAuthStore } from "~/store/auth";

const useUploadImage = async (image: Blob) => {
  // console.log("uploading image", image?.name)
  const authStore = useAuthStore()
  const churchId = authStore.user?.churchId
  const formdata = new FormData()
  formdata.append("file", image)

  const { data, error } = await useAPIFetch(`/church/${churchId}/files`, {
    method: "POST",
    body: formdata,
    key: `upload-image-${image?.name}`,
  })
  if (error.value) {
    throw new Error(error.value.message)
  }
  return data.value
}

export default useUploadImage;