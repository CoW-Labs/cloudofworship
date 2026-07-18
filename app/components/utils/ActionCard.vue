<template>
  <div
    ref="cardRow"
    class="action-card-row group relative"
    :class="
      compact
        ? 'border-t first:border-t-0 border-white/80 dark:border-[#171d2b]'
        : ''
    "
    @mouseenter="isCardHovered = true"
    @mouseleave="isCardHovered = false"
  >
    <button
      class="action-card flex items-center gap-3 transition-colors cursor-pointer text-left w-[100%]"
      :class="[
        { 'pointer-events-none opacity-30': isActionDisabled },
        compact
          ? 'min-h-[54px] px-3 py-2.5 hover:bg-white/55 dark:hover:bg-[#2b3242]/60'
          : 'p-4 items-start rounded-lg hover:bg-white dark:hover:bg-[#2b3242]',
      ]"
      @click="handleActionClick"
    >
      <div
        class="icon-ctn relative shrink-0 text-gray-800 dark:text-[#a7afbd] group-hover:text-primary dark:group-hover:text-[#d5dae3] transition-colors"
        :class="compact ? '' : 'mt-0.5'"
      >
        <component :is="iconOverride" v-if="iconOverride" class="w-5 h-5" />
        <RecentClockIcon v-else-if="action?.recentSearch" class="w-5 h-5" />
        <component
          :is="customIconComponent"
          v-else-if="customIconComponent"
          class="w-5 h-5"
        />
        <IconWrapper v-else :name="action?.icon" />
        <IconWrapper
          v-if="showTeamsBadge"
          name="i-bxs-award"
          class="inline-flex w-4 h-4 text-xs -bottom-1.5 -right-2 text-[#FF8980] absolute"
        />
      </div>
      <div class="texts min-w-0">
        <h4
          v-if="action?.searchableOnly"
          class="truncate text-gray-800 dark:text-[#a7afbd]"
          :class="compact ? 'text-sm font-medium' : 'text-base'"
        >
          <span class="font-light italic pr-1 capitalize">
            {{ action?.type || "Action" }}:
          </span>
          <span class="font-semibold">
            {{ action?.name || "" }}
            <span v-if="action?.type === slideTypes.bible">{{
              action?.bibleChapterAndVerse || ""
            }}</span>
          </span>
        </h4>
        <h4
          v-else
          class="font-medium text-sm text-gray-800 dark:text-[#a7afbd] truncate"
        >
          {{ action?.name || "" }}
        </h4>
        <p
          v-if="!compact || showSubtext"
          class="font-light mt-1 text-gray-500 dark:text-[#7d8695]"
          :class="compact ? 'text-xs mt-0.5 truncate' : 'text-xs'"
        >
          <slot name="desc">{{ action?.desc || "" }}</slot>
        </p>
      </div>
    </button>

    <div
      v-if="$slots.actions"
      class="actions flex absolute right-2 top-1/2 -translate-y-1/2"
    >
      <slot name="actions" />
    </div>

    <Teleport to="body">
      <Transition name="preview-fade">
        <div
          v-if="canPreview && previewOpen"
          ref="previewEl"
          class="action-excerpt text-xs w-[300px] max-h-[260px] shadow-lg whitespace-pre-line z-[100] fixed"
          :style="previewPositionStyle"
          @mouseenter="isPreviewHovered = true"
          @mouseleave="isPreviewHovered = false"
        >
          <AppSection heading="Preview" :sub-heading="action?.name || ''">
            <div
              class="rounded-xl bg-gray-100 dark:bg-[#2b3242] max-h-[190px] overflow-y-auto"
            >
              <p class="px-3 py-3 whitespace-pre-line">
                {{
                  previewContent ||
                  (previewError ? "Preview unavailable" : "Loading...")
                }}
              </p>
            </div>
          </AppSection>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import type { Component } from "vue"
