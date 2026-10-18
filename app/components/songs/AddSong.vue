<template>
  <div class="add-song-main my-4 mt-0">
    <h2 class="font-semibold text-md mb-4">
      {{ reviewing ? "Review song" : song ? "Edit song" : "Add a song" }}
    </h2>

    <!-- REVIEW: each sung line with its translation under it, as a slide will
         show it. Back to the form is the breadcrumb (or Escape). -->
    <div v-if="reviewing" class="come-up-1 flex flex-col gap-3">
      <div class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] px-4 py-3">
        <p class="font-medium truncate">{{ title }}</p>
        <p class="text-xs text-gray-500 dark:text-[#9aa3b2] truncate">
          {{ artist
          }}<template v-if="songLanguageCode">
            &middot; Sung in {{ languageName(songLanguageCode) }}</template
          >
        </p>
      </div>

      <UTabs
        v-if="reviewTranslations.length > 1"
        v-model="reviewTabIndex"
        :items="reviewTranslations.map((t) => ({ label: t.name }))"
      />

      <div
        v-if="activeReview && (activeReview.missing || activeReview.extra)"
        class="rounded-md bg-primary-50 dark:bg-primary-900/40 p-3 text-sm text-primary-600 dark:text-primary-300"
      >
        <template v-if="activeReview.extra">
          {{ activeReview.extra }}
          {{ activeReview.extra === 1 ? "translated line has" : "translated lines have" }}
          no sung line to go under. Go back and remove
          {{ activeReview.extra === 1 ? "it" : "them" }}, or check for a line
          that was split in two.
        </template>
        <template v-else>
          {{ activeReview.missing }}
          {{ activeReview.missing === 1 ? "sung line has" : "sung lines have" }}
          no translation yet. They will show without one.
        </template>
      </div>

      <div
        class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] px-4 py-3 flex flex-col gap-4"
      >
        <div
          v-for="(stanza, stanzaIndex) in reviewStanzas"
          :key="stanzaIndex"
          class="flex flex-col gap-2"
        >
          <template v-for="line in stanza" :key="line.index">
            <p
              v-if="line.isLabel"
              class="text-[11px] uppercase tracking-wide text-gray-400 dark:text-[#7d8695]"
            >
              {{ line.text }}
            </p>
            <div v-else>
              <p class="text-sm text-gray-800 dark:text-white">
                {{ line.text }}
              </p>
              <p
                v-if="line.translation"
                class="text-sm text-primary-600 dark:text-[#d9a4ff]"
              >
                {{ line.translation }}
              </p>
              <p v-else class="text-xs italic text-gray-400 dark:text-[#7d8695]">
                No translation
              </p>
            </div>
          </template>
        </div>
      </div>

      <CowButton
        variant="primary"
        block
        size="lg"
        class="mt-4"
        :disabled="reviewTranslations.some((t) => t.extra)"
        :loading="loading"
        @click="addSong()"
      >
        {{ song ? "Edit Song" : "Add Song" }}
      </CowButton>
    </div>

    <form v-else class="flex flex-col gap-3">
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
      <!-- Suggesting the artists already in the library keeps spellings
           consistent. It stays free text, though: no list covers every local
           worship leader, so an unmatched name is offered back, not rejected. -->
      <CowInputMenu
        v-model="artist"
        label="Artist"
        :search="searchArtists"
        placeholder="Start typing an artist's name"
      >
        <template #option-empty="{ query }">
          We'll use &ldquo;{{ query }}&rdquo;
        </template>
      </CowInputMenu>

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
        <div v-if="canForce" ref="addAnywayEl" class="mt-2">
          <CowButton
            variant="secondary"
            block
            size="sm"
            :loading="loading"
            @click="addAnyway"
          >
            None of these — add anyway
          </CowButton>
        </div>
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

      <CowAccordion
        :items="[
          {
            label: 'Language & translations',
            description: languageSummary,
            slot: 'translations',
            defaultOpen: !!(songLanguage || translationDrafts.length),
          },
        ]"
      >
        <template #translations>
          <div class="flex flex-col gap-3">
            <CowInputMenu
              v-model="songLanguage"
              label="Sung in"
              :options="songLanguageOptions"
              placeholder="Start typing a language"
              :error="showLanguageErrors ? songLanguageError : ''"
            >
              <template #option-empty="{ query }">
                No language called &ldquo;{{ query }}&rdquo;
              </template>
            </CowInputMenu>

            <div
              v-for="(draft, draftIndex) in translationDrafts"
              :key="draft.key"
              class="flex flex-col gap-2"
            >
              <CowInputMenu
                v-model="draft.language"
                label="Translated into"
                :options="translationLanguageOptions"
                placeholder="Start typing a language"
                :error="showLanguageErrors ? translationErrors[draftIndex] : ''"
              >
                <template #option-empty="{ query }">
                  No language called &ldquo;{{ query }}&rdquo;
                </template>
              </CowInputMenu>
              <CowTextarea
                v-model="draft.text"
                :label="
                  languageCode(draft.language)
                    ? `${languageName(languageCode(draft.language))} translation`
                    : 'Translation'
                "
                :rows="8"
                autoresize
              />
              <p class="ml-1 text-xs text-gray-500 dark:text-gray-400">
                One line for each sung line, in the same order. Blank lines and
                labels like &ldquo;Chorus&rdquo; are skipped. Type
                &ldquo;{{ UNTRANSLATED_LINE }}&rdquo; to leave a line out.
              </p>
              <CowButton
                variant="danger"
                size="sm"
                block
                flat
                @click="translationDrafts.splice(draftIndex, 1)"
              >
                Remove translation
              </CowButton>
            </div>

            <CowButton
              v-if="translationDrafts.length < MAX_TRANSLATIONS"
              variant="secondary"
              size="sm"
              block
              flat
              @click="addTranslationDraft"
            >
              <template #leading><PlusIcon class="w-4 h-4" /></template>
              {{ translationDrafts.length ? "Add another translation" : "Add a translation" }}
            </CowButton>
          </div>
        </template>
      </CowAccordion>

      <CowToggle
        v-model="isSongPublic"
        label="Share this song with other users?"
      />

      <!-- A translation is checked line by line before it is saved, so
           reviewing leads and adding straight away steps back. -->
      <div v-if="hasTranslation" class="mt-4 flex gap-3">
        <CowButton
          variant="secondary"
          size="lg"
          class="flex-1"
          :disabled="!(artist && title && lyrics)"
          :loading="loading"
          @click="addSong()"
        >
          {{ song ? "Edit Song" : "Add Song" }}
        </CowButton>
        <CowButton
          variant="primary"
          size="lg"
          class="flex-1"
          :disabled="!(artist && title && lyrics)"
          @click="reviewSong"
        >
          Review Song
        </CowButton>
      </div>
      <CowButton
        v-else
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
import type { Song, SongTranslation } from "~/types"

