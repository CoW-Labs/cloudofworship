const CACHE_KEY = 'cow-artists-cache'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

interface ArtistsCache {
  data: string[]
  cachedAt: number
}

function readCache(): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed: ArtistsCache = JSON.parse(raw)
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(data: string[]) {
  try {
    const payload: ArtistsCache = { data, cachedAt: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded)
  }
}

export const useArtists = () => {
  const artists = ref<string[]>([])

  const fetchArtists = async () => {
    const cached = readCache()
    if (cached) {
      artists.value = cached
      return
    }

    try {
      const { data, error } = await useAPIFetch('/songs/artists', {
        method: 'GET',
        key: 'get-song-artists',
      })
      if (error.value || !data.value) return
      const list = data.value as string[]
      artists.value = list
      writeCache(list)
    } catch {
      // Non-critical — form still works without suggestions
    }
  }

  return { artists, fetchArtists }
}
