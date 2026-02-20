import { useAuthStore } from "~/store/auth"

export default defineNuxtRouteMiddleware((to, from) => {
  const toast = useToast()
  const { isTauri } = useTauri()
  const authStore = useAuthStore()

  // Get token based on environment
  let token: string | null | undefined
  if (isTauri) {
    token = authStore.token
  } else {
    const tokenCookie = useCookie('token')
    token = tokenCookie.value
  }

  if (!token && to.path === '/') {
    console.log('No token, redirecting to login')
    toast.add({ icon: 'i-bx-info-circle', title: 'Log in to continue' })
    return navigateTo('/login')
  }
})