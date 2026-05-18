<template>
  <div class="add-song-main my-4">
    <form class="flex flex-col gap-3">
      <UFormGroup label="Title" size="lg">
        <UInput placeholder="Hallelujah Eh" v-model="title" @input="onTitleInput" />
      </UFormGroup>

      <!-- Artist combobox -->
      <UFormGroup label="Artist" size="lg">
        <div class="relative" ref="artistFieldRef">
          <UInput
            placeholder="Nathaniel Bassey"
            v-model="artist"
            autocomplete="off"
            @focus="artistFocused = true"
            @blur="onArtistBlur"
            @input="onArtistInput"
            @keydown.down.prevent="moveSuggestion(1)"
            @keydown.up.prevent="moveSuggestion(-1)"
            @keydown.enter.prevent="selectSuggestion(highlightedIndex)"
            @keydown.escape="artistFocused = false"
          />
          <ul
            v-if="artistFocused && artistSuggestions.length > 0"
            class="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-primary-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
          >
            <li
              v-for="(name, i) in artistSuggestions"
              :key="name"
              class="px-3 py-2 text-sm cursor-pointer truncate"
              :class="
                i === highlightedIndex
                  ? 'bg-primary-100 dark:bg-primary-800 text-primary-700 dark:text-primary-200'
                  : 'hover:bg-gray-50 dark:hover:bg-primary-900'
              "
              @mousedown.prevent="selectSuggestion(i)"
            >
              {{ name }}
            </li>
          </ul>
        </div>
      </UFormGroup>

      <!-- Language -->
      <UFormGroup label="Language" size="lg">
        <USelectMenu
          v-model="language"
          :options="languageOptions"
          value-attribute="value"
          option-attribute="label"
        />
      </UFormGroup>

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
          Add an <span class="font-bold">empty line</span> to break lyrics into
          verses. Start any section with <span class="font-bold">Chorus:</span>
          to separate it automatically.
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

      <!-- Optional chorus field -->
      <div>
        <button
          type="button"
          class="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 mb-2"
          @click="chorusExpanded = !chorusExpanded"
        >
          <UIcon :name="chorusExpanded ? 'i-bx-chevron-up' : 'i-bx-chevron-down'" class="w-3 h-3" />
          {{ chorusExpanded ? 'Hide chorus field' : '+ Add chorus separately' }}
        </button>
        <UFormGroup v-if="chorusExpanded" label="Chorus" size="lg">
          <UTextarea
            autoresize
            placeholder="Hallelujah, hallelujah..."
            variant="none"
            :rows="4"
            color="gray"
            v-model="chorus"
          />
        </UFormGroup>
      </div>

      <!-- Duplicate detection notice -->
      <div
        v-if="duplicates.length > 0"
        class="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3"
      >
        <p class="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
          {{ duplicates.length }} similar song{{ duplicates.length > 1 ? 's' : '' }} already exist
        </p>
        <ul class="space-y-1">
          <li
            v-for="dupe in duplicates"
            :key="dupe.id"
            class="text-xs text-amber-700 dark:text-amber-300 flex justify-between"
          >
            <span class="font-medium truncate max-w-[70%]">{{ dupe.title }}</span>
            <span class="text-amber-500 truncate ml-2">{{ dupe.artist }}</span>
          </li>
        </ul>
        <p class="text-2xs text-amber-500 dark:text-amber-500 mt-2">You can still add yours if it's different.</p>
      </div>

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
        @click="addSong"
      >
        {{ song ? "Edit Song" : "Add Song" }}
      </UButton>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAuthStore } from "~/store/auth"
import { useDebounceFn } from "@vueuse/core"
import fuzzysort from "fuzzysort"
import type { Song } from "~/types"

const MAX_SUGGESTIONS = 8

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Yoruba', value: 'yo' },
  { label: 'Igbo', value: 'ig' },
  { label: 'French', value: 'fr' },
  { label: 'Hausa', value: 'ha' },
  { label: 'Twi', value: 'tw' },
  { label: 'Pidgin', value: 'pcm' },
  { label: 'Other', value: 'other' },
]

