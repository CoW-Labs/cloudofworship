<template>
  <div
    class="personal-library-main h-[100%] flex flex-col relative"
    ref="quickActions"
  >
    <UTabs
      v-if="page !== 'add-song'"
      :items="libraryTabs"
      @change="activeLibraryTab = $event"
    />

    <div
      v-if="page === 'add-song'"
      class="come-up-1 flex-1 min-h-0 overflow-auto"
    >
      <AddSong :song="songToEdit" @go-home="page = ''" />
    </div>

    <div
      v-else
      class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 flex flex-col flex-1 min-h-0"
    >
      <div class="flex gap-2 come-up-1">
        <UInput
          :placeholder="`Search all saved ${libraryTabs[activeLibraryTab].label}`"
          v-model="searchInput"
          class="w-[100%] cow-search-input"
          @input="onSearchInput"
          @input.capture="loading = true"
          @keyup.enter="null"
        >
          <template #leading>
            <SearchIcon class="w-4 h-4 text-gray-400 dark:text-[#9aa3b2]" />
          </template>
        </UInput>
        <CowButton
          variant="secondary"
          size="2xs"
          class="!px-2.5 !py-0 max-h-[40px] rounded-lg"
          @click="$emit('close')"
        >
          <CloseIcon class="w-4 h-4" />
        </CowButton>
      </div>
      <div
        v-if="loading"
        class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto max-h-[calc(100vh-350px)]"
      >
        <CowSkeleton variant="block" :count="15" :height="80" />
      </div>
      <template v-else>
        <template v-if="searchInput.length < 2">
          <!-- SAVED SONGS -->
          <div
            v-if="activeLibraryTab === 0"
            class="actions-ctn -mx-1.5 mt-1.5 overflow-x-hidden flex-1 min-h-0 come-up-1"
          >
            <EmptyState
              v-if="savedSongs?.length === 0"
              icon="i-tabler-database-search"
              sub="No songs saved yet."
              desc="Click the save icon on the Slide card to start saving"
            />
            <RecycleScroller
              v-else
              ref="songsScrollerRef"
              class="h-full"
              :items="savedSongs?.slice(0, libraryEndIndex)"
              :item-size="64"
              key-field="id"
              v-slot="{ item: song, index }"
              @scroll-end="loadMoreSongs"
            >
              <ActionCard
                :key="song.content.id"
                :action="turnToLibrarySongAction(song.content as Song)"
                :icon-override="SongsIcon"
                compact
                show-subtext
                :active="hasInteracted && index === focusedActionIndex"
                :class="{
                  'bg-white/70 dark:bg-[#2b3242]/70':
                    index === focusedActionIndex,
                }"
                @click="focusedActionIndex = index"
                @mouseenter="onRowMouseEnter(index)"
              >
                <template #actions>
                  <MoreActionsMenu v-slot="{ close }" flush>
                    <UButton
                      variant="ghost"
                      color="gray"
                      block
                      @click="
                        () => {
                          editSong(song.content as Song)
                          close()
                        }
                      "
                    >
                      <template #leading><EditIcon class="w-4 h-4" /></template>
                      Edit
                    </UButton>
                    <ConfirmDialog
                      button-label="Delete"
                      button-icon="i-tabler-trash"
                      button-color="red"
                      button-variant="ghost"
                      no-tooltip
                      header="Delete song"
                      button-styles="more-item-danger"
                      label="Are you sure you want to delete this song from your library? This action is not reversible"
                      @confirm="
                        () => {
                          deleteSong((song.content as Song)?.id)
                          close()
                        }
                      "
                    >
                      <template #icon><DeleteIcon class="w-4 h-4" /></template>
                    </ConfirmDialog>
                  </MoreActionsMenu>
                </template>
              </ActionCard>
            </RecycleScroller>
          </div>
          <!-- SAVED SLIDES -->
          <div
            v-if="activeLibraryTab === 1"
            class="actions-ctn -mx-1.5 mt-1.5 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
          >
            <EmptyState
              v-if="savedSlides?.length === 0"
              icon="i-tabler-database-search"
              sub="No slides saved yet."
              desc="Click the save icon on the Slide card to start saving"
            />
            <RecycleScroller
              v-else
              class="h-[calc(100vh-300px)]"
              :items="savedSlides"
              :item-size="84"
              key-field="id"
              v-slot="{ item: slide }"
            >
              <ListSlideCard
                :key="slide.content.id"
                :slide="(slide.content as Slide)"
                :truncate="true"
                @delete-slide="deleteSlide($event)"
              />
            </RecycleScroller>
          </div>
        </template>
        <!-- SEARCHING LIBRARY ITEMS -->
        <template v-else>
          <!-- SAVED SONGS -->
          <div
            v-if="activeLibraryTab === 0"
            class="actions-ctn -mx-1.5 mt-1.5 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
          >
            <EmptyState
              v-if="savedSongsSearchResults?.length === 0"
              icon="i-tabler-database-search"
              sub="We couldn't find a saved song matching your query"
            />
            <RecycleScroller
              v-else
              ref="songsScrollerRef"
              class="h-[calc(100vh-300px)]"
              :items="savedSongsSearchResults"
              :item-size="64"
              key-field="id"
              v-slot="{ item: song, index }"
            >
              <ActionCard
                :key="song.content.id"
                :action="turnToLibrarySongAction(song.content as Song)"
                :icon-override="SongsIcon"
                compact
                show-subtext
                :active="hasInteracted && index === focusedActionIndex"
                :class="{
                  'bg-white/70 dark:bg-[#2b3242]/70':
                    index === focusedActionIndex,
                }"
                @click="focusedActionIndex = index"
                @mouseenter="onRowMouseEnter(index)"
              >
                <template #actions>
                  <MoreActionsMenu v-slot="{ close }" flush>
                    <UButton
                      variant="ghost"
                      color="gray"
                      block
                      @click="
                        () => {
                          editSong(song.content as Song)
                          close()
                        }
                      "
                    >
                      <template #leading><EditIcon class="w-4 h-4" /></template>
                      Edit
                    </UButton>
                    <ConfirmDialog
                      button-label="Delete"
                      button-icon="i-tabler-trash"
                      button-color="red"
                      button-variant="ghost"
                      no-tooltip
                      header="Delete song"
                      button-styles="more-item-danger"
                      label="Are you sure you want to delete this song from your library? This action is not reversible"
                      @confirm="
                        () => {
                          deleteSong((song.content as Song)?.id)
                          close()
                        }
                      "
                    >
                      <template #icon><DeleteIcon class="w-4 h-4" /></template>
                    </ConfirmDialog>
                  </MoreActionsMenu>
                </template>
              </ActionCard>
            </RecycleScroller>
          </div>
          <!-- SAVED SLIDES -->
          <div
            v-if="activeLibraryTab === 1"
            class="actions-ctn -mx-1.5 mt-1.5 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
          >
            <EmptyState
              v-if="savedSlidesSearchResults?.length === 0"
              icon="i-tabler-database-search"
              sub="We couldn't find a saved slide matching your query"
            />
            <RecycleScroller
              v-else
              class="h-[calc(100vh-300px)]"
              :items="savedSlidesSearchResults"
              :item-size="84"
              key-field="id"
              v-slot="{ item: slide }"
            >
              <ListSlideCard
                :key="slide.content.id"
                :slide="slide.content"
                :truncate="true"
                @delete-slide="deleteSlide($event)"
              />
            </RecycleScroller>
          </div>
        </template>
      </template>
    </div>
    <CowButton
      v-if="activeLibraryTab === 0"
      :variant="page === 'add-song' ? 'secondary' : 'primary'"
      class="z-10 capitalize shadow-xl transition-all !absolute bottom-4 right-3 left-auto"
      :class="page === 'add-song' ? 'w-[200px]' : 'w-[150px]'"
      size="lg"
      @click="page === 'add-song' ? (page = '') : (page = 'add-song')"
    >
      <template #leading>
        <LibraryIcon v-if="page === 'add-song'" class="w-4 h-4" />
        <PlusIcon v-else class="w-4 h-4" />
      </template>
      <span v-if="page !== 'add-song'"
        >Add {{ libraryTabs[activeLibraryTab].singular }}</span
      >
      <span v-else>View saved songs</span>
    </CowButton>
  </div>
