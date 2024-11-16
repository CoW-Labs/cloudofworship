<template>
  <div
    class="main relative min-h-[300px] h-[45vh]"
    :class="containerOverflow === 'overflow-x-auto' ? '' : 'overflow-hidden'"
  >
    <div>
      <div
        class="toolbar w-[100%] p-2 px-4 min-h-[56px] bg-primary-100 dark:bg-primary-800 rounded-t-md flex items-center justify-between"
      >
        <template v-if="slide">
          <TransitionGroup name="list">
            <div
              v-for="slide in animatedSlides"
              :key="slide?.id"
              class="slide-name flex items-center gap-2 top-1 text-primary-900 dark:text-primary-100"
            >
              <h4 class="font-medium text-nowrap">
                {{ useShortSlideName(slide, { longer: true }) }}
              </h4>
              <SlideChip
                :slide-type="slide?.type"
                :slide-sub-type="slide?.data?.type"
                dark-mode
              />
            </div>
          </TransitionGroup>
          <div
            class="actions flex items-center ml-6"
            :class="containerOverflow"
          >
            <!-- <FontSelect
            v-if="slide?.type === slideTypes?.text"
            size="sm"
            class="mr-2"
            @change="$emit('update-bible-version', $event)"
          /> -->
            <UTooltip text="Take slide live" :popper="{ arrow: true }">
              <UButton
                variant="ghost"
                color="primary"
                class="p-2 px-2 hover:text-red-600 hover:bg-red-300"
                icon="i-bx-slideshow"
                @click="$emit('take-live')"
              >
              </UButton>
            </UTooltip>

            <!-- VERSE SWITCH -->
            <div
              v-if="
                slide?.type === slideTypes?.bible ||
                slide?.type === slideTypes?.hymn ||
                slide?.type === slideTypes?.song
              "
              class="verse-switch button-group bg-primary-200 dark:bg-primary-900 rounded-l-md mx-1 flex items-center gap-1 h-[36px] px-1 pr-1 mr-0 relative"
            >
              <UTooltip text="Previous verse" :popper="{ arrow: true }">
                <UButton
                  variant="ghost"
                  class="p-1"
                  icon="i-bx-chevron-left"
                  @click="$emit('goto-verse', previousVerse)"
                />
              </UTooltip>
              <UInput
                placeholder="Verse"
                size="xs"
                variant="none"
                id="bible-verse-input"
                v-model="verse"
                :inputClass="`bg-white border-0 shadow-none outline-none text-center dark:text-primary-900 transition-all ${
                  verse?.length > 20 ? 'px-1' : ''
                }`"
                :style="`width: ${
                  slide?.type === slideTypes.bible
                    ? (verse?.replaceAll(' ', '').length || 10) + 3
                    : (verse?.length || 10) + 2
                }ch`"
                @focus="$event.target.select()"
                @keydown.tab.prevent="predictVerseInput($event.target)"
                @keydown.arrow-right.prevent="predictVerseInput($event.target)"
                @keydown.enter="$emit('goto-verse', verse)"
              />
              <UTooltip text="Next verse" :popper="{ arrow: true }">
                <UButton
                  variant="ghost"
                  class="p-1"
                  icon="i-bx-chevron-right"
                  @click="$emit('goto-verse', nextVerse)"
                />
              </UTooltip>
              <UButton
                v-if="slide?.type === slideTypes?.hymn && slide?.hasChorus"
                class="rounded-md"
                size="xs"
                @click="$emit('goto-chorus', verse)"
              >
                Chorus
              </UButton>
            </div>
            <!-- Component to Auto complete Bible Books while typing -->
            <BibleAutoComplete
              v-if="slide?.type === slideTypes.bible && !verse?.includes(':')"
              :verse="verse"
              @goto-book="predictVerseInput(undefined, $event)"
              @book-options="searchedBibleBookOptions = $event"
            />
            <PreviewVerses
              v-if="
                slide?.type === slideTypes.hymn ||
                slide?.type === slideTypes.song ||
                slide?.type === slideTypes.bible
              "
              class="preview-verses"
              :slide="slide"
              :verse="verse"
              @goto-verse="$emit('goto-verse', $event)"
            />
            <BibleVersionSelect
              v-if="slide?.type === slideTypes?.bible"
              class="bg-primary-200 dark:bg-primary-900 rounded-r-md mr-1 flex items-center gap-1 h-[36px] relative min-w-[80px]"
              @open="containerOverflow = ''"
              @close="containerOverflow = 'overflow-x-auto'"
              @change="$emit('update-bible-version', $event)"
            />
            <!-- <UPopover
              v-if="slide?.layout !== slideLayoutTypes.bible"
              v-model:open="layoutPopoverOpen"
            >
              <UTooltip text="Switch slide layout" :popper="{ arrow: true }">
                <UButton
                  variant="ghost"
                  icon="i-mingcute-layout-3-line"
                  :disabled="!slide"
                />
              </UTooltip>
              <template #panel>
                <SlideLayoutSelection
                  :value="slide?.layout"
                  @select="onSelectLayout"
                />
              </template>
            </UPopover> -->
            <div
              v-show="
                slide?.type !== slideTypes.media ||
                (slide?.type === slideTypes.media &&
                  slide?.data?.type?.includes('audio'))
              "
              class="button-group flex rounded-md mx-1 p-1"
              :class="{
                'bg-primary-200 dark:bg-primary-900':
                  slide?.layout !== slideLayoutTypes.bible,
              }"
            >
              <UPopover v-model:open="bgEditBgPopoverOpen">
                <UTooltip text="Style background" :popper="{ arrow: true }">
                  <UButton
                    variant="ghost"
                    class="px-1.5"
                    icon="i-bx-slider"
                    :disabled="!slide"
                  />
                </UTooltip>
                <template #panel>
                  <BgStyle />
                </template>
              </UPopover>
              <UPopover v-model:open="bgImagePopoverOpen">
                <UTooltip text="Add background image" :popper="{ arrow: true }">
                  <UButton
                    variant="ghost"
                    class="px-1.5"
                    icon="i-bx-image-add"
                    :disabled="!slide"
                  />
                </UTooltip>
                <template #panel>
                  <BgImageSelection
                    :value="slide?.background"
                    @select="onSelectBackground(backgroundTypes.image, $event)"
                  />
                </template>
              </UPopover>
              <UPopover
                v-if="!slide?.data?.type?.includes('audio')"
                v-model:open="bgVideoPopoverOpen"
              >
                <UTooltip text="Add background video" :popper="{ arrow: true }">
                  <UButton
                    variant="ghost"
                    class="px-1.5"
                    icon="i-bx-film"
                    :disabled="!slide"
                  />
                </UTooltip>
                <template #panel>
                  <BgVideoSelection
                    :value="slide?.background"
                    @select="onSelectBackground(backgroundTypes.video, $event)"
                  />
                </template>
              </UPopover>
              <UPopover v-model:open="bgColorPopoverOpen">
                <UTooltip text="Add background color" :popper="{ arrow: true }">
                  <UButton
                    variant="ghost"
                    class="px-1.5"
                    icon="i-mdi-square-rounded"
                    :disabled="!slide"
                  />
                </UTooltip>
                <template #panel>
                  <BgColorSelection
                    :value="slide?.background"
                    @select="onSelectBackground(backgroundTypes.solid, $event)"
                  />
                </template>
              </UPopover>
            </div>
            <!-- <UButton
          class="px-2 pr-3 ml-1 text-xs"
          icon="i-bx-play-circle"
          @click="$emit('update-live-output-slides')"
          >Promote to Live</UButton
        > -->
          </div>
        </template>
      </div>

      <TipTapToolbar
        v-if="slide?.type === slideTypes.text"
        :editor="focusedEditor"
      />
      <SlideContentToolbar
        v-else-if="slide"
        :slide="slide"
        @update-style="onUpdateSlideStyle($event, false)"
        @update-song-lyrics="onUpdateSongLyrics($event)"
        @update-font="onUpdateSlideStyle({ ...slide.slideStyle, font: $event })"
        @update-lines-per-slide="onUpdateSongLines($event)"
        @update-media-seek-position="
          onUpdateMediaSeekPosition({
            ...slide.slideStyle,
            mediaSeekPosition: 0,
          })
        "
        @update-bg-fill-type="
          onUpdateSlideStyle({
            ...slide.slideStyle,
            backgroundFillType: $event,
          })
        "
      />
    </div>

    <!-- MAIN CONTENT -->
    <EmptyState
      v-if="!slide"
      icon="i-bx-slideshow"
      sub="Select slide above to start editing"
      action=""
      action-text=""
    />
    <div
      v-else
      class="h-[100%] relative text-white bg-primary-900 bg-no-repeat transition-all rounded-b-md overflow-hidden"
      :class="{
        'bg-center bg-cover':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.crop ||
          slide?.slideStyle?.backgroundFillType == undefined,
        'bg-top bg-cover':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.cropTop,
        'bg-bottom bg-cover':
          slide?.slideStyle?.backgroundFillType ===
          backgroundFillTypes.cropBottom,
        'bg-center bg-contain':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.fit,
        'bg-center bg-stretch':
          slide?.slideStyle?.backgroundFillType === backgroundFillTypes.stretch,
        // 'bg-center':
        //   slide?.slideStyle?.backgroundFillType === backgroundFillTypes.center,
      }"
      :style="useSlideBackground(slide)"
    >
      <!-- VIDEO BACKGROUND -->
      <video
        v-if="slide?.backgroundType === backgroundTypes.video"
        :src="slide?.background"
        class="h-[100%] w-[100%] object-cover absolute inset-0"
        crossorigin="anonymous"
      ></video>
      <div class="bg-black opacity-30 absolute inset-0"></div>
      <TipTap
        v-if="slide"
        :slide="slide"
        @update="onUpdateSlideContent"
        @change-focused-editor="focusedEditor = $event"
        :layout="slide?.layout"
        editable
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Editor } from "@tiptap/core"
import type { Emitter } from "mitt"
import type { Slide, SlideStyle, Song } from "~/types"

const props = defineProps<{
  slide: Slide
}>()

const emit = defineEmits([
  "slide-update",
  "inactive-slide-update",
  "update-live-output-slides",
  "goto-verse",
  "goto-chorus",
  "update-bible-version",
  "update-lines-per-slide",
  "take-live",
])

const focusedEditor = ref<Editor | undefined>()
const layoutPopoverOpen = ref<boolean>(false)
const bgEditBgPopoverOpen = ref<boolean>(false)
const bgImagePopoverOpen = ref<boolean>(false)
const bgVideoPopoverOpen = ref<boolean>(false)
const bgColorPopoverOpen = ref<boolean>(false)
const slideContents = ref<Array<string>>([])
const verse = ref<string | undefined>(props.slide?.title)
const searchedBibleBookOptions = ref<string[]>([])
const containerOverflow = ref<string>("overflow-x-auto")

const animatedSlides = computed(() => {
  if (props.slide) {
    return [props.slide]
  }
  return null
})

const nextVerse = computed(() => {
  if (props.slide?.type === slideTypes.bible) {
    const tempVerse = verse.value?.split(":")?.[1]?.includes("-")
      ? Number(verse.value?.split(":")?.[1]?.split("-")?.[1]) + 1
      : Number(verse.value?.split(":")?.[1]) + 1
    return `${verse.value?.split(":")?.[0]}:${tempVerse}`
  }
  return `Verse ${Number(verse.value?.split(" ")?.[1]) + 1}`
})

const previousVerse = computed(() => {
  if (props.slide?.type === slideTypes.bible) {
    const tempVerse = verse.value?.split(":")?.[1]?.includes("-")
      ? Number(verse.value?.split(":")?.[1]?.split("-")?.[0]) - 1
      : Number(verse.value?.split(":")?.[1]) - 1
    return `${verse.value?.split(":")?.[0]}:${tempVerse < 1 ? 1 : tempVerse}`
  }
  return `Verse ${Number(verse.value?.split(" ")?.[1]) - 1}`
})

watch(
  () => props.slide,
  () => {
    // Update slide title when Slide is updated
    verse.value = props.slide?.title

    // Remove toolbar when Slide is updated, if slide.type is not text
    if (props.slide?.type !== slideTypes.text) {
      focusedEditor.value = undefined
    }
  },
  { immediate: true }
)

onMounted(() => {
  useCreateShortcut("ArrowRight", () => {
    if (nextVerse.value) {
      emit("goto-verse", nextVerse.value)
    }
  })
  useCreateShortcut("ArrowLeft", () => {
    if (previousVerse.value) {
      emit("goto-verse", previousVerse.value)
    }
  })
})

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>
emitter.on("pause-inactive-slide-video", () => {
  if (props.slide?.type === slideTypes.media) {
    console.log("pausing video")
  }
})

const onSelectLayout = (data: string) => {
  layoutPopoverOpen.value = false
  const tempSlide: Slide = {
    ...props.slide,
    layout: data,
  }
  emit("slide-update", tempSlide)
}

const onSelectBackground = (
  backgroundType: string,
  data: { video: string; key: string } // type of { imageUrl: string; file: any } for image, or { videoUrl: string; key: string } for video
) => {
  bgImagePopoverOpen.value = false
  bgVideoPopoverOpen.value = false
  bgColorPopoverOpen.value = false

  const tempSlide: Slide = {
    ...props.slide,
    background: data.video || data,
    backgroundVideoKey: data.key || undefined,
    backgroundType,
  }
  emit("slide-update", tempSlide)
}

const onUpdateSlideContent = (editorIndex: number, content: string) => {
  slideContents.value[editorIndex] = content
  const tempSlide: Slide = {
    ...props.slide,
    contents: [...slideContents.value],
  }
  // console.log("updated content", tempSlide)
  tempSlide.name = useSlideName(tempSlide)
  emit("slide-update", tempSlide)
  // emit("update-live-output-slides")
}

// Function to update style of slide that is either active or inactive
const onUpdateSlideStyle = (
  slideStyle: SlideStyle,
  isSlideActive: boolean = true
) => {
  const tempSlide: Slide = {
    ...props.slide,
    slideStyle,
  }
  tempSlide.name = useSlideName(tempSlide)
  emit(isSlideActive ? "slide-update" : "inactive-slide-update", tempSlide)
}

const onUpdateMediaSeekPosition = (slideStyle: SlideStyle) => {
  onUpdateSlideStyle(slideStyle)

  setTimeout(() => {
    onUpdateSlideStyle({ ...slideStyle, mediaSeekPosition: -1 })
  }, 5000)
}

const onUpdateSongLyrics = (song: Song) => {
  const tempSlide: Slide = {
    title: song.title,
    ...props.slide,
    data: song,
  }
  const currentSongVerseNumber = Number(verse.value?.split(" ")?.[1])
  const currentSongVerse = song.verses?.[currentSongVerseNumber - 1]

  tempSlide.name = useSlideName(tempSlide)
  let fontSize = useScreenFontSize(currentSongVerse || "")
  tempSlide.slideStyle = {
    ...tempSlide.slideStyle,
    fontSize: Number(fontSize),
  }
  tempSlide.data = song
  tempSlide.contents = useSlideContent(tempSlide, song, currentSongVerse)
  emit("slide-update", tempSlide)
  // console.log(verse.value)
  useToast().add({
    icon: "i-bx-music",
    title: "Song lyrics updated",
  })
}

const onUpdateSongLines = async (linesPerSlide: number) => {
  // console.log("updating song lines", linesPerSlide)
  const song = (props.slide?.data as Song) || props.slide?.songId
  const tempSong: Song | null = await useSong(song, linesPerSlide)
  // console.log(tempSong)
  if (tempSong) {
    const tempSlide: Slide = {
      title: tempSong.title,
      ...props.slide,
      data: tempSong,
    }
    const currentSongVerseNumber = Number(verse.value?.split(" ")?.[1])
    const currentSongVerse = song.verses?.[currentSongVerseNumber - 1]

    tempSlide.name = useSlideName(tempSlide)
    let fontSize = useScreenFontSize(currentSongVerse || "")
    tempSlide.slideStyle = {
      ...tempSlide.slideStyle,
      fontSize: Number(fontSize),
    }
    tempSlide.data = tempSong
    tempSlide.contents = useSlideContent(tempSlide, tempSong, currentSongVerse)
    emit("slide-update", tempSlide)
    // console.log(verse.value)
    useToast().add({
      icon: "i-tabler-list-numbers",
      title: "Lines per slide updated",
    })
  }
}

const predictVerseInput = (
  element: HTMLElement | undefined,
  specificBook?: string
) => {
  if (verse.value?.trim()) {
    console.log(specificBook)
    const bibleVerseInput = document.getElementById("bible-verse-input")
    if (typeof specificBook === "string") {
      verse.value = `${specificBook} 1:1`
      setTimeout(() => {
        bibleVerseInput?.setSelectionRange(
          specificBook.length + 1,
          specificBook.length + 2
        )
        bibleVerseInput?.focus()
      }, 1000)
    } else if (verse.value.endsWith(" ")) {
      // verse.value = `${verse.value?.trim()} 1:`
      // DO nothing
    } else if (verse.value?.includes(":")) {
      setTimeout(() => {
        element?.setSelectionRange(
          verse.value?.indexOf(":") + 1,
          verse.value?.indexOf(":") + 2
        )
        element?.focus()
      }, 100)
    } else if (searchedBibleBookOptions.value?.[0]) {
      verse.value = `${searchedBibleBookOptions.value?.[0]} 1:1`
      setTimeout(() => {
        element?.setSelectionRange(
          searchedBibleBookOptions.value?.[0].length + 1,
          searchedBibleBookOptions.value?.[0].length + 2
        )
        element?.focus()
      }, 100)
    } else {
      // do nothing
    }
    bibleVerseInput?.focus()
  }
}
</script>

<style scoped>
.verse-preview,
.books-preview {
  visibility: hidden;
  max-height: 0px;
  transition: 0.2s;
}
/* .books-preview {
  visibility: visible;
  max-height: 1400px;
} */
.verse-switch:hover + .verse-preview,
.verse-switch:focus-within + .books-preview,
.verse-preview:hover,
.books-preview:hover {
  opacity: 1;
  visibility: visible;
  max-height: 350px;
}
</style>
