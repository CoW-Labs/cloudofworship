<template>
  <div class="hymn-main min-h-[80vh] h-[100%] flex flex-col" ref="quickActions">
    <div
      class="rounded-xl bg-[#f1f3f6] dark:bg-[#222938] p-1.5 flex flex-col flex-1 min-h-0"
    >
      <div class="flex gap-2">
        <UInput
          placeholder="Search hymns"
          v-model="searchInput"
          class="w-[100%] cow-search-input"
          @input="onSearchInput"
          @input.capture="loading = true"
          @keyup.enter="getHymns($event.target.value)"
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

      <Transition name="fade-sm">
        <NotFoundBanner
          v-if="!isHymnAvailable"
          icon="i-tabler-cloud-search"
          sub="Can't find the Hymn you are looking for?"
          action="new-song-search"
          :query="searchInput"
          action-text="Search in songs"
          class="max-h-[140px]"
        />
      </Transition>

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
            v-for="(hymn, index) in hymns"
            :key="hymn?.number"
            :ref="(el) => setItemRef(el, index)"
            :action="turnToHymnAction(hymn)"
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
          :class="
            searchInput.length >= 4
              ? 'max-h-[calc(100vh-350px)]'
              : 'max-h-[calc(100vh-190px)]'
          "
        >
          <ActionCard
            v-for="(hymn, index) in hymns"
            :key="hymn?.number"
            :ref="(el) => setItemRef(el, index)"
            :action="turnToHymnAction(hymn)"
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
          v-if="!loading && hymns?.length === 0"
          icon="i-tabler-cloud-search"
          sub="We couldn't find that hymn"
        />
      </template>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Hymn, QuickAction } from "~/types"
import { useDebounceFn } from "@vueuse/core"
import fuzzysort from "fuzzysort"
import SongsIcon from "~/components/svgs/SongsIcon.vue"
const db = useIndexedDB()

const allHymns = ref<Hymn[]>([])
const searchInput = ref<string>("")
const loading = ref<boolean>(true)
const hymns = ref<Hymn[]>()
const focusedActionIndex = ref(0)
const hasInteracted = ref(false)
const onRowMouseEnter = (index: number) => {
  focusedActionIndex.value = index
  hasInteracted.value = false
}
const quickActions = ref<HTMLDivElement | null>(null)
const itemRefs = ref<(HTMLElement | null)[]>([])

const setItemRef = (el: any, index: number) => {
  itemRefs.value[index] = el?.$el || el || null
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
        focusedActionIndex.value < (hymns.value?.length || 0) - 1
          ? (focusedActionIndex.value += 1)
          : null
        break
      case "ArrowUp":
        hasInteracted.value = true
        focusedActionIndex.value > 0 ? (focusedActionIndex.value -= 1) : null
        break
      case "Enter": {
        const hymn = hymns.value?.[focusedActionIndex.value]
        if (!hymn) return
        useGlobalEmit("new-hymn", hymn.number)
        break
      }
      default:
        return
    }
  })
})

watch(hymns, () => {
  itemRefs.value = []
  focusedActionIndex.value = 0
  hasInteracted.value = false
})

watch(focusedActionIndex, async () => {
  await nextTick()
  itemRefs.value[focusedActionIndex.value]?.scrollIntoView({ block: "nearest" })
})

const turnToHymnAction = (hymn: Hymn): QuickAction => {
  return {
    icon: "i-bx-church",
    name: hymn?.title || "",
    desc: hymn?.author || "",
    action: "new-hymn",
    hymnIndex: hymn?.number,
    type: slideTypes.hymn,
  }
}

const getAllHymns = async () => {
  const hymns = await db.bibleAndHymns.get("hymns")
  allHymns.value = (hymns?.data as unknown as Hymn[]) || []
  getHymns()
}

const getHymns = (query: string = "") => {
  if (query?.length >= 2 && allHymns.value?.length) {
    loading.value = true
    let results: any | Fuzzysort.Result[] = fuzzysort.go(
      query,
      allHymns.value,
      {
        keys: ["title", "meta"],
      }
    )
    results = results?.map((result: Fuzzysort.Result | any) => result.obj)
    hymns.value = results.slice(0, 15)
  } else {
    const rand = Math.floor(Math.random() * 1115 + 15)
    hymns.value = allHymns.value?.slice(rand - 15, rand)
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
