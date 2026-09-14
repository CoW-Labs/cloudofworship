import type { Song } from "~/types"

export type SongDestination = "setlist" | "separate"

interface PendingSongDestination {
  song: Song
  resolve: (destination: SongDestination | null) => void
}

/**
 * Asks the operator where a song should land when the schedule already has a
 * setlist: into that setlist, or onto a song slide of its own.
 *
 * The state is module-level on purpose — "don't ask again" is meant to last for
 * the session only, so a reload (or reopening the desktop app) brings the
 * question back without anything to clear.
 */
const queue = ref<PendingSongDestination[]>([])
const rememberedDestination = ref<SongDestination | null>(null)
const dontAskAgain = ref(false)

export default function useSongDestinationPrompt() {
  const pendingSong = computed(() => queue.value[0]?.song ?? null)
  const isPromptOpen = computed(() => queue.value.length > 0)

  /**
   * Resolves to the destination the operator picked, or `null` if they closed
   * the prompt without choosing (the song is then not added at all).
   */
  const askSongDestination = (song: Song): Promise<SongDestination | null> => {
    if (rememberedDestination.value) {
      return Promise.resolve(rememberedDestination.value)
    }

    return new Promise<SongDestination | null>((resolve) => {
      queue.value = [...queue.value, { song, resolve }]
    })
  }

  const answer = (destination: SongDestination | null) => {
    const [current, ...rest] = queue.value
    if (!current) return

    if (destination && dontAskAgain.value) {
      rememberedDestination.value = destination
    }

    queue.value = rest
    current.resolve(destination)

    // A remembered choice applies to everything still waiting behind it.
    if (rememberedDestination.value && queue.value.length) {
      const waiting = queue.value
      queue.value = []
      waiting.forEach((item) => item.resolve(rememberedDestination.value))
    }
  }

  return {
    pendingSong,
    isPromptOpen,
    dontAskAgain,
    rememberedDestination,
    askSongDestination,
    answer,
  }
}
