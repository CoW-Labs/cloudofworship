import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it, vi } from "vitest"

type CachedResponse = { body: string }

function createCaches() {
  const stores = new Map<string, Map<string, CachedResponse>>()
  return {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)!
      return {
        match: async (request: { url: string }) => store.get(request.url),
        put: async (request: { url: string }, response: CachedResponse) => {
          store.set(request.url, response)
        },
      }
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  }
}

describe("service worker cache rotation", () => {
  it("retains recent builds for an older tab while dropping the oldest cache", async () => {
    const caches = createCaches()
    for (const name of ["oldest", "older", "previous"]) {
      await caches.open(`app-cache-${name}`)
    }
    const oldAsset = { body: "previous build chunk" }
    const oldAssetUrl = "https://app.example/_nuxt/previous.js"
    await (await caches.open("app-cache-previous")).put(
      { url: oldAssetUrl },
      oldAsset,
    )

    const listeners = new Map<string, (event: any) => void>()
    const self = {
      location: { origin: "https://app.example" },
      addEventListener: (name: string, handler: (event: any) => void) =>
        listeners.set(name, handler),
      clients: { claim: vi.fn(async () => {}) },
      skipWaiting: vi.fn(async () => {}),
    }
    const fetch = vi.fn(async (request: string | { url: string }) => {
      if (request === "/version.json") {
        return { ok: true, json: async () => ({ appVersion: "current" }) }
      }
      throw new Error("offline")
    })
    runInNewContext(readFileSync("public/sw.js", "utf8"), {
      self,
      caches,
      indexedDB: new IDBFactory(),
      fetch,
      URL,
    })

    let activation: Promise<unknown> | undefined
    listeners.get("activate")?.({
      waitUntil: (promise: Promise<unknown>) => { activation = promise },
    })
    await activation

    expect(await caches.keys()).toEqual([
      "app-cache-older",
      "app-cache-previous",
      "app-cache-current",
    ])

    let response: Promise<CachedResponse> | undefined
    listeners.get("fetch")?.({
      request: { url: oldAssetUrl, method: "GET", mode: "same-origin" },
      respondWith: (promise: Promise<CachedResponse>) => { response = promise },
    })
    expect(await response).toBe(oldAsset)
  })
})
