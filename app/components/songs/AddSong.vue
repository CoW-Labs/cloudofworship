<template>
  <div class="add-song-main my-4">
    <form class="flex flex-col gap-3">
      <UFormGroup label="Title" size="lg">
        <UInput placeholder="Hallelujah Eh" v-model="title" />
      </UFormGroup>
      <UFormGroup label="Artist" size="lg">
        <UInput placeholder="Nathaniel Bassey" v-model="artist" />
      </UFormGroup>

      <!-- Proactive duplicate check: existing matches surfaced as the user types -->
      <div
        v-if="!song && similarSongs.length"
        class="rounded-md border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/40 p-3"
      >
        <div
          class="text-sm font-semibold flex items-center gap-2 text-primary-600 dark:text-primary-300"
        >
          <IconWrapper name="i-bx-search-alt" size="4" />
          Is your song already here?
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Tap one to use it instead of adding a duplicate.
        </p>
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
                <IconWrapper
                  name="i-bx-music"
                  class="text-primary shrink-0"
                  rounded-bg
                />
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
              <UButton
                size="2xs"
                color="primary"
                variant="soft"
                @click="useExistingSong(match)"
              >
                Use this
              </UButton>
            </div>
            <p
              v-if="expandedId === match.id"
              class="px-3 pb-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line max-h-32 overflow-y-auto"
            >
              {{ match.lyrics || "No lyrics preview available." }}
            </p>
          </div>
        </div>

        <!-- Shown only after a near-dup blocked the submit (warn-don't-block) -->
        <UButton
          v-if="canForce"
          block
          size="sm"
          variant="outline"
          color="gray"
          class="mt-2"
          :loading="loading"
          @click="addAnyway"
        >
          None of these — add anyway
        </UButton>
      </div>

      <div
        class="active-alert rounded-md bg-primary-100 dark:bg-primary-900 p-4"
      >
        <div
          class="text-sm text-primary-500 font-semibold flex items-center gap-2"
        >
          <IconWrapper name="i-bx-bulb" size="4"></IconWrapper>
          Hint
        </div>
        <p class="mt-2 text-sm">
          Add an
          <span class="font-bold">empty line</span> if you wish to forcefully
          break your lyrics into verses. This feature is especially useful for
          adding a worship lineup.
        </p>
      </div>
      <UFormGroup label="Lyrics" size="lg">
        <UTextarea
          autoresize
          placeholder="Hallelujah Eh! It's the sound of Victory"
          variant="none"
          :rows="12"
          color="gray"
          v-model="lyrics"
        />
      </UFormGroup>
      <UFormGroup size="lg">
        <div class="flex gap-2 items-center">
          <span>Share this song with other users?</span>
          <UToggle size="lg" v-model="isSongPublic" />
        </div>
      </UFormGroup>

      <UButton
        block
        :icon="song ? 'i-bx-edit' : 'i-bx-plus'"
        size="lg"
        class="mt-4"
        :disabled="!(artist && title && lyrics)"
        :loading="loading"
        @click="addSong()"
      >
        {{ song ? "Edit Song" : "Add Song" }}
      </UButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { watchDebounced, useOnline } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"
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
    id: songId,
    title: title.value,
    artist: artist.value,
    lyrics: lyrics.value,
    createdBy: "me",
    createdAt: props.song?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  loading.value = true
  try {
    // Editing an existing song updates the local copy only (current behaviour).
    if (props.song) {
      await saveSong(song)
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
    return { ok: false, duplicates: data?.song ? [data.song] : [], canForce: false }
  }

  toast.add({
    icon: "i-bx-error",
    title: data?.message || "Failed to upload song",
    color: "red",
  })
  return { ok: false }
}
</script>
