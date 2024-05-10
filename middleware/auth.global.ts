export default defineNuxtRouteMiddleware((to, from) => {
  const token = useCookie('token')
  const toast = useToast()
  // if (token.value && to.path !== '/') {
  //   return navigateTo('/')
  // }
  if (!token.value && to.path === '/') {
    toast.add({ icon: 'i-bx-info-circle', title: 'Log in to continue' })
    return navigateTo('/login')
  }
})