import { useFetch } from "#app"
import { UseFetchOptions, useOnline, useDebounceFn } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"

type useFetchType = typeof useFetch

// wrap useFetch with configuration needed to talk to our API
export const useAPIFetch: useFetchType = (path, options = {}) => {
  const online = useOnline()
  const toast = useToast()
  const config = useRuntimeConfig()

  // const showOfflineToast = useDebounceFn((options: { title: string, color: string, icon: string }) => {
  //   toast.add(options)
  // }, 2000)

  if (!online.value) {
    throw new Error('No internet connection')
  }
  const authStore = useAuthStore()
  const token = useCookie('token')
  options.baseURL = config.public.BASE_URL as string
  options.headers = {
    Authorization: `Bearer ${token.value}`
  }

  options.onResponseError = ({ response }) => {
    if (response.status === 401) {
      authStore.signOut()
      toast.add({
        title: 'Your session has expired',
        color: "red",
        icon: "i-bx-error",
      })
    }
    console.log(response.status)
  }

  return useFetch(path, options)
}