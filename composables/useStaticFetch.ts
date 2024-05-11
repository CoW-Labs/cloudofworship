import { useFetch } from "#app"
import { UseFetchOptions } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"

type useFetchType = typeof useFetch

// wrap useFetch with configuration needed to talk to our API
export const useStaticFetch: useFetchType = (path, options = {}) => {
  const config = useRuntimeConfig()
  options.baseURL = config.public.ASSETS_BASE_URL as string

  return useFetch(path, options)
}