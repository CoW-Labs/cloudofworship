<template>
  <div class="personal-library-main min-h-[80vh] h-[100%]" ref="quickActions">
    <UTabs :items="libraryTabs" @change="activeLibraryTab = $event">
      <template #default="{ item }">
        <div class="flex gap-2 capitalize">
          <IconWrapper :name="item.icon" size="4" />
          {{ item.label }}s
        </div>
      </template>
    </UTabs>
    <UButton
      v-if="activeLibraryTab === 0"
      class="mb-2 capitalize transition-all"
      size="lg"
      block
      :icon="page === 'add-song' ? 'i-bx-chevron-left' : 'i-bx-plus'"
      :variant="page === 'add-song' ? 'outline' : 'solid'"
      @click="page === 'add-song' ? (page = '') : (page = 'add-song')"
    >
      <span v-if="page !== 'add-song'"
        >Add new {{ libraryTabs[activeLibraryTab].label }}</span
      >
      <span v-else>View saved songs</span>
    </UButton>
    <div v-if="page !== 'add-song'" class="flex gap-2 come-up-1">
      <UInput
        icon="i-bx-search"
        :placeholder="`Search all saved ${libraryTabs[activeLibraryTab].label}s`"
        v-model="searchInput"
        class="w-[100%]"
        @input="onSearchInput"
        @input.capture="loading = true"
        @keyup.enter="null"
      />
      <UButton icon="i-bx-x" color="primary" @click="$emit('close')"></UButton>
    </div>
    <div
      v-if="loading"
      class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-350px)]"
    >
      <USkeleton
        v-for="i in 15"
        :key="i"
        class="w-[100%] h-[80px] mt-2"
      ></USkeleton>
    </div>
    <template v-else>
      <template v-if="searchInput.length < 2">
        <!-- SAVED SONGS -->
        <div
          v-if="activeLibraryTab === 0"
          class="actions-ctn mt-2 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
        >
          <AddSong
            v-if="page === 'add-song'"
            :song="songToEdit"
            @go-home="page = ''"
          />
          <template v-if="page !== 'add-song'">
            <EmptyState
              v-if="savedSongs?.length === 0"
              icon="i-tabler-database-search"
              sub="No songs saved yet."
              desc="Click the save icon on the Slide card to start saving"
            />
            <RecycleScroller
              v-else
              class="h-[calc(100vh-380px)]"
              :items="savedSongs?.slice(0, libraryEndIndex)"
              :item-size="80"
              key-field="id"
              v-slot="{ item: song }"
            >
              <SongCard
                saved
                :key="song.content.id"
                :song="(song.content as Song)"
                type="song"
                @edit-song="editSong($event)"
                @delete-song="deleteSong($event)"
              />
            </RecycleScroller>

            <UButton
              @click="libraryEndIndex = libraryEndIndex + 15"
              :disabled="libraryEndIndex >= savedSongs?.length"
              class="mt-2"
              size="lg"
              variant="outline"
              block
            >
              See more saved songs
            </UButton>
          </template>
        </div>
        <!-- SAVED SLIDES -->
        <div
          v-if="activeLibraryTab === 1"
          class="actions-ctn mt-2 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
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
            :item-size="100"
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
          class="actions-ctn mt-2 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
        >
          <AddSong
            v-if="page === 'add-song'"
            :song="songToEdit"
            @go-home="page = ''"
          />
          <template v-if="page !== 'add-song'">
            <EmptyState
              v-if="savedSongsSearchResults?.length === 0"
              icon="i-tabler-database-search"
              sub="We couldn't find a saved song matching your query"
            />
            <RecycleScroller
              v-else
              class="h-[calc(100vh-300px)]"
              :items="savedSongsSearchResults"
              :item-size="80"
              key-field="id"
              v-slot="{ item: song }"
            >
              <SongCard
                saved
                type="song"
                :key="song.content.id"
                :song="song.content"
                @edit-song="editSong($event)"
                @delete-song="deleteSong($event)"
              />
            </RecycleScroller>
          </template>
        </div>
        <!-- SAVED SLIDES -->
        <div
          v-if="activeLibraryTab === 1"
          class="actions-ctn mt-2 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
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
            :item-size="100"
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
</template>
<script setup lang="ts">
import type { Slide, Song } from "~/types"
import { useDebounceFn } from "@vueuse/core"

const props = defineProps<{
  page: string
}>()

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
  { label: "song", icon: "i-bx-music" },
  { label: "slide", icon: "i-bx-slideshow" },
]
const activeLibraryTab = ref<number>(0)
const searchInput = ref<string>("")
const page = ref<string>(props.page || "")
const songToEdit = ref<Song>()
const libraryEndIndex = ref<number>(15)
const searchedLibraryItems = ref<any[]>([])
const quickActions = ref<HTMLDivElement | null>(null)

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
})
</script>
