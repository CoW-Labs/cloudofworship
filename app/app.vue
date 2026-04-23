<template>
  <div class="dark:bg-gray-900">
    <NuxtPwaAssets />
    <NuxtLoadingIndicator />
    <NuxtLayout :app-version="appVersion">
      onMounted(() => {
        initializeTauri()
        // Register custom service worker in production only
        if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js').then((reg) => {
            // Listen for controllerchange to reload on update
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              window.location.reload();
            });
          }).catch(() => {/* ignore */});
        }
      })
const appVersion = ref<string>("v0.46.1-beta")

onMounted(() => {
  initializeTauri()

  // Unregister stale service workers (old builds with deleted/renamed assets)
  // but keep the current PWA service worker (/sw.js) intact.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        const scriptURL = registration.active?.scriptURL ?? registration.installing?.scriptURL ?? ''
        const isCurrentSW = scriptURL.includes('/sw.js')
        if (!isCurrentSW) {
          registration.unregister()
        }
      }
    })
  }

  // Handle stale-chunk errors: when a deploy has replaced old hashed JS files,
  // the current SW may still serve a stale index.html referencing old hashes.
  // Intercept unhandled promise rejections (dynamic import failures) and do a
  // hard reload to force the browser/SW to fetch the fresh index.html + assets.
  window.addEventListener('unhandledrejection', (event) => {
    const message = event?.reason?.message ?? ''
    if (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed') ||
      message.includes('no-response')
    ) {
      console.warn('[CoW] Detected stale chunk error — reloading to pick up new build.', message)
      // Avoid reload loops: only reload if we haven't already reloaded for this build.
      const reloadKey = 'cow_last_chunk_reload'
      const lastReload = Number(sessionStorage.getItem(reloadKey) ?? 0)
      const now = Date.now()
      if (now - lastReload > 10_000) { // throttle: at most once per 10s
        sessionStorage.setItem(reloadKey, String(now))
        window.location.reload()
      }
    }
  })
})
</script>

<style>
.text-2xs {
  font-size: 0.7rem;
  line-height: 0.9rem;
}

button:focus-visible {
  /* background: #faf5ff;
  border-radius: 0.375rem; */
  outline: none;
}

/* PAGE AND LAYOUT TRANSITIONS */
.layout-enter-active,
.layout-leave-active {
  transition: all 1s;
  -webkit-transition: all 1s;
  -moz-transition: all 1s;
  -ms-transition: all 1s;
  -o-transition: all 1s;
}
.layout-enter-from,
.layout-leave-to {
  filter: grayscale(1);
}
.page-enter-active,
.page-leave-active {
  transition: all 0.4s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
</style>
