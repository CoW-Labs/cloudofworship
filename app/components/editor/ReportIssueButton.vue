<template>
  <CoWPopover
    v-model:open="open"
    placement="top"
    :max-width="340"
    :max-height="356"
    :boundary-overflow="120"
  >
    <CowTooltip text="Report an issue" :prevent="open">
      <button
        type="button"
        aria-label="Report an issue"
        class="report-issue-trigger flex items-center justify-center w-8 h-8 rounded-full bg-black/30 text-white backdrop-blur-sm transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100"
        :class="open ? 'opacity-100' : 'opacity-40'"
      >
        <IconWrapper name="i-ph-warning" size="4" />
      </button>
    </CowTooltip>

    <template #panel>
      <div class="h-full flex flex-col p-4 gap-3">
        <template v-if="!sent">
          <div>
            <h3 class="text-[15px] font-semibold text-gray-900 dark:text-white">
              Report an issue
            </h3>
            <p
              class="mt-1 text-[13px] leading-[1.5] text-gray-500 dark:text-[#a7afbd]"
            >
              {{ intro }}
            </p>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="option in categories"
              :key="option"
              type="button"
              class="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              :class="
                category === option
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:text-gray-900 dark:bg-[#232b3d] dark:text-[#a7afbd] dark:hover:text-white'
              "
              @click="category = option"
            >
              {{ option }}
            </button>
          </div>

          <CowTextarea
            v-model="message"
            label="What did you notice?"
            :rows="3"
            class="flex-1 min-h-0"
          />

          <div class="flex items-center justify-end gap-2">
            <CowButton size="sm" variant="secondary" @click="open = false">
              Cancel
            </CowButton>
            <CowButton size="sm" :disabled="!message.trim()" @click="submit">
              Send report
            </CowButton>
          </div>
        </template>

        <div
          v-else
          class="h-full flex flex-col items-center justify-center gap-2 text-center px-4"
        >
          <IconWrapper
            name="i-ph-check-circle"
            size="8"
            class="text-primary-500"
          />
          <h3 class="text-[15px] font-semibold text-gray-900 dark:text-white">
            Thanks for letting us know
          </h3>
          <p class="text-[13px] leading-[1.5] text-gray-500 dark:text-[#a7afbd]">
            We've passed this on to the team and will look into it.
          </p>
          <CowButton
            size="sm"
            variant="secondary"
            class="mt-2"
            @click="open = false"
          >
            Close
          </CowButton>
        </div>
      </div>
    </template>
  </CoWPopover>
</template>

<script setup lang="ts">
import CoWPopover from "~/components/cow/CoWPopover.vue"
import type {
  Hymn,
  Scripture,
  Slide,
  Song,
  SongSetlistData,
} from "~/types"

const props = defineProps<{
  slide?: Slide
}>()

const GENERAL_CATEGORY = "Something else"

const open = ref(false)
const sent = ref(false)
const message = ref("")
const category = ref(GENERAL_CATEGORY)

/**
 * The song on screen: the slide's own song, or the active song of a setlist.
 */
const song = computed<Song | null>(() => {
  const slide = props.slide
  if (slide?.type === slideTypes.song) return (slide.data as Song) || null
  if (slide?.type === slideTypes.songSetlist) {
    const data = slide.data as SongSetlistData | undefined
    return data?.songs?.[data.activeSongIndex]?.song || null
  }
  return null
})

const hymn = computed(() =>
  props.slide?.type === slideTypes.hymn
    ? (props.slide.data as Hymn | undefined) || null
    : null
)

const scripture = computed(() =>
  props.slide?.type === slideTypes.bible
    ? (props.slide.data as Scripture | undefined) || null
    : null
)

const categories = computed(() => {
  if (song.value) {
    return [
      "Lyrics are wrong",
      "Translation is wrong",
      "Title or artist is wrong",
      GENERAL_CATEGORY,
    ]
  }
  if (hymn.value) {
    return ["Words are wrong", "Wrong hymn number or title", GENERAL_CATEGORY]
  }
  if (scripture.value) {
    return ["Verse text is wrong", "Wrong reference", GENERAL_CATEGORY]
  }
  return ["Something isn't working", "Something looks wrong", GENERAL_CATEGORY]
})

const intro = computed(() => {
  if (song.value?.title) {
    return `Spotted a problem with "${song.value.title}"? Tell us and we'll fix it.`
  }
  if (hymn.value?.title) {
    return `Spotted a problem with "${hymn.value.title}"? Tell us and we'll fix it.`
  }
  if (scripture.value?.label) {
    return `Spotted a problem with ${scripture.value.label}? Tell us and we'll fix it.`
  }
  return "Noticed something wrong? Tell us and we'll look into it."
})

// Each opening starts a fresh report, defaulting to the most specific category.
watch(open, (isOpen) => {
  if (!isOpen) return
  sent.value = false
  message.value = ""
  category.value = categories.value[0] ?? GENERAL_CATEGORY
})

const submit = () => {
  const text = message.value.trim()
  if (!text) return
  const slide = props.slide
  usePosthogCapture("ISSUE_REPORTED", {
    message: text,
    category: category.value,
    slide_id: slide?.id,
    slide_type: slide?.type,
    slide_name: slide?.name,
    schedule_id: slide?.scheduleId,
    // What the operator was looking at, so the report can be checked against it.
    slide_contents: slide?.contents?.join("\n").slice(0, 2000),
    song_id: song.value?._id || song.value?.id,
    song_title: song.value?.title,
    song_artist: song.value?.artist,
    hymn_number: hymn.value?.number,
    hymn_title: hymn.value?.title,
    scripture_label: scripture.value?.label,
    scripture_version: scripture.value?.version,
  })
  sent.value = true
}
</script>
