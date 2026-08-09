<template>
  <div class="song-main min-h-[80vh] h-[100%] flex flex-col" ref="quickActions">
    <div
      class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 flex flex-col flex-1 min-h-0"
    >
      <div class="flex gap-2">
        <UInput
          placeholder="Search song title, lyrics, artist"
          v-model="searchInput"
          class="w-[100%] cow-search-input"
          @input="onSearchInput"
          @keyup.enter="getSongs($event.target.value)"
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
        class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto max-h-[calc(100vh-190px)]"
      >
        <CowSkeleton variant="row" :count="15" />
      </div>
      <template v-else>
        <!-- BASIC SONGS -->
        <div
          v-if="searchInput.length < 2"
          class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto max-h-[calc(100vh-190px)]"
        >
          <ActionCard
            v-for="(song, index) in songs"
            :key="song.id"
            :ref="(el) => setItemRef(el, index)"
            :action="turnToSongAction(song)"
            :icon-override="SongsIcon"
            compact
            show-subtext
            :active="hasInteracted && index === focusedActionIndex"
            :class="{
              'bg-white/70 dark:bg-[#2b3242]/70': index === focusedActionIndex,
            }"
            @click="focusedActionIndex = index"
            @mouseenter="onRowMouseEnter(index)"
          />
        </div>

        <!-- SEARCHING SONGS -->
        <div
          v-else
          class="actions-ctn -mx-1.5 mt-1.5 overflow-y-auto max-h-[calc(100vh-190px)]"
        >
          <ActionCard
            v-for="(song, index) in songs"
            :key="song.id"
            :ref="(el) => setItemRef(el, index)"
            :action="turnToSongAction(song)"
            :icon-override="SongsIcon"
            compact
            show-subtext
            :active="hasInteracted && index === focusedActionIndex"
            :class="{
              'bg-white/70 dark:bg-[#2b3242]/70': index === focusedActionIndex,
            }"
            @click="focusedActionIndex = index"
            @mouseenter="onRowMouseEnter(index)"
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
  </div>
</template>
<script setup lang="ts">
import type { QuickAction, Song } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import { useAuthStore } from "~/store/auth"
import SongsIcon from "~/components/svgs/SongsIcon.vue"

const props = defineProps<{
  query: string
}>()

const searchInput = ref<string>(props.query || "")
const toast = useToast()
const { searchSongs } = useSongs()
const loading = ref<boolean>(false)
const songs = ref<Song[]>([])
const focusedActionIndex = ref(0)
const hasInteracted = ref(false)
const onRowMouseEnter = (index: number) => {
  focusedActionIndex.value = index
  hasInteracted.value = false
}
const quickActions = ref<HTMLDivElement | null>(null)
const authStore = useAuthStore()
const itemRefs = ref<(HTMLElement | null)[]>([])
let latestSongSearchId = 0

const setItemRef = (el: any, index: number) => {
  itemRefs.value[index] = el?.$el || el || null
}

const turnToSongAction = (song: Song): QuickAction => {
  const subtext =
    song?.artist ||
    (song?.author === "me" ? "compiled by me" : song?.author) ||
    ""
  return {
    icon: "i-bx-music",
    name: song?.title || "",
    desc: subtext,
    action: "new-song",
    songData: song,
    type: slideTypes.song,
  }
}

const getSongs = async (query: string = "") => {
  const searchId = ++latestSongSearchId
  loading.value = true
  songs.value = []
  focusedActionIndex.value = 0
  hasInteracted.value = false

  try {
    const results = await searchSongs(query, 20)
    if (searchId === latestSongSearchId) {
      songs.value = results
    }
  } catch (err) {
    if (searchId === latestSongSearchId) {
      toast.add({ title: "You are offline.", color: "red", icon: "i-bx-error" })
    }
  } finally {
    if (searchId === latestSongSearchId) {
      loading.value = false
    }
  }
}

onMounted(() => {
  quickActions.value?.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      e.preventDefault()
      return
    }
    switch (e.key) {
      case "ArrowDown":
        hasInteracted.value = true
        focusedActionIndex.value < songs.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        hasInteracted.value = true
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter": {
        const song = songs.value?.[focusedActionIndex.value]
        if (!song) return
        useGlobalEmit("new-song", song)
        break
      }
      default:
        return
    }
  })
})

watch(songs, () => {
  itemRefs.value = []
  focusedActionIndex.value = 0
  hasInteracted.value = false
})

watch(focusedActionIndex, async () => {
  await nextTick()
  itemRefs.value[focusedActionIndex.value]?.scrollIntoView({ block: "nearest" })
})

getSongs(props.query || "")

const onSearchInput = useDebounceFn(async () => {
  getSongs(searchInput.value)
}, 400)
</script>
