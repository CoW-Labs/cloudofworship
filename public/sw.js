// minimalist-church-presentation-software/public/sw.js
// Custom auto-updating service worker for Cloud of Worship

const VERSION_ENDPOINT = "https://api.cloudofworship.com/api/v1/app-config/version"
const APP_VERSION_KEY = "appVersion"
const DB_NAME = "cow-sw-meta"
const DB_STORE = "meta"
const DEFAULT_APP_VERSION = "v0"

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
  // Only handle same-origin requests, and skip the version endpoint itself
  if (
    url.origin === self.location.origin &&
    !url.pathname.endsWith("/api/v1/app-config/version")
  ) {
    event.respondWith(
      (async () => {
        const appVersion = (await getVersion()) || DEFAULT_APP_VERSION
        const cacheKey = `app-cache-${appVersion}`
        try {
          const networkResp = await fetch(req)
          // Only cache GET requests
          if (req.method === "GET" && networkResp.ok) {
            const cache = await caches.open(cacheKey)
            cache.put(req, networkResp.clone())
          }
          return networkResp
        } catch (e) {
          // Network failed, try cache
          const cache = await caches.open(cacheKey)
          const cachedResp = await cache.match(req)
          if (cachedResp) return cachedResp
          throw e
        }
      })()
    )
  }
  // else: do not intercept
})