import type { QuickAction } from "~/types"
import type { FeatureFlagKey } from "~/composables/useFeatureFlags"
import BibleIcon from "~/components/svgs/BibleIcon.vue"
import SearchIcon from "~/components/svgs/SearchIcon.vue"
import AddSongIcon from "~/components/svgs/AddSongIcon.vue"
import LibraryIcon from "~/components/svgs/LibraryIcon.vue"
import SongsIcon from "~/components/svgs/SongsIcon.vue"
import MediaIcon from "~/components/svgs/MediaIcon.vue"
import PptIcon from "~/components/svgs/PptIcon.vue"
import PdfIcon from "~/components/svgs/PDFIcon.vue"
import BannersAndAlertsIcon from "~/components/svgs/BannersAndAlertsIcon.vue"
import CountdownIcon from "~/components/svgs/CountdownIcon.vue"
import SchedulesIcon from "~/components/svgs/SchedulesIcon.vue"
import YouTubeIcon from "~/components/svgs/YouTubeIcon.vue"
import VimeoIcon from "~/components/svgs/VimeoIcon.vue"
import SettingsIcon from "~/components/svgs/SettingsIcon.vue"
import TranscribeSermonIcon from "~/components/svgs/TranscribeSermonIcon.vue"
import TextSlideIcon from "~/components/svgs/TextSlideIcon.vue"
import SongSetlistIcon from "~/components/svgs/SongSetlistIcon.vue"
import HymnIcon from "~/components/svgs/HymnIcon.vue"
import TemplatesIcon from "~/components/svgs/TemplatesIcon.vue"
import RecentClockIcon from "~/components/svgs/RecentClockIcon.vue"
import TimeIcon from "~/components/svgs/TimeIcon.vue"

const props = defineProps<{
  action: QuickAction
  actionSuffix?: String
  compact?: boolean
  showSubtext?: boolean
  iconOverride?: Component
  active?: boolean
}>()

// Maps an action name to a custom line-icon component. Actions without an entry
// keep their original iconify icon (rendered via IconWrapper).
const actionIconComponentMap: Record<string, Component> = {
  "new-bible": BibleIcon,
  "update-or-create-bible": BibleIcon,
  "new-search-bible": SearchIcon,
  "new-hymn": HymnIcon,
  "new-transcribe": TranscribeSermonIcon,
  "add-song": AddSongIcon,
  "new-library": LibraryIcon,
  "new-song": SongsIcon,
  "new-song-setlist": SongSetlistIcon,
  "new-slide": TextSlideIcon,
  "new-media": MediaIcon,
  "new-youtube-video": YouTubeIcon,
  "new-vimeo-video": VimeoIcon,
  "new-templates": TemplatesIcon,
  "new-alert": BannersAndAlertsIcon,
  "new-countdown": CountdownIcon,
  "new-time-slide": TimeIcon,
  "new-presentation": PptIcon,
  "new-presentation-from-pdf": PdfIcon,
  "open-schedule-modal": SchedulesIcon,
  "new-schedules-list": SchedulesIcon,
  "open-settings": SettingsIcon,
}

const customIconComponent = computed(
  () => actionIconComponentMap[props.action?.action || ""] || null
)

// Hover preview (hymn/bible/song) — shows lyrics/scripture excerpt on hover.
// Teleported to <body> and fixed-positioned via JS so it escapes the scrollable
// QuickActions panel instead of being clipped/scrolled inside it.
const previewOpen = ref(false)
const previewContent = ref("")
const previewError = ref(false)
const cardRow = ref<HTMLElement | null>(null)
const previewEl = ref<HTMLElement | null>(null)
const previewPosition = ref({ top: 0, left: 0 })
const isCardHovered = ref(false)
const isPreviewHovered = ref(false)
const isSearchInputFocused = ref(false)

const previewPositionStyle = computed(() => ({
  top: `${previewPosition.value.top}px`,
  left: `${previewPosition.value.left}px`,
}))

