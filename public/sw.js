// minimalist-church-presentation-software/public/sw.js
// Custom auto-updating service worker for Cloud of Worship
// For APP to be updated, the service worker must be activated 

// The web app's own version, written into the build output by the
// `nitro:build:public-assets` hook. This used to point at the API's /health,
// which reports the *API's* version — a string that does not move when the web
// app ships, so `latestVersion !== prevVersion` was never true and the cache
// below was never purged. A cache that is never purged can hand a whole
// months-old app back to a client the first time the network hiccups.
const VERSION_ENDPOINT = "/version.json"
const APP_VERSION_KEY = "appVersion"
const DB_NAME = "cow-sw-meta"
const DB_STORE = "meta"
const DEFAULT_APP_VERSION = "v0"
const NAVIGATION_FALLBACK_URLS = ["/", "/login"]

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function getVersion() {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, "readonly")
    const store = tx.objectStore(DB_STORE)
    const req = store.get(APP_VERSION_KEY)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(undefined)
  })
}
async function setVersion(version) {
  const db = await openDB()
  return new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, "readwrite")
    const store = tx.objectStore(DB_STORE)
    store.put(version, APP_VERSION_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

async function getCacheName() {
  const appVersion = (await getVersion()) || DEFAULT_APP_VERSION
  return `app-cache-${appVersion}`
}

async function matchCachedResponse(cache, req) {
  return (
    (await cache.match(req)) ||
    (await cache.match(req, { ignoreSearch: true }))
  )
}

async function matchNavigationFallback(cache) {
  for (const url of NAVIGATION_FALLBACK_URLS) {
    const cachedResp = await cache.match(url)
    if (cachedResp) return cachedResp
  }
}

// Helper to get appVersion from API
async function fetchAppVersion() {
  try {
    const res = await fetch(VERSION_ENDPOINT, { cache: "no-store" })
    if (!res.ok) throw new Error("Failed to fetch version")
    const data = await res.json()
    return data.appVersion
  } catch (e) {
    return undefined
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const latestVersion = await fetchAppVersion()
      const prevVersion = await getVersion()

      if (!latestVersion) {
        await self.clients.claim()
        return
      }

      if (latestVersion !== prevVersion) {
        // Delete all caches
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))
        await setVersion(latestVersion)
        await self.clients.claim()
      }
      // else: do nothing, keep serving from cache
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== "GET") return

  // Only handle same-origin requests, and never the version file: serving a
  // cached copy of it would tell a stale tab it is up to date, which is the one
  // answer that keeps it stale. Letting it fail while offline is correct — the
  // page treats "could not check" as "assume fresh".
  if (
    url.origin === self.location.origin &&
    url.pathname !== VERSION_ENDPOINT &&
    !url.pathname.endsWith("/api/v1/health")
  ) {
    event.respondWith(
      (async () => {
        const cacheKey = await getCacheName()
        try {
          const networkResp = await fetch(req)
          if (networkResp.ok && networkResp.status === 200) {
            const cache = await caches.open(cacheKey)
            cache.put(req, networkResp.clone())
          }
          return networkResp
        } catch (e) {
          // Network failed, try cache
          const cache = await caches.open(cacheKey)
          const cachedResp = await matchCachedResponse(cache, req)
          if (cachedResp) return cachedResp

          if (req.mode === "navigate") {
            const fallbackResp = await matchNavigationFallback(cache)
            if (fallbackResp) return fallbackResp
          }

          throw e
        }
      })()
    )
  }
  // else: do not intercept
})
