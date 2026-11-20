import { useAuthStore } from "~/store/auth"
import type { LibraryItem } from "~/types"

// Pinned library items float to the top of their list. The list is saved to the
// user's account (GET/PUT /app-config/library-pins) so a pin follows them to
// every device, and cached in localStorage per church so the order is right on
// first paint and offline. Shared by every caller so a pin shows up everywhere
// at once.
const pinnedIds = ref<string[]>([])
// One Set for every caller: each song row asks `isPinned`, and a computed per
// caller would rebuild the Set once per row whenever a pin changed.
const pinnedSet = computed(() => new Set(pinnedIds.value))
let loadedKey = ""
let syncedForKey = ""
let saveTimer: ReturnType<typeof setTimeout> | null = null

const storageKey = (churchId?: string) =>
  `cow-library-pins:${churchId || "anon"}`

export default function useLibraryPins() {
  const authStore = useAuthStore()
  const key = () =>
    storageKey(authStore.church?._id || authStore.user?.churchId)

  const load = () => {
    if (!import.meta.client) return
    const current = key()
    if (loadedKey === current) return
    loadedKey = current
    try {
      const raw = localStorage.getItem(current)
      pinnedIds.value = raw ? JSON.parse(raw) : []
    } catch {
      pinnedIds.value = []
    }
  }
  load()

  const cache = () => {
    try {
      localStorage.setItem(key(), JSON.stringify(pinnedIds.value))
    } catch {
      // Storage blocked: the pin still holds for this session.
    }
  }

  const saveRemote = async () => {
    const { error } = await useAPIFetch("/app-config/library-pins", {
      method: "PUT",
      body: { pins: pinnedIds.value },
      key: `save-library-pins-${Date.now()}`,
    })
    if (error.value) console.warn("Could not save library pins:", error.value)
  }

  // Quick successive pins go up as one save.
  const queueSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      saveRemote()
    }, 800)
  }

  // Once per church per session: the account's list replaces the cached one.
  // An account with nothing saved yet adopts the pins this device already holds.
  const syncPins = async () => {
    if (!import.meta.client || !authStore.token) return
    load()
    const current = key()
    if (syncedForKey === current) return
    syncedForKey = current
    const { data, error } = await useAPIFetch("/app-config/library-pins", {
      method: "GET",
      key: `fetch-library-pins-${Date.now()}`,
    })
    if (error.value || !data.value) {
      syncedForKey = ""
      return
    }
    const remote = (data.value as { pins?: string[] }).pins || []
    if (remote.length) {
      pinnedIds.value = remote
      cache()
    } else if (pinnedIds.value.length) {
      saveRemote()
    }
  }

  const isPinned = (id?: string) => !!id && pinnedSet.value.has(id)

  const togglePin = (id?: string, kind?: "song" | "slide") => {
    if (!id) return
    load()
    const pinned = !pinnedSet.value.has(id)
    pinnedIds.value = pinned
      ? [id, ...pinnedIds.value]
      : pinnedIds.value.filter((pin) => pin !== id)
    cache()
    queueSave()
    usePosthogCapture("LIBRARY_ITEM_PIN_CHANGED", { kind, pinned })
  }

  // Pinned items first, most recently pinned on top; the rest keep their order.
  const sortPinned = (items: LibraryItem[] = []): LibraryItem[] => {
    if (!pinnedIds.value.length) return items
    const order = new Map(pinnedIds.value.map((id, index) => [id, index]))
    const pinned: LibraryItem[] = []
    const rest: LibraryItem[] = []
    for (const item of items) {
      if (order.has(item.id)) pinned.push(item)
      else rest.push(item)
    }
    pinned.sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    return [...pinned, ...rest]
  }

  return { isPinned, togglePin, sortPinned, syncPins }
}