const canPreview = computed(() => {
  if (props.action?.type === slideTypes.hymn && props.action?.hymnIndex)
    return true
  if (props.action?.type === slideTypes.bible && props.action?.bibleBookIndex)
    return true
  if (props.action?.type === slideTypes.song && props.action?.songData?.lyrics)
    return true
  return false
})

// Vue reuses ActionCard instances across re-renders when a list is keyed by
// position (e.g. search result index) rather than content identity — the
// `action` prop then changes under an existing instance. This identity lets
// us detect that and invalidate the cached preview instead of showing the
// previous item's content.
const previewIdentity = computed(() => {
  switch (props.action?.type) {
    case slideTypes.hymn:
      return `hymn:${props.action?.hymnIndex}`
    case slideTypes.bible:
      return `bible:${props.action?.bibleBookIndex}:${props.action?.bibleChapterAndVerse}`
    case slideTypes.song:
      return `song:${props.action?.songData?.lyrics}`
    default:
      return ""
  }
})

const previewWidth = 300
const margin = 8

const updatePreviewPosition = () => {
  const rowRect = cardRow.value?.getBoundingClientRect()
  if (!rowRect) return

  let left = rowRect.right + margin
  if (left + previewWidth + margin > window.innerWidth) {
    left = rowRect.left - previewWidth - margin
  }
  left = Math.min(
    Math.max(left, margin),
    window.innerWidth - previewWidth - margin
  )

  const previewHeight = previewEl.value?.getBoundingClientRect().height || 0
  let top = rowRect.top + rowRect.height / 2 - previewHeight / 2
  top = Math.min(
    Math.max(top, margin),
    window.innerHeight - previewHeight - margin
  )

  previewPosition.value = { top, left }
}

// Hover owns its own lifecycle so the teleported preview can remain open while
// the pointer crosses the small gap between the card and preview. `active` is
// reserved for keyboard navigation and is only honoured while the search input
// belonging to this action list actually has focus.
const isInputInThisActionList = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (!target.matches("input, textarea, [contenteditable='true']")) return false

  const actionsList = cardRow.value?.closest(".actions-ctn")
  const actionListContext = actionsList?.parentElement
  return !!actionListContext?.contains(target)
}

const handleDocumentFocusIn = (event: FocusEvent) => {
  isSearchInputFocused.value = isInputInThisActionList(event.target)
}

const handleDocumentFocusOut = (event: FocusEvent) => {
  isSearchInputFocused.value = isInputInThisActionList(event.relatedTarget)
}

const shouldShowPreview = computed(
  () =>
    canPreview.value &&
    (isCardHovered.value ||
      isPreviewHovered.value ||
      (!!props.active && isSearchInputFocused.value))
)

let previewTimeout: ReturnType<typeof setTimeout> | null = null
const clearPreviewTimeout = () => {
  if (previewTimeout) {
    clearTimeout(previewTimeout)
    previewTimeout = null
  }
}

watch(shouldShowPreview, (show) => {
  clearPreviewTimeout()
  if (show) {
    previewTimeout = setTimeout(
      async () => {
        updatePreviewPosition()
        previewOpen.value = true
        await nextTick()
        updatePreviewPosition()
      },
      previewOpen.value ? 0 : 200
    )
  } else {
    previewTimeout = setTimeout(() => {
      previewOpen.value = false
    }, 100)
  }
})

onMounted(() => {
  isSearchInputFocused.value = isInputInThisActionList(document.activeElement)
  document.addEventListener("focusin", handleDocumentFocusIn)
  document.addEventListener("focusout", handleDocumentFocusOut)
})

onUnmounted(() => {
  clearPreviewTimeout()
  document.removeEventListener("focusin", handleDocumentFocusIn)
  document.removeEventListener("focusout", handleDocumentFocusOut)
})

