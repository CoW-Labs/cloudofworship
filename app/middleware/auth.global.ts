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

  const publicPaths = ["/live", "/livestream", "/offline", "/update", "/endofyear", "/logout"]
  const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password"]
  const isPublicPath = publicPaths.some(
    (path) => to.path === path || to.path.startsWith(`${path}/`)
  )
  const isAuthPath = authPaths.some(
    (path) => to.path === path || to.path.startsWith(`${path}/`)
  )
  const hasSession = Boolean(token || authStore.user?._id)

  if (!hasSession && !isPublicPath && !isAuthPath && to.path !== "/verify") {
    return navigateTo('/login')
  }

  if (hasSession && isAuthPath) {
    // Allow authenticated users without a church to reach the church registration step
    const isRegisterChurchPath =
      to.path.startsWith("/signup") && to.query.registerChurch
    if (isRegisterChurchPath && !authStore.user?.churchId) {
      return
    }
    return navigateTo("/")
  }

  // Redirect authenticated users with no church to the church registration step
  const isRegisterChurchPath =
    to.path.startsWith("/signup") && to.query.registerChurch
  if (hasSession && authStore.user && !authStore.user.churchId && !isPublicPath && !isRegisterChurchPath && to.path !== "/verify") {
    return navigateTo("/signup?registerChurch=1")
  }

  if (
    hasSession &&
    to.path === "/verify" &&
    authStore.user?.emailVerified === true
  ) {
    return navigateTo("/")
  }
})
