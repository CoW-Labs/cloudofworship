<template>
  <div
    v-if="slide?.layout === slideLayoutTypes.heading_sub"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}cqw ${padding.right}cqw ${padding.bottom}cqw ${padding.left}cqw;`"
  >
    <div
      v-if="contentVisible"
      :key="contentKey(0)"
      class="content"
      :class="[
        inheritedFontClass,
        verseTransitionClass,
        { 'balanced-wrap': !usesTipTapTextStyles },
      ]"
      :style="verseTransitionStyleVar"
      v-html="getSlideContentHtml(slide?.contents?.[0])"
    ></div>
    <div
      v-if="contentVisible"
      :key="contentKey(1)"
      class="content"
      :class="[
        inheritedFontClass,
        verseTransitionClass,
        { 'balanced-wrap': !usesTipTapTextStyles },
      ]"
      :style="verseTransitionStyleVar"
      v-html="getSlideContentHtml(slide?.contents?.[1])"
    ></div>
  </div>

  <div
    v-else-if="slide?.layout === slideLayoutTypes.full_text"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="fullTextLayoutStyle"
  >
    <div
      v-if="contentVisible"
      ref="autoFitEl"
      :key="contentKey(1)"
      class="content"
      :class="[
        inheritedFontClass,
        verseTransitionClass,
        { 'balanced-wrap': !usesTipTapTextStyles },
      ]"
      :style="[verseTransitionStyleVar, autoFitStyle]"
      v-html="getSlideContentHtml(slide?.contents?.[1])"
    ></div>
  </div>

  <div
    v-else-if="slide?.layout === slideLayoutTypes.two_column"
    class="slide-layout-ctn flex gap-4 h-[100%] justify-around items-center"
    :style="`padding: ${padding.top}cqw ${padding.right}cqw ${padding.bottom}cqw ${padding.left}cqw;`"
  >
    <div
      v-if="contentVisible"
      :key="contentKey(0)"
      class="content"
      :class="[verseTransitionClass]"
      :style="verseTransitionStyleVar"
      v-html="getSlideContentHtml(slide?.contents?.[0])"
    ></div>
    <div
      v-if="contentVisible"
      :key="contentKey(1)"
      class="content"
      :class="[verseTransitionClass]"
      :style="verseTransitionStyleVar"
      v-html="getSlideContentHtml(slide?.contents?.[1])"
    ></div>
  </div>

  <!-- Bible Layout with Theme Support.
       Note the conditional `relative`: the overlay theme deliberately leaves
       this box unpositioned so its scrim and label resolve against
       `.live-output` (the slide frame) instead of against this padded,
       shrink-wrapping container. Every other theme keeps its own context. -->
  <div
    v-else-if="slide?.layout === slideLayoutTypes.bible"
    class="slide-layout-ctn flex h-[100%] justify-center"
    :class="[
      bibleThemeClasses.container,
      bibleTheme.layout.labelPosition === 'overlay' ? '' : 'relative',
      bibleTheme.layout.labelPosition === 'left' ||
      bibleTheme.layout.labelPosition === 'right'
        ? 'flex-row items-center gap-[2cqw]'
        : 'flex-col gap-2',
      bibleTheme.layout.labelPosition === 'right' ? 'flex-row-reverse' : '',
    ]"
    :style="`padding: ${padding.top}cqw ${padding.right}cqw ${padding.bottom}cqw ${padding.left}cqw; font-size: ${
      (slide?.slideStyle?.fontSize!!) *
      ((slide?.slideStyle?.fontSizePercent || currentState.settings.slideStyles.fontSizePercent || 100) / 100)
    }cqw`"
  >
    <!-- For 'top' label position, render label first -->
    <template v-if="bibleTheme.layout.labelPosition === 'top'">
      <div
        v-if="contentVisible"
        :key="contentKey(1)"
        class="content bible-label"
        :class="[verseTransitionClass, bibleThemeClasses.label]"
        :style="verseTransitionStyleVar"
        v-html="getSlideContentHtml(slide?.contents?.[1])"
      ></div>
      <div
        v-if="contentVisible"
        :key="contentKey(0)"
        ref="autoFitEl"
        class="content bible-content flex-1"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          verseTransitionClass,
          bibleThemeClasses.content,
        ]"
        :style="[verseTransitionStyleVar, autoFitStyle]"
        v-html="getSlideContentHtml(slide?.contents?.[0])"
      ></div>
    </template>

    <!-- For 'left' label position -->
    <template v-else-if="bibleTheme.layout.labelPosition === 'left'">
      <div
        v-if="contentVisible"
        :key="contentKey(1)"
        class="content bible-label writing-mode-vertical rotate-180"
        :class="[verseTransitionClass, bibleThemeClasses.label]"
        :style="verseTransitionStyleVar"
        v-html="getSlideContentHtml(slide?.contents?.[1])"
      ></div>
      <div
        v-if="contentVisible"
        :key="contentKey(0)"
        ref="autoFitEl"
        class="content bible-content flex-1"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          verseTransitionClass,
          bibleThemeClasses.content,
        ]"
        :style="[verseTransitionStyleVar, autoFitStyle]"
        v-html="getSlideContentHtml(slide?.contents?.[0])"
      ></div>
    </template>

    <!-- For 'right' label position -->
    <template v-else-if="bibleTheme.layout.labelPosition === 'right'">
      <div
        v-if="contentVisible"
        :key="contentKey(1)"
        class="content bible-label writing-mode-vertical"
        :class="[verseTransitionClass, bibleThemeClasses.label]"
        :style="verseTransitionStyleVar"
        v-html="getSlideContentHtml(slide?.contents?.[1])"
      ></div>
      <div
        v-if="contentVisible"
        :key="contentKey(0)"
        ref="autoFitEl"
        class="content bible-content flex-1"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          verseTransitionClass,
          bibleThemeClasses.content,
        ]"
        :style="[verseTransitionStyleVar, autoFitStyle]"
        v-html="getSlideContentHtml(slide?.contents?.[0])"
      ></div>
    </template>

    <!-- For 'overlay' label position -->
    <template v-else-if="bibleTheme.layout.labelPosition === 'overlay'">
      <!-- Scrim: pinned to the bottom edge of the slide frame, full bleed and
           a fixed height, so it reads as a vignette on the output rather than a
           box that grows and shrinks with the reference text. -->
      <div
        class="bible-overlay-scrim absolute inset-x-0 bottom-0 h-[14cqw] bg-gradient-to-t from-black/80 to-transparent pointer-events-none"
      ></div>
      <div
        v-if="contentVisible"
        :key="contentKey(0)"
        ref="autoFitEl"
        class="content bible-content"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          verseTransitionClass,
          bibleThemeClasses.content,
        ]"
        :style="[verseTransitionStyleVar, autoFitStyle]"
        v-html="getSlideContentHtml(slide?.contents?.[0])"
      ></div>
      <div
        v-if="contentVisible"
        :key="contentKey(1)"
        class="content bible-label"
        :class="[verseTransitionClass, bibleThemeClasses.label]"
        :style="verseTransitionStyleVar"
        v-html="getSlideContentHtml(slide?.contents?.[1])"
      ></div>
    </template>

    <!-- Default: 'bottom' label position (Classic) -->
    <template v-else>
      <div
        v-if="contentVisible"
        :key="contentKey(0)"
        ref="autoFitEl"
        class="content bible-content"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          verseTransitionClass,
          bibleThemeClasses.content,
        ]"
        :style="[verseTransitionStyleVar, autoFitStyle]"
        v-html="getSlideContentHtml(slide?.contents?.[0])"
      ></div>
      <div
        v-if="contentVisible"
        :key="contentKey(1)"
        class="content bible-label"
        :class="[verseTransitionClass, bibleThemeClasses.label]"
        :style="verseTransitionStyleVar"
        v-html="getSlideContentHtml(slide?.contents?.[1])"
      ></div>
    </template>
  </div>

  <div
    v-else-if="slide?.layout === slideLayoutTypes.countdown"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}cqw ${padding.right}cqw ${padding.bottom}cqw ${padding.left}cqw; font-size: ${
      (slide?.slideStyle?.fontSize!!) *
      ((slide?.slideStyle?.fontSizePercent || currentState.settings.slideStyles.fontSizePercent || 100) / 100)
    }cqw`"
  >
    <div
      v-if="hasCountdownTitle"
      class="content jost"
      v-html="getSlideContentHtml(slide?.contents?.[1])"
    ></div>
    <div
      class="content"
      :class="[useURLFriendlyString(slide?.slideStyle?.font || 'Inter')]"
      v-html="getSlideContentHtml(slide?.contents?.[2])"
    ></div>
  </div>

  <div
    v-else-if="slide?.layout === slideLayoutTypes.time"
    class="slide-layout-ctn flex flex-col gap-[1cqw] h-[100%] justify-center"
    :style="`padding: ${padding.top}cqw ${padding.right}cqw ${padding.bottom}cqw ${padding.left}cqw; font-size: ${
      (slide?.slideStyle?.fontSize || 17.5) *
      ((slide?.slideStyle?.fontSizePercent || currentState.settings.slideStyles.fontSizePercent || 100) / 100)
    }cqw`"
  >
    <div
      v-if="contentVisible && slide?.contents?.[1]"
      class="content jost"
      v-html="getSlideContentHtml(slide.contents[1])"
    ></div>
    <div
      v-if="contentVisible"
      class="content leading-none opacity-95"
      :class="[useURLFriendlyString(slide?.slideStyle?.font || 'Inter')]"
    >
      {{ formattedTime }}
    </div>
  </div>

  <InterludeView
    v-else-if="slide?.layout === slideLayoutTypes.interlude"
    :slide="slide"
  />
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import {
  buildTranslationLookup,
  isTranslationShown,
  getSongTranslation,
  songOnSlide,
  withSongTranslation,
} from "~/utils/songTranslation"
import type { Countdown, Slide } from "~/types"
import useTheme, { type BibleTheme } from "~/composables/useTheme"
import {
  cancelLayoutJob,
  scheduleLayoutJob,
  type LayoutJob,
} from "~/utils/layoutBatch"

const props = defineProps<{
  slide: Slide
  padding: { top: number; right: number; bottom: number; left: number }
  contentVisible: boolean
}>()

const { currentState } = storeToRefs(useAppStore())
const formattedTime = useLiveClock()
const { getSlideTheme } = useTheme()
const usesTipTapTextStyles = computed(
  () => props.slide.type === slideTypes.text
)
const hasCountdownTitle = computed(
  () =>
    props.slide.type === slideTypes.countdown &&
    Boolean((props.slide.data as Countdown | undefined)?.content?.trim())
)
const inheritedFontClass = computed(() =>
  usesTipTapTextStyles.value
    ? ""
    : useURLFriendlyString(props.slide?.slideStyle?.font || "Inter")
)
const fullTextLayoutStyle = computed(() => {
  const paddingStyle = `padding: ${props.padding.top}cqw ${props.padding.right}cqw ${props.padding.bottom}cqw ${props.padding.left}cqw;`
  if (usesTipTapTextStyles.value) return paddingStyle

  const fontSize =
    (props.slide?.slideStyle?.fontSize || 0) *
    ((props.slide?.slideStyle?.fontSizePercent ||
      currentState.value.settings.slideStyles.fontSizePercent ||
      100) /
      100)
  return `${paddingStyle} font-size: ${fontSize}cqw;`
})

const lineBackgroundSelector =
  "p:not(.scripture-label):not(.song-label):not(.countdown-label):not(.copyright-content), h1, h2, h3, h4"

// The song's translation, keyed by lyric line, while the slide shows it.
const translationLookup = computed(() => {
  if (!isTranslationShown(props.slide)) return null
  const song = songOnSlide(props.slide)
  const translation = getSongTranslation(song)
  return song && translation ? buildTranslationLookup(song, translation) : null
})

const getSlideContentHtml = (rawContent = "") => {
  const content = translationLookup.value
    ? withSongTranslation(rawContent, translationLookup.value)
    : rawContent
  if (
    usesTipTapTextStyles.value ||
    !props.slide?.slideStyle?.textLinesBackground ||
    !content
  ) {
    return content
  }

  if (typeof document === "undefined") {
    return content
  }

  const container = document.createElement("div")
  container.innerHTML = content
  container.querySelectorAll(lineBackgroundSelector).forEach((element) => {
    const hasHighlight = Array.from(element.children).some((child) =>
      child.classList.contains("text-lines-background-highlight")
    )

    if (hasHighlight) {
      return
    }

    const highlight = document.createElement("span")
    highlight.className = "text-lines-background-highlight"
    while (element.firstChild) {
      highlight.appendChild(element.firstChild)
    }
    element.appendChild(highlight)
  })

  return container.innerHTML
}

// Get the current theme for Bible slides
const bibleTheme = computed<BibleTheme>(() => {
  return getSlideTheme(props.slide)
})

// Computed classes based on theme
const bibleThemeClasses = computed(() => {
  const theme = bibleTheme.value
  const classes = {
    container: theme.cssClasses.container || "",
    content: theme.cssClasses.content || "",
    label: theme.cssClasses.label || "",
  }

  // Add label size classes
  if (theme.layout.labelSize === "large") {
    classes.label += " bible-label-large"
  } else if (theme.layout.labelSize === "xlarge") {
    classes.label += " bible-label-xlarge"
  }

  // Add label background classes
  if (
    theme.layout.labelBackground &&
    theme.layout.labelPosition !== "overlay"
  ) {
    classes.label +=
      " bg-black/40 px-[2cqw] py-[0.5cqw] rounded-[0.5cqw] inline-block"
  }

  return classes
})

// Resolves the verse/line-to-line transition setting to its CSS animation
// class. Off by default.
const verseTransitionEnabled = computed(
  () => (currentState.value.settings.verseTransitionStyle ?? "off") !== "off"
)
const verseTransitionClass = computed(() => {
  const style = currentState.value.settings.verseTransitionStyle ?? "off"
  if (style === "slide-up") return "verse-transition-translate-up"
  if (style === "fade") return "verse-transition-fade"
  return ""
})

// Key for a content slot. Only changes per verse when a transition is enabled,
// so Vue remounts the div and replays the CSS animation. When off, the key is
// stable per slot so content patches IN PLACE — no remount, no re-parse of the
// v-html, and no live-vs-editor desync flash on navigation.
const contentKey = (index: number) =>
  verseTransitionEnabled.value
    ? `${index}::${props.slide?.contents?.[index] ?? ""}`
    : `slot-${index}`

// Duration for the verse transition animation, user-adjustable (0-1.5s).
const verseTransitionStyleVar = computed(() => {
  const interval = currentState.value.settings.verseTransitionInterval ?? 0.3
  return { animationDuration: `${interval}s` }
})
// Auto-fit: shrink the lyric text just enough that its lines fit on one row
// each. Text width scales linearly with font size, so one nowrap measurement
// of every line gives the exact factor each line needs.
//
// A line that would need shrinking below AUTO_FIT_MIN_SCALE (60% of the slide's
// font size) is left to wrap rather than counted: it wraps at the floor anyway,
// so letting it set the size would make the whole verse tiny and still not fit
// it. The size is set by the longest line that *can* fit.
const AUTO_FIT_MIN_SCALE = 0.6
const autoFitEl = ref<HTMLElement | null>(null)
const autoFitScale = ref(1)
// Lyrics only: the toolbar offers the toggle on song, setlist and hymn
// slides, and the Bible layout shares this markup for scripture.
const autoFitEnabled = computed(
  () =>
    Boolean(props.slide?.slideStyle?.autoFitLines) &&
    (props.slide?.type === slideTypes.song ||
      props.slide?.type === slideTypes.songSetlist ||
      props.slide?.type === slideTypes.hymn)
)
const autoFitStyle = computed(() =>
  autoFitEnabled.value && autoFitScale.value < 1
    ? { fontSize: `${autoFitScale.value * 100}%` }
    : {}
)

/**
 * The width the lyrics may use, read from the layout box around them rather
 * than from the lyric element. That element shrinks to its own text, so its
 * width falls every time the text does: measuring it fed each fit's result
 * back into the next, which shrank the text again until a line dropped past
 * the floor and the size sprang back up. The surrounding box does not move
 * with the text. Labels beside the lyrics (the Bible layout's left and right
 * label positions) are taken off.
 */
const availableWidth = (el: HTMLElement) => {
  const parent = el.parentElement
  if (!parent) return el.clientWidth
  const style = getComputedStyle(parent)
  let width =
    parent.clientWidth -
    parseFloat(style.paddingLeft || "0") -
    parseFloat(style.paddingRight || "0")
  if (style.flexDirection.startsWith("row")) {
    const siblings = Array.from(parent.children).filter(
      (child): child is HTMLElement => child !== el && child instanceof HTMLElement
    )
    const gap = parseFloat(style.columnGap || "0") || 0
    width -= siblings.reduce((sum, child) => sum + child.offsetWidth + gap, 0)
  }
  return Math.max(0, width)
}

/** Width of every rendered line box, read while the text cannot wrap. */
const measureLineWidths = (el: HTMLElement) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  const lines = new Map<number, { left: number; right: number }>()
  for (const rect of Array.from(range.getClientRects())) {
    if (!rect.width) continue
    // Fragments of one line share a top edge, give or take subpixel rounding.
    const key = Math.round(rect.top / 4)
    const line = lines.get(key)
    if (line) {
      line.left = Math.min(line.left, rect.left)
      line.right = Math.max(line.right, rect.right)
    } else {
      lines.set(key, { left: rect.left, right: rect.right })
    }
  }
  range.detach?.()
  return [...lines.values()].map((line) => line.right - line.left)
}

// The fit runs as a batched layout job (see utils/layoutBatch): every preview
// on screen measures in the same frame, so opening or scrolling a schedule
// lays the page out twice in all rather than twice per slide.
let measuring: HTMLElement | null = null
let available = 0
let previousWhiteSpace = ""
let widths: number[] = []

const fitJob: LayoutJob = {
  read: () => {
    measuring = autoFitEnabled.value ? autoFitEl.value : null
    available = measuring ? availableWidth(measuring) : 0
    if (!available) measuring = null
  },
  write: () => {
    if (!measuring) return
    previousWhiteSpace = measuring.style.whiteSpace
    measuring.style.whiteSpace = "nowrap"
  },
  measure: () => {
    widths = measuring ? measureLineWidths(measuring) : []
  },
  finish: () => {
    if (!measuring) return
    measuring.style.whiteSpace = previousWhiteSpace
    measuring = null
    if (!widths.length) return

    // Each line's width was measured at the current scale, so this is the
    // scale that would make it exactly fill the row — the same answer
    // whatever size the text is at now. 0.98 leaves room for subpixel
    // rounding.
    const scales = widths
      .map((width) => autoFitScale.value * (available / width) * 0.98)
      // Lines needing more than the floor are left to wrap (see above)
      .filter((scale) => scale >= AUTO_FIT_MIN_SCALE)
    const next = Math.min(1, ...scales)
    // Ignore rounding-sized changes so a refit never nudges the text back and
    // forth by a pixel.
    if (Math.abs(next - autoFitScale.value) > 0.005) autoFitScale.value = next
  },
}

const scheduleFit = () => {
  if (!autoFitEl.value || !autoFitEnabled.value) {
    cancelLayoutJob(fitJob)
    autoFitScale.value = 1
    return
  }
  scheduleLayoutJob(fitJob)
}

watch(
  () => [
    autoFitEl.value,
    autoFitEnabled.value,
    // Lyrics are contents[1] without labels (full text) and contents[0] with
    // them (the Bible layout).
    props.slide?.contents?.[0],
    props.slide?.contents?.[1],
    props.slide?.layout,
    props.slide?.slideStyle?.fontSize,
    props.slide?.slideStyle?.fontSizePercent,
    props.slide?.slideStyle?.font,
    props.slide?.slideStyle?.textBold,
    props.slide?.slideStyle?.lettercase,
    props.slide?.slideStyle?.textLinesBackground,
    props.slide?.slideStyle?.showTranslation,
  ],
  scheduleFit,
  { immediate: true }
)

// Refit when the slide's box changes size (a window resized, a panel dragged).
// The box around the lyrics, never the lyrics themselves: those resize every
// time a fit changes the font, and observing them looped. Late web fonts
// change glyph widths too, so refit once they finish loading. Only slides with
// auto-fit on are observed: every other preview would otherwise wake up on
// each frame of a panel drag for nothing.
watch(
  () => [autoFitEl.value, autoFitEnabled.value] as const,
  ([el, enabled], _old, onCleanup) => {
    const parent = el?.parentElement
    if (!enabled || !parent || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => scheduleFit())
    observer.observe(parent)
    onCleanup(() => observer.disconnect())
  }
)
onMounted(() => {
  document.fonts?.ready.then(scheduleFit)
})
onBeforeUnmount(() => cancelLayoutJob(fitJob))
</script>

<style scoped>
/* Keeps a wrapped line from stranding its last word ("...MY STRENGTH MY /
   SHIELD") without narrowing every row the way `balance` does, which left
   wide empty margins either side. Inherited by the paragraphs. */
.balanced-wrap {
  text-wrap: pretty;
}

.writing-mode-vertical {
  writing-mode: vertical-rl;
}

.bible-label-large :deep(.scripture-label) {
  font-size: 150% !important;
}

.bible-label-xlarge :deep(.scripture-label) {
  font-size: 200% !important;
}
</style>