const fetchPreviewContent = async () => {
  if (!canPreview.value || previewContent.value) return

  if (props.action?.type === slideTypes.hymn) {
    const hymn = await useHymn(props.action?.hymnIndex || "")
    if (hymn) {
      const verses = [...(hymn.verses || [])]
      if (hymn.chorus && hymn.chorus !== "false")
        verses.splice(1, 0, hymn.chorus)
      previewContent.value = verses.join("\n\n").trim()
    } else {
      previewError.value = true
    }
  } else if (props.action?.type === slideTypes.bible) {
    const label = `${props.action?.bibleBookIndex}:${
      props.action?.bibleChapterAndVerse || "1:1"
    }`
    const scripture = await useScripture(label)
    previewContent.value = (scripture?.content as string) || ""
    if (!scripture) previewError.value = true
  } else if (props.action?.type === slideTypes.song) {
    previewContent.value = props.action?.songData?.lyrics?.trim() || ""
    if (!previewContent.value) previewError.value = true
  }
}

watch(previewOpen, (open) => {
  if (open) fetchPreviewContent()
})

// The underlying action changed under this (reused) instance — drop the
// stale cached content and, if the preview is currently showing, refetch
// immediately instead of leaving last item's content on screen.
watch(previewIdentity, () => {
  previewContent.value = ""
  previewError.value = false
  if (previewOpen.value) fetchPreviewContent()
})

const { requiresTeams, hasAccessToFeature } = useSubscription()
const { isEnabled: isPremiumFeatureEnabled } = useFeatureFlags("teams")
const emitter = useNuxtApp().$emitter as any

// Check if feature flag is enabled for this action
const { checkFlag } = useFeatureFlags()
const isFeatureFlagEnabled = computed(() => {
  if (!props.action?.featureFlag) return true // No flag required, enabled by default
  return checkFlag(props.action.featureFlag as FeatureFlagKey)
})

// Determine if action should be disabled
const isActionDisabled = computed(() => {
  // Disable if marked as unreleased and no feature flag is enabled
  if (props.action?.unreleased) {
    return true
  }
  // Disable if feature flag is specified but not enabled
  if (props.action?.featureFlag && !isFeatureFlagEnabled.value) {
    return true
  }
  return false
})

const emitParameter = computed(() => {
  switch (props.action?.type) {
    case slideTypes.bible:
      return props.action?.bibleChapterAndVerse
        ? `${props.action?.bibleBookIndex}:${props.action?.bibleChapterAndVerse}`
        : ""
    case slideTypes.hymn:
      return `${props.action?.hymnIndex}`
    case slideTypes.song:
      return props.action?.songData || props.action?.actionArg || ""
    case slideTypes.countdown:
      return props.action?.countdownData || props.action?.actionArg || ""
    default:
      return props.action?.actionArg || ""
  }
})

// Show teams badge if the action requires teams subscription
const showTeamsBadge = computed(() => {
  return (
    requiresTeams(props.action?.action || "") &&
    isPremiumFeatureEnabled.value &&
    !hasAccessToFeature(props.action?.action || "")
  )
})

const handleActionClick = () => {
  const actionName = props.action?.action || ""

  // Check if action is disabled due to feature flag or unreleased status
  if (isActionDisabled.value) {
    return
  }

  // Check if user has access to this feature
  if (!hasAccessToFeature(actionName) && isPremiumFeatureEnabled.value) {
    // Show upgrade modal instead of executing the action
    emitter.emit("show-upgrade-modal")
    usePosthogCapture("TEAMS_FEATURE_BLOCKED", {
      feature: actionName,
    })
    return
  }

  // Execute the action normally
  useGlobalEmit(
    `${props.action?.action}${
      props.actionSuffix ? `-${props.actionSuffix}` : ""
    }`,
    emitParameter.value
  )
}
</script>

<style scoped>
.preview-fade-enter-active,
.preview-fade-leave-active {
  transition: opacity 0.12s ease;
}
.preview-fade-enter-from,
.preview-fade-leave-to {
  opacity: 0;
}
</style>
