<template>
  <div class="song-main min-h-[80vh] h-[100%]" ref="quickActions">
    <div class="flex gap-2">
      <UInput
        icon="i-bx-search"
        placeholder="Search song title, lyrics, artist"
        v-model="searchInput"
        class="w-[100%]"
        @input="onSearchInput"
        @keyup.enter="getSongs($event.target.value)"
      />
      <UButton icon="i-bx-x" color="primary" @click="$emit('close')"></UButton>
    </div>

    <div
      v-if="loading"
      class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-190px)]"
    >
      <USkeleton
        v-for="i in 15"
        :key="i"
        class="w-[100%] h-[80px] mt-2"
      ></USkeleton>
    </div>
    <template v-else>
      <!-- BASIC SONGS -->
      <div
        v-if="searchInput.length < 2"
        class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-190px)]"
      >
        <SongCard
          v-for="(song, index) in songs"
          :key="song.id"
          :song="song"
          type="song"
          :class="{
            'bg-primary-50 dark:bg-primary-800 rounded-md':
              index === focusedActionIndex,
          }"
          @click="focusedActionIndex = index"
        />
      </div>

      <!-- SEARCHING SONGS -->
      <div
        v-else
        class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-190px)]"
      >
        <SongCard
          v-for="(song, index) in songs"
          :key="song.id"
          :song="song"
          type="song"
          :class="{
            'bg-primary-50 dark:bg-primary-800 rounded-md':
              index === focusedActionIndex,
          }"
          @click="focusedActionIndex = index"
        />
      </div>

      <EmptyState
        v-if="!loading && songs?.length === 0"
        icon="i-tabler-cloud-search"
        sub="We couldn't find that song"
        desc="Try searching for a portion of the lyrics, or the song title and artist together."
        is-wider
      />
    </template>
  </div>
</template>
<script setup lang="ts">
import type { Song } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"

const props = defineProps<{
  query: string
}>()

const searchInput = ref<string>(props.query || "")
const toast = useToast()
const loading = ref<boolean>(true)
const songs = ref<Song[]>([])
const searchedSongs = ref<Song[]>([])
const focusedActionIndex = ref(0)
const quickActions = ref<HTMLDivElement | null>(null)
const authStore = useAuthStore()

onMounted(() => {
  quickActions.value?.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      e.preventDefault()
      return
    }
    switch (e.key) {
      case "ArrowDown":
        focusedActionIndex.value < searchedSongs.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter":
        const action = searchedSongs.value?.[focusedActionIndex.value]
        // useGlobalEmit(
        //   action.action,
        //   `${action.bibleBookIndex}:${bibleChapterAndVerse.value}`
        // )
        break
      default:
        return
    }
  })
})

const getSongs = async (query: string = "") => {
  try {
    loading.value = true
    const promise = await useAPIFetch(
      `/church/${authStore.user?.churchId}/songs?search=${query}&limit=20`
    )
    let songsData = promise.data.value.data?.data?.map((song) => ({
      ...song,
      title: song.title.replaceAll("â", "'"),
    }))
    songs.value = songsData
    loading.value = false
  } catch (err) {
    loading.value = false
    toast.add({ title: "You are offline.", color: "red", icon: "i-bx-error" })
  }
}

getSongs(props.query || "")

const onSearchInput = useDebounceFn(async () => {
  getSongs(searchInput.value)
}, 1000)
</script>
