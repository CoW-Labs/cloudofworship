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
          class="actions-ctn mt-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
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
            <SongCard
              v-for="(song, index) in savedSongs?.slice(0, libraryEndIndex)"
              saved
              :key="song.content.id"
              :song="song.content"
              @edit-song="editSong($event)"
              @delete-song="deleteSong($event)"
            />

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
          class="actions-ctn mt-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
        >
          <EmptyState
            v-if="savedSlides?.length === 0"
            icon="i-tabler-database-search"
            sub="No slides saved yet."
            desc="Click the save icon on the Slide card to start saving"
          />
          <ListSlideCard
            v-for="(slide, index) in savedSlides"
            :key="slide.content.id"
            :slide="slide.content"
            @delete-slide="deleteSlide($event)"
          />
        </div>
      </template>
      <!-- SEARCHING LIBRARY ITEMS -->
      <template v-else>
        <!-- SAVED SONGS -->
        <div
          v-if="activeLibraryTab === 0"
          class="actions-ctn mt-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
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
            <SongCard
              v-for="(song, index) in savedSongsSearchResults"
              saved
              :key="song.content.id"
              :song="song.content"
              @edit-song="editSong($event)"
              @delete-song="deleteSong($event)"
            />
          </template>
        </div>
        <!-- SAVED SLIDES -->
        <div
          v-if="activeLibraryTab === 1"
          class="actions-ctn mt-2 overflow-y-auto overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
        >
          <EmptyState
            v-if="savedSlidesSearchResults?.length === 0"
            icon="i-tabler-database-search"
            sub="We couldn't find a saved slide matching your query"
          />
          <ListSlideCard
            v-for="(slide, index) in savedSlidesSearchResults"
            :key="slide.content.id"
            :slide="slide.content"
            @delete-slide="deleteSlide($event)"
          />
        </div>
      </template>
    </template>
  </div>
</template>
<script setup lang="ts">
import type { LibraryItem, Slide, Song } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import { useObservable } from "@vueuse/rxjs"
import fuzzysort from "fuzzysort"
import { liveQuery } from "dexie"
const toast = useToast()

const props = defineProps<{
  page: string
}>()

const libraryTabs = [
  { label: "song", icon: "i-bx-music" },
  { label: "slide", icon: "i-bx-slideshow" },
]
const activeLibraryTab = ref<number>(0)
const searchInput = ref<string>("")
const loading = ref<boolean>(false)
const page = ref<string>(props.page || "")
const songToEdit = ref<Song>()
const libraryEndIndex = ref<number>(15)
const libraryItems = useObservable<LibraryItem[]>(
  liveQuery(async () => {
    const data = await useIndexedDB()
      .library.orderBy("createdAt")
      .reverse()
      .toArray()
    // const tempData = JSON.parse(JSON.stringify([...data]))
    // console.log(tempData)
    // tempData.sort((a, b) => {
    //   const dateA = new Date(a.createdAt)
    //   const dateB = new Date(b.createdAt)

    //   return dateA.getTime() > dateB.getTime()
    // })
    return data
  }) as any
)
const searchedLibraryItems = ref<any[]>([])
const focusedActionIndex = ref(0)
const quickActions = ref<HTMLDivElement | null>(null)

watch(page, (newVal, oldVal) => {
  if (oldVal === "add-song" && songToEdit.value) {
    songToEdit.value = undefined
  }
})

const savedSongs = computed(() => {
  return libraryItems?.value?.filter((item) => item.type === libraryTypes.song)
})

const savedSlides = computed(() => {
  return libraryItems?.value?.filter((item) => item.type === libraryTypes.slide)
})

const savedSongsSearchResults = computed(() => {
  return searchedLibraryItems?.value?.filter(
    (item) => item.type === libraryTypes.song
  )
})

const savedSlidesSearchResults = computed(() => {
  return searchedLibraryItems?.value?.filter(
    (item) => item.type === libraryTypes.slide
  )
})

const deleteSong = async (songId: string) => {
  await useIndexedDB().library.delete(songId)
  toast.add({ icon: "i-tabler-trash", title: "Song has been deleted" })
}

const deleteSlide = async (slideId: string) => {
  await useIndexedDB().library.delete(slideId)
  toast.add({ icon: "i-tabler-trash", title: "Slide has been deleted" })
}

const editSong = (song: Song) => {
  page.value = "add-song"
  songToEdit.value = song
}

const searchLibraryItems = (query: string = "") => {
  let results = fuzzysort.go(query, libraryItems.value, {
    keys: [
      "id",
      "content.type",
      "content.title",
      "content.name",
      "content.artist",
    ],
  })
  results = results?.map((result) => result.obj)
  // console.log(results)
  searchedLibraryItems.value = results
  loading.value = false
}

const onSearchInput = useDebounceFn(async () => {
  searchLibraryItems(searchInput.value)
}, 500)
</script>
