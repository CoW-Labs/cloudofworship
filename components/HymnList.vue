<template>
  <div class="hymn-main min-h-[80vh] h-[100%]" ref="quickActions">
    <div class="flex gap-2">
      <UInput
        icon="i-bx-search"
        placeholder="Search hymns"
        v-model="searchInput"
        class="w-[100%]"
        @input="onSearchInput"
        @input.capture="loading = true"
        @keyup.enter="getHymns($event.target.value)"
      />
      <UButton icon="i-bx-x" color="primary" @click="$emit('close')"></UButton>
    </div>

    <Transition name="fade-sm">
      <NotFoundBanner
        v-if="!isHymnAvailable"
        icon="i-tabler-cloud-search"
        sub="Can't find the Hymn you are looking for?"
        action="new-song-search"
        :query="searchInput"
        action-text="Search in songs"
      />
    </Transition>

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
          v-for="(hymn, index) in hymns"
          :key="hymn?.number"
          :song="hymn"
          type="hymn"
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
        class="actions-ctn mt-2 overflow-y-auto"
        :class="
          searchInput.length >= 4
            ? 'max-h-[calc(100vh-350px)]'
            : 'max-h-[calc(100vh-190px)]'
        "
      >
        <SongCard
          v-for="(hymn, index) in hymns"
          :key="hymn?.number"
          :song="hymn"
          type="hymn"
          :class="{
            'bg-primary-50 dark:bg-primary-800 rounded-md':
              index === focusedActionIndex,
          }"
          @click="focusedActionIndex = index"
        />
      </div>

      <EmptyState
        v-if="!loading && hymns?.length === 0"
        icon="i-tabler-cloud-search"
        sub="We couldn't find that hymn"
      />
    </template>
  </div>
</template>
<script setup lang="ts">
import type { Hymn, Song } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import fuzzysort from "fuzzysort"
const db = useIndexedDB()

const allHymns = ref<Hymn[]>()
const searchInput = ref<string>("")
const loading = ref<boolean>(true)
const hymns = ref<Hymn[]>()
const searchedHymns = ref<Song[]>([])
const focusedActionIndex = ref(0)
const quickActions = ref<HTMLDivElement | null>(null)

onMounted(() => {
  quickActions.value?.addEventListener("keydown", (e) => {
    if (e.defaultPrevented) {
      e.preventDefault()
      return
    }
    switch (e.key) {
      case "ArrowDown":
        focusedActionIndex.value < searchedHymns.value.length - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter":
        const action = searchedHymns.value?.[focusedActionIndex.value]
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

const getAllHymns = async () => {
  const hymns = await db.bibleAndHymns.get("hymns")
  allHymns.value = hymns?.data as unknown as Hymn[]
  getHymns()
}

const getHymns = (query: string = "") => {
  if (query?.length >= 2) {
    loading.value = true
    let results = fuzzysort.go(query, allHymns.value, {
      keys: ["title", "meta"],
    })
    results = results?.map((result) => result.obj)
    hymns.value = results.slice(0, 15)
  } else {
    const rand = Math.floor(Math.random() * 1115 + 15)
    hymns.value = allHymns.value.slice(rand - 15, rand)
  }
  loading.value = false
}

getAllHymns()

const isHymnAvailable = computed(() => {
  if (searchInput.value?.trim() === "") {
    return true
  }
  const isHymnTitleInResult = !!hymns.value?.find((hymn) =>
    hymn.title.toLowerCase().includes(searchInput.value.toLowerCase())
  )
  // if (searchInput.value.length > 5 && hymns.value!!.length < 8 && ) {
  //   return false
  // }
  return isHymnTitleInResult
})

const onSearchInput = useDebounceFn(async () => {
  getHymns(searchInput.value)
}, 500)
</script>