const props = defineProps<{
  song?: Song
  // Title for a new song (ignored when editing `song`).
  initialTitle?: string
}>()

const { saveSong } = useLibrary()
const { findSimilarSongs } = useSongs()
const { searchArtists } = useArtistSearch()
const loading = ref<boolean>(false)
const artist = ref<string>(props.song?.artist || "")
const title = ref<string>(props.song?.title || props.initialTitle || "")
const lyrics = ref<string>(props.song?.lyrics || "")
const isSongPublic = ref<boolean>(props.song?.isPublic || true)
const similarSongs = ref<Song[]>([])
const expandedId = ref<string>("")
// True once a *near*-duplicate blocked the submit — lets the user override.
const canForce = ref<boolean>(false)
const toast = useToast()
const emit = defineEmits(["go-home"])
// The review step. A model so the panel breadcrumb can show it and step back.
const reviewing = defineModel<boolean>("reviewing", { default: false })
const authStore = useAuthStore()
const online = useOnline()

// LANGUAGE & TRANSLATIONS
// The API allows 8 translations a song, one per language.
const MAX_TRANSLATIONS = 8

interface TranslationDraft {
  key: number
  language: string // the name as typed or picked
  text: string // one line per sung line, see translationToText
  original?: SongTranslation // the stored translation this was opened from
  originalText?: string // `text` as first opened, to tell an untouched one
}

let draftKey = 0
const songLanguage = ref<string>(languageName(props.song?.lang))
const translationDrafts = ref<TranslationDraft[]>(
  (props.song?.translations || []).map((translation) => ({
    key: draftKey++,
    language: languageName(translation.lang),
    text: translationToText(props.song?.lyrics || "", translation.lines),
    originalText: translationToText(props.song?.lyrics || "", translation.lines),
    original: translation,
  }))
)
// Language errors wait for a submit, so half-typed names don't flag mid-word.
const showLanguageErrors = ref<boolean>(false)

const songLanguageOptions = SONG_LANGUAGES.map((language) => language.name)
const translationLanguageOptions = SONG_LANGUAGES.filter(
  (language) => language.code !== "mul"
).map((language) => language.name)

const songLanguageCode = computed(() => languageCode(songLanguage.value))

const songLanguageError = computed(() =>
  songLanguage.value.trim() && !songLanguageCode.value
    ? "Pick a language from the list"
    : ""
)

const translationErrors = computed(() =>
  translationDrafts.value.map((draft, index) => {
    const code = languageCode(draft.language)
    if (!draft.language.trim()) {
      return draft.text.trim() ? "Pick the language this is in" : ""
    }
    if (!code) return "Pick a language from the list"
    if (code === songLanguageCode.value) {
      return "The song is already sung in this language"
    }
    const firstWithCode = translationDrafts.value.findIndex(
      (other) => languageCode(other.language) === code
    )
    if (firstWithCode !== index) return "There is already a translation into this language"
    return ""
  })
)

const hasLanguageErrors = computed(
  () => !!songLanguageError.value || translationErrors.value.some(Boolean)
)

const hasTranslation = computed(() =>
  translationDrafts.value.some((draft) => draft.text.trim())
)