</template>
<script setup lang="ts">
import type { QuickAction, Slide, Song } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import SongsIcon from "~/components/svgs/SongsIcon.vue"

const props = defineProps<{
  page: string
}>()

const turnToLibrarySongAction = (song: Song): QuickAction => {
  const subtext =
    song?.artist ||
    (song?.author === "me" ? "compiled by me" : song?.author) ||
    ""
  return {
    icon: "i-bx-music",
    name: song?.title || "",
    desc: subtext,
    action: "new-song",
    songData: { ...song, fromSaved: true },
    type: slideTypes.song,
  }
}

// Use the library composable
const {
  loading,
  savedSongs,
  savedSlides,
  deleteSong,
  deleteSlide,
  searchLibraryItems,
  refreshLibrary,
} = useLibrary()

const libraryTabs = [
  { label: "Songs", icon: "i-bx-music", singular: "song" },
  { label: "Slides", icon: "i-bx-slideshow", singular: "slide" },
]
const activeLibraryTab = ref<number>(0)
const searchInput = ref<string>("")
const page = ref<string>(props.page || "")
const songToEdit = ref<Song>()
const libraryEndIndex = ref<number>(15)
const loadMoreSongs = () => {
  if (libraryEndIndex.value >= (savedSongs.value?.length || 0)) return
  libraryEndIndex.value += 15
}
const searchedLibraryItems = ref<any[]>([])
const quickActions = ref<HTMLDivElement | null>(null)
const focusedActionIndex = ref(0)
const hasInteracted = ref(false)
// Only auto-scroll the list into view for keyboard-driven focus changes —
// mouse hover (including hovers caused by content moving under a stationary
// cursor while scrolling) must not fight the user's manual scroll.
const focusChangeSource = ref<"keyboard" | "mouse">("mouse")
const onRowMouseEnter = (index: number) => {
  focusChangeSource.value = "mouse"
  focusedActionIndex.value = index
  hasInteracted.value = false
}
const songsScrollerRef = ref<{ scrollToItem: (index: number) => void } | null>(
  null
)

