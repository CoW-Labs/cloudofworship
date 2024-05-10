import { useFetch } from "#app"
import { UseFetchOptions } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"

type useFetchType = typeof useFetch

// wrap useFetch with configuration needed to talk to our API
export const useAPIFetch: useFetchType = (path, options = {}) => {
  const authStore = useAuthStore()
  const toast = useToast()
  const token = useCookie('token')
  const config = useRuntimeConfig()
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