const languageSummary = computed(() => {
  const parts: string[] = []
  if (songLanguageCode.value) {
    parts.push(`Sung in ${languageName(songLanguageCode.value)}`)
  }
  const translated = translationDrafts.value
    .filter((draft) => draft.text.trim() && languageCode(draft.language))
    .map((draft) => languageName(languageCode(draft.language)))
  if (translated.length) parts.push(`${translated.join(", ")} translation`)
  return parts.join(" · ") || "Optional"
})

const addTranslationDraft = () => {
  const taken = translationDrafts.value.map((draft) =>
    languageCode(draft.language)
  )
  // English first: it's the translation churches ask for most.
  const suggested = ["eng", "fra"].find(
    (code) => code !== songLanguageCode.value && !taken.includes(code)
  )
  translationDrafts.value.push({
    key: draftKey++,
    language: languageName(suggested),
    text: "",
  })
}

// The translations as the API stores them, laid out against the current
// lyrics. One nobody touched, on lyrics nobody touched, is kept as stored,
// down to its source, model and review status.
const reviewTranslations = computed(() =>
  translationDrafts.value
    .filter((draft) => draft.text.trim() && languageCode(draft.language))
    .map((draft) => {
      const code = languageCode(draft.language)
      const { lines, missing, extra } = alignTranslation(lyrics.value, draft.text)
      const original = draft.original
      const unchanged =
        original?.lang === code &&
        draft.text === draft.originalText &&
        lyrics.value === props.song?.lyrics
      const translation: SongTranslation = unchanged
        ? original!
        : {
            lang: code,
            lines,
            source: "human",
            status: "ok",
            updatedAt: new Date().toISOString(),
          }
      return { name: languageName(code), translation, missing, extra }
    })
)

const reviewTabIndex = ref<number>(0)
const activeReview = computed(
  () =>
    reviewTranslations.value[reviewTabIndex.value] ||
    reviewTranslations.value[0]
)

// The lyrics split into the verses they are written in, each line carrying
// the active translation's line.
const reviewStanzas = computed(() => {
  const lines = activeReview.value?.translation.lines || []
  const stanzas: {
    index: number
    text: string
    translation: string
    isLabel: boolean
  }[][] = [[]]
  lyrics.value.split(/\r?\n/).forEach((raw, index) => {
    const text = raw.replaceAll("[force-verse-break]", "").trim()
    if (!text) {
      if (stanzas[stanzas.length - 1]!.length) stanzas.push([])
      return
    }
    stanzas[stanzas.length - 1]!.push({
      index,
      text,
      translation: lines[index] || "",
      isLabel: SECTION_LABEL.test(text),
    })
  })
  return stanzas.filter((stanza) => stanza.length)
})

const languageFieldsValid = () => {
  if (!hasLanguageErrors.value) return true
  showLanguageErrors.value = true
  toast.add({
    icon: "i-bx-error",
    title: "Check the song's languages",
    description: "One of the languages isn't one we know yet.",
  })
  return false
}

const reviewSong = () => {
  if (!languageFieldsValid()) return
  reviewTabIndex.value = 0
  reviewing.value = true
}

// Escape steps back from the review to the form before it leaves the panel.
useEscapeKey(
  () => {
    if (!reviewing.value) return false
    reviewing.value = false
    return true
  },
  { priority: escapePriority.panel }
)

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

// The submit button sits below the lyrics, so the offer to add anyway appears
// off-screen. Bring it into view so the user sees their next step.
const addAnywayEl = ref<HTMLElement | null>(null)
watch(canForce, async (value) => {
  if (!value) return
  await nextTick()
  addAnywayEl.value?.scrollIntoView({ behavior: "smooth", block: "center" })
})

// "Add anyway" — re-submit past the near-duplicate warning.
const addAnyway = () => addSong(true)

const addSong = async (force = false) => {
  if (!languageFieldsValid()) return
  if (reviewTranslations.value.some((t) => t.extra)) {
    // More translated lines than sung lines can't be stored; the review shows
    // which lines ran over.
    reviewTabIndex.value = reviewTranslations.value.findIndex((t) => t.extra)
    reviewing.value = true
    return
  }
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

  // Naming the language is what confirms it; one left as it was keeps its status.
  const lang = songLanguageCode.value
  if (lang) {
    song.lang = lang
    song.langStatus =
      lang === props.song?.lang && props.song?.langStatus
        ? props.song.langStatus
        : "confirmed"
  } else {
    delete song.lang
    delete song.langStatus
  }
  const translations = reviewTranslations.value.map((t) => t.translation)
  if (translations.length) song.translations = translations
  else delete song.translations

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
      // toast.add({ icon: "i-bx-check", title: "Song added" })
      emit("go-home")
    } else if (outcome.duplicates?.length) {
      // Keep the form open, show the matches, and offer "add anyway" for a
      // near-duplicate (exact duplicates aren't force-able — reuse instead).
      similarSongs.value = outcome.duplicates
      canForce.value = outcome.canForce ?? false
      // The matches show on the form, not the review.
      reviewing.value = false
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