// Computed: Filter songs from search results
const savedSongsSearchResults = computed(() => {
  return searchedLibraryItems?.value?.filter(
    (item) => item.type === libraryTypes.song
  )
})

// Computed: Filter slides from search results
const savedSlidesSearchResults = computed(() => {
  return searchedLibraryItems?.value?.filter(
    (item) => item.type === libraryTypes.slide
  )
})

// The list currently backing keyboard navigation (songs tab only)
const visibleLibrarySongs = computed<Song[]>(() => {
  if (activeLibraryTab.value !== 0) return []
  const items =
    searchInput.value.length < 2
      ? savedSongs.value?.slice(0, libraryEndIndex.value)
      : savedSongsSearchResults.value
  return (items || []).map((item: any) => item.content as Song)
})

watch([visibleLibrarySongs, activeLibraryTab], () => {
  focusChangeSource.value = "mouse"
  focusedActionIndex.value = 0
  hasInteracted.value = false
})

watch(focusedActionIndex, async () => {
  if (focusChangeSource.value !== "keyboard") return
  await nextTick()
  songsScrollerRef.value?.scrollToItem(focusedActionIndex.value)
})

// Watch page changes to reset song editing state
watch(page, (newVal, oldVal) => {
  if (oldVal === "add-song" && songToEdit.value) {
    songToEdit.value = undefined
  }
})

// Edit song handler
const editSong = (song: Song) => {
  page.value = "add-song"
  songToEdit.value = song
}

// Perform search with debounce
const performSearch = (query: string = "") => {
  if (!query || query.length < 2) {
    searchedLibraryItems.value = []
    loading.value = false
    return
  }

  const results = searchLibraryItems(query)
  searchedLibraryItems.value = results
  loading.value = false
}

const onSearchInput = useDebounceFn(() => {
  loading.value = true
  performSearch(searchInput.value)
}, 500)

// Refresh library when component is mounted
onMounted(async () => {
  await refreshLibrary()

  quickActions.value?.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      e.preventDefault()
      return
    }
    switch (e.key) {
      case "ArrowDown":
        hasInteracted.value = true
        focusChangeSource.value = "keyboard"
        focusedActionIndex.value < visibleLibrarySongs.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        hasInteracted.value = true
        focusChangeSource.value = "keyboard"
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter": {
        const song = visibleLibrarySongs.value?.[focusedActionIndex.value]
        if (!song) return
        useGlobalEmit("new-song", { ...song, fromSaved: true })
        break
      }
      default:
        return
    }
  })
})
</script>
