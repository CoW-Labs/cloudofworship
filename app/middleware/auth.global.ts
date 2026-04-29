import { useAuthStore } from "~/store/auth"

export default defineNuxtRouteMiddleware((to, from) => {
  const { isTauri } = useTauri()
  const authStore = useAuthStore()

  // Get token based on environment
  let token: string | null | undefined
  if (isTauri) {
    token = authStore.token
  } else {
    const tokenCookie = useCookie('token')
    token = tokenCookie.value || authStore.token
  }

  if (!token && !authStore.user?._id && to.path === '/') {
    return navigateTo('/login')
  }
})
