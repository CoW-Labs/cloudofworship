<template>
  <div class="add-song-main my-4 mt-0">
    <h2 class="font-semibold text-md mb-4">
      {{ song ? "Edit song" : "Add a song" }}
    </h2>
    <form class="flex flex-col gap-3">
      <div>
        <CowInput v-model="title" label="Title" />
        <Transition name="suggesting-title">
          <p
            v-if="suggestingTitle"
            class="suggesting-title-hint flex items-center gap-1.5 mt-1.5 ml-1 text-xs text-gray-500 dark:text-gray-400"
          >
            <IconWrapper
              name="i-bx-loader-alt"
              size="4"
              class="animate-spin shrink-0"
            />
            Suggesting title
          </p>
        </Transition>
      </div>
      <CowInput v-model="artist" label="Artist" />

      <!-- Proactive duplicate check: existing matches surfaced as the user types -->
      <div
        v-if="!song && similarSongs.length"
        class="rounded-md bg-primary-50 dark:bg-primary-900/40 p-3"
      >
        <div
          class="text-sm font-semibold flex items-center gap-2 text-primary-600 dark:text-primary-300"
        >
          <IconWrapper name="i-bx-search-alt" size="4" />
          Is your song already here?
        </div>
        <div class="mt-2 flex flex-col gap-1">
          <div
            v-for="match in similarSongs"
            :key="match.id"
            class="rounded-md overflow-hidden"
          >
            <div
              class="flex items-center gap-2 p-2 hover:bg-primary-100 dark:hover:bg-primary-800/50 transition-colors"
            >
              <button
                type="button"
                class="flex items-center gap-2 min-w-0 flex-1 text-left"
                @click="togglePreview(match.id)"
              >
                <div class="min-w-0">
                  <p class="font-medium truncate">{{ match.title }}</p>
                  <p class="text-xs text-gray-500 truncate">
                    {{ match.artist }}
                  </p>
                </div>
                <IconWrapper
                  :name="
                    expandedId === match.id
                      ? 'i-bx-chevron-up'
                      : 'i-bx-chevron-down'
                  "
                  size="4"
                  class="text-gray-400 ml-1 shrink-0"
                />
              </button>
              <CowButton
                size="2xs"
                variant="primary"
                @click="useExistingSong(match)"
              >
                Use this
              </CowButton>
            </div>
            <Transition name="duplicate-preview">
              <div
                v-if="expandedId === match.id"
                class="duplicate-lyrics-frame relative px-0 pb-2"
              >
                <p
                  class="duplicate-lyrics-preview text-xs whitespace-pre-line max-h-32 overflow-y-auto rounded-md px-2 py-2"
                >
                  {{ match.lyrics || "No lyrics preview available." }}
                </p>
              </div>
            </Transition>
          </div>
        </div>

        <!-- Shown only after a near-dup blocked the submit (warn-don't-block) -->
        <CowButton
          v-if="canForce"
          variant="secondary"
          block
          size="sm"
          class="mt-2"
          :loading="loading"
          @click="addAnyway"
        >
          None of these — add anyway
        </CowButton>
      </div>

      <Hint>
        Add an empty line if you wish to forcefully break your lyrics into
        verses. This feature is especially useful for adding a worship lineup.
      </Hint>
      <CowTextarea
        v-model="lyrics"
        label="Lyrics"
        :rows="12"
        autoresize
        @blur="suggestTitleFromLyrics"
      />
      <CowToggle
        v-model="isSongPublic"
        label="Share this song with other users?"
      />

      <CowButton
        variant="primary"
        block
        size="lg"
        class="mt-4"
        :disabled="!(artist && title && lyrics)"
        :loading="loading"
        @click="addSong()"
      >
        {{ song ? "Edit Song" : "Add Song" }}
      </CowButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { watchDebounced, useOnline } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"
import { useSuggestedSongTitle } from "~/composables/useSong"
import type { Song } from "~/types"

const props = defineProps<{
  song?: Song
}>()

const { saveSong } = useLibrary()
const { findSimilarSongs } = useSongs()
const loading = ref<boolean>(false)
const artist = ref<string>(props.song?.artist || "")
const title = ref<string>(props.song?.title || "")
const lyrics = ref<string>(props.song?.lyrics || "")
const isSongPublic = ref<boolean>(props.song?.isPublic || true)
const similarSongs = ref<Song[]>([])
const expandedId = ref<string>("")
// True once a *near*-duplicate blocked the submit — lets the user override.
const canForce = ref<boolean>(false)
const toast = useToast()
const emit = defineEmits(["go-home"])
const authStore = useAuthStore()
const online = useOnline()

// Surface existing matches as the user types title/artist/lyrics (debounced) —
// lyrics are the strongest signal — so they can reuse a song instead of creating
// a duplicate. Skipped while editing or offline.
watchDebounced(
  [title, artist, lyrics],
  async ([newTitle, newArtist, newLyrics]) => {
    // Editing the song invalidates a prior "blocked" state.
    canForce.value = false
    if (props.song || !online.value) {
      similarSongs.value = []
      return
    }
    similarSongs.value = await findSimilarSongs(newTitle, newArtist, newLyrics)
  },
  { debounce: 400 }
)

// Leaving the lyrics box is the natural moment to fill an empty title: the
// chorus hook is the best guess at what the song is called. The 1s "Suggesting
// title" beat keeps the field from changing silently under the user.
const suggestingTitle = ref<boolean>(false)
let suggestTitleTimer: ReturnType<typeof setTimeout> | undefined

const suggestTitleFromLyrics = () => {
  if (title.value.trim() || !lyrics.value.trim()) return

  const suggestion = useSuggestedSongTitle(lyrics.value)
  if (!suggestion) return

  clearTimeout(suggestTitleTimer)
  suggestingTitle.value = true
  suggestTitleTimer = setTimeout(() => {
    suggestingTitle.value = false
    // The user may have typed a title during the beat — never overwrite it.
    if (!title.value.trim()) title.value = suggestion
  }, 500)
}

onBeforeUnmount(() => clearTimeout(suggestTitleTimer))

const togglePreview = (id: string) => {
  expandedId.value = expandedId.value === id ? "" : id
}

const useExistingSong = (existing: Song) => {
  useGlobalEmit(appWideActions.newSong, { ...existing, fromSaved: false })
  emit("go-home")
}

// "Add anyway" — re-submit past the near-duplicate warning.
const addAnyway = () => addSong(true)

const addSong = async (force = false) => {
  const songId =
    props?.song?.id || useURLFriendlyString(`${title.value} ${artist.value}`)
  const song: Song = {
    // Spread the source song so an edit keeps its server identity (_id) and
    // any other fields the form doesn't cover.
    ...(props.song || {}),
    id: songId,
    title: title.value,
    artist: artist.value,
    lyrics: lyrics.value,
    createdBy: props.song?.createdBy || "me",
    createdAt: props.song?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  // Verses are derived from lyrics on demand — a stale copy would outlive the edit.
  delete song.verses

  loading.value = true
  try {
    // Editing an existing song updates the local copy only (current behaviour).
    if (props.song) {
      await saveSong(song)
      // Slides in the open schedule hold a snapshot of the song — tell them to
      // rebuild from the edited lyrics.
      useGlobalEmit(appWideActions.songUpdated, song)
      emit("go-home")
      return
    }

    // Offline: save locally; the API layer queues the upload to retry later.
    if (!online.value) {
      await saveSong(song)
      toast.add({
        icon: "i-bx-cloud",
        title: "Saved locally — will sync when you're back online",
      })
      emit("go-home")
      return
    }

    // Online: upload first so we honour the server's dedup result before saving.
    const outcome = await uploadSongToAPI(song, force)
    if (outcome.ok) {
      await saveSong(song)
      toast.add({ icon: "i-bx-check", title: "Song added" })
      emit("go-home")
    } else if (outcome.duplicates?.length) {
      // Keep the form open, show the matches, and offer "add anyway" for a
      // near-duplicate (exact duplicates aren't force-able — reuse instead).
      similarSongs.value = outcome.duplicates
      canForce.value = outcome.canForce ?? false
      toast.add({
        icon: "i-bx-error",
        title: canForce.value
          ? "Possible duplicate found"
          : "This song already exists",
        description: canForce.value
          ? "Reuse one below, or add anyway."
          : "Use the existing one below.",
      })
    }
  } catch (err: any) {
    console.error("Error adding song:", err)
    toast.add({
      icon: "i-bx-error",
      title: "Something went wrong adding the song",
      color: "red",
    })
  } finally {
    loading.value = false
  }
}

const uploadSongToAPI = async (
  song: Song,
  force = false
): Promise<{ ok: boolean; duplicates?: Song[]; canForce?: boolean }> => {
  const { error } = await useAPIFetch(
    `/church/${authStore.user?.churchId}/songs`,
    {
      method: "POST",
      body: {
        ...song,
        force,
        isPublic: isSongPublic.value,
        createdBy: authStore.user?._id,
        churchId: authStore.user?.churchId,
      },
    }
  )

  if (!error.value) return { ok: true }

  const data: any = error.value.data
  // 409 = the server's dedup guard. A near-dup carries `possibleDuplicates` and
  // is force-able; an exact dup carries `song` and is not (reuse it instead).
  if (error.value.statusCode === 409) {
    if (data?.possibleDuplicates?.length) {
      return { ok: false, duplicates: data.possibleDuplicates, canForce: true }
    }
    return {
      ok: false,
      duplicates: data?.song ? [data.song] : [],
      canForce: false,
    }
  }

  toast.add({
    icon: "i-bx-error",
    title: data?.message || "Failed to upload song",
    color: "red",
  })
  return { ok: false }
}
</script>

<style scoped>
.suggesting-title-enter-active,
.suggesting-title-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.suggesting-title-enter-from,
.suggesting-title-leave-to {
  opacity: 0;
  transform: translateY(-0.25rem);
}

.duplicate-preview-enter-active,
.duplicate-preview-leave-active {
  max-height: 10rem;
  opacity: 1;
  overflow: hidden;
  transition: max-height 0.2s ease, opacity 0.16s ease;
}

.duplicate-preview-enter-from,
.duplicate-preview-leave-to {
  max-height: 0;
  opacity: 0;
}

.duplicate-lyrics-frame::before,
.duplicate-lyrics-frame::after {
  content: "";
  position: absolute;
  left: 0.5rem;
  right: 0.5rem;
  height: 1rem;
  pointer-events: none;
  z-index: 1;
}

.duplicate-lyrics-frame::before {
  top: 0;
  border-radius: 0.375rem 0.375rem 0 0;
  box-shadow: inset 0 10px 10px -12px rgb(15 23 42 / 0.1);
}

.duplicate-lyrics-frame::after {
  bottom: 0.5rem;
  border-radius: 0 0 0.375rem 0.375rem;
  box-shadow: inset 0 -14px 12px -14px rgb(15 23 42 / 0.15);
}

.duplicate-lyrics-preview {
  scrollbar-gutter: stable;
}
</style>