const props = defineProps<{
  song?: Song
}>()

const { saveSong } = useLibrary()
const { artists, fetchArtists } = useArtists()
const { searchSongs } = useSongs()
const loading = ref<boolean>(false)
const artist = ref<string>(props.song?.artist || "")
const title = ref<string>(props.song?.title || "")
const lyrics = ref<string>(props.song?.lyrics || "")
const chorus = ref<string>(props.song?.chorus || "")
const language = ref(languageOptions.find(l => l.value === (props.song?.language || 'en')) ?? languageOptions[0])
const isSongPublic = ref<boolean>(props.song?.isPublic ?? true)
const chorusExpanded = ref<boolean>(!!props.song?.chorus)
const toast = useToast()
const emit = defineEmits(["go-home"])
const authStore = useAuthStore()

// Artist combobox
const artistFocused = ref(false)
const highlightedIndex = ref(0)
const artistFieldRef = ref<HTMLElement | null>(null)

const artistSuggestions = computed(() => {
  const query = artist.value.trim()
  if (!query || artists.value.length === 0) return []
  const results = fuzzysort.go(query, artists.value, { limit: MAX_SUGGESTIONS, threshold: -10000 })
  return results.map((r) => r.target)
})

const onArtistInput = () => { highlightedIndex.value = 0 }
const onArtistBlur = () => { setTimeout(() => { artistFocused.value = false }, 150) }
const moveSuggestion = (dir: 1 | -1) => {
  const len = artistSuggestions.value.length
  if (!len) return
  highlightedIndex.value = (highlightedIndex.value + dir + len) % len
}
const selectSuggestion = (index: number) => {
  const name = artistSuggestions.value[index]
  if (name) artist.value = name
  artistFocused.value = false
}

// Duplicate detection
const duplicates = ref<Song[]>([])

const checkDuplicates = useDebounceFn(async () => {
  if (title.value.trim().length < 3) {
    duplicates.value = []
    return
  }
  const results = await searchSongs(title.value.trim(), 5)
  // Exclude the song being edited
  duplicates.value = results.filter(s => s.id !== props.song?.id).slice(0, 3)
}, 600)

const onTitleInput = () => { checkDuplicates() }

// Normalization
const normalize = (value: string) =>
  value.trim().replace(/\s+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const resolvedChorus = computed(() => {
  if (chorus.value.trim()) return chorus.value.trim()
  // Fall back to auto-detected chorus from lyrics if user hasn't typed one manually
  const { chorus: detected } = extractSongChorus(lyrics.value)
  return detected || undefined
})

const addSong = async () => {
  const normalizedTitle = normalize(title.value)
  const normalizedArtist = normalize(artist.value)
  const songId =
    props?.song?.id ||
    useURLFriendlyString(`${normalizedTitle} ${normalizedArtist}`.toLowerCase())

  const song: Song = {
    id: songId,
    title: normalizedTitle,
    artist: normalizedArtist,
    lyrics: lyrics.value,
    chorus: resolvedChorus.value,
    language: language.value.value,
    createdBy: "me",
    createdAt: props.song?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    loading.value = true
    await saveSong(song)

    if (!props.song) {
      await uploadSongToAPI(song)
    } else {
      emit("go-home")
    }
  } catch (err: any) {
    console.error("Error adding song:", err)
  } finally {
    loading.value = false
  }
}

const uploadSongToAPI = async (song: Song) => {
  try {
    const { data, error } = await useAPIFetch(
      `/church/${authStore.user?.churchId}/songs`,
      {
        method: "POST",
        body: {
          ...song,
          isPublic: isSongPublic.value,
          createdBy: authStore.user?._id,
          churchId: authStore.user?.churchId,
        },
      }
    )

    if (error.value) {
      toast.add({
        icon: "i-bx-error",
        title: error.value.data?.message || "Failed to upload song",
        color: "red",
      })
    } else {
      emit("go-home")
    }
  } catch (err: any) {
    console.error("Error uploading song to API:", err)
    toast.add({
      icon: "i-bx-error",
      title: "Failed to upload song",
      color: "red",
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchArtists()
})
</script>
