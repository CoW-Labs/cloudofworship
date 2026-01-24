<template>
  <div
    v-if="slide?.layout === slideLayoutTypes.heading_sub"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw;`"
  >
    <div
      v-if="contentVisible"
      class="content"
      :class="[
        useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
        currentState.settings.animations ? 'come-up-1' : '',
      ]"
      v-html="slide?.contents?.[0]"
    ></div>
    <div
      v-if="contentVisible"
      class="content"
      :class="[
        useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
        currentState.settings.animations ? 'come-up-2' : '',
      ]"
      v-html="slide?.contents?.[1]"
    ></div>
  </div>

  <div
    v-else-if="slide?.layout === slideLayoutTypes.full_text"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw;`"
  >
    <div
      v-if="contentVisible"
      class="content"
      :class="[currentState.settings.animations ? 'come-up-1' : '']"
      v-html="slide?.contents?.[1]"
    ></div>
  </div>

  <div
    v-else-if="slide?.layout === slideLayoutTypes.two_column"
    class="slide-layout-ctn flex gap-4 h-[100%] justify-around items-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw;`"
  >
    <div
      v-if="contentVisible"
      class="content"
      :class="[currentState.settings.animations ? 'come-up-1' : '']"
      v-html="slide?.contents?.[0]"
    ></div>
    <div
      v-if="contentVisible"
      class="content"
      :class="[currentState.settings.animations ? 'come-up-2' : '']"
      v-html="slide?.contents?.[1]"
    ></div>
  </div>

  <!-- Bible Layout with Theme Support -->
  <div
    v-else-if="slide?.layout === slideLayoutTypes.bible"
    class="slide-layout-ctn flex h-[100%] justify-center relative"
    :class="[
      bibleThemeClasses.container,
      bibleTheme.layout.labelPosition === 'left' ||
      bibleTheme.layout.labelPosition === 'right'
        ? 'flex-row items-center gap-[2vw]'
        : 'flex-col gap-2',
      bibleTheme.layout.labelPosition === 'right' ? 'flex-row-reverse' : '',
    ]"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw; font-size: ${
      (slide?.slideStyle?.fontSize!!) *
      ((slide?.slideStyle?.fontSizePercent || currentState.settings.slideStyles.fontSizePercent || 100) / 100)
    }vw`"
  >
    <!-- For 'top' label position, render label first -->
    <template v-if="bibleTheme.layout.labelPosition === 'top'">
      <div
        v-if="contentVisible"
        class="content bible-label"
        :class="[
          currentState.settings.animations ? 'come-up-1' : '',
          bibleThemeClasses.label,
        ]"
        v-html="slide?.contents?.[1]"
      ></div>
      <div
        v-if="contentVisible"
        class="content bible-content flex-1"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          currentState.settings.animations ? 'come-up-2' : '',
          bibleThemeClasses.content,
        ]"
        v-html="slide?.contents?.[0]"
      ></div>
    </template>

    <!-- For 'left' label position -->
    <template v-else-if="bibleTheme.layout.labelPosition === 'left'">
      <div
        v-if="contentVisible"
        class="content bible-label writing-mode-vertical rotate-180"
        :class="[
          currentState.settings.animations ? 'come-up-1' : '',
          bibleThemeClasses.label,
        ]"
        v-html="slide?.contents?.[1]"
      ></div>
      <div
        v-if="contentVisible"
        class="content bible-content flex-1"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          currentState.settings.animations ? 'come-up-2' : '',
          bibleThemeClasses.content,
        ]"
        v-html="slide?.contents?.[0]"
      ></div>
    </template>

    <!-- For 'right' label position -->
    <template v-else-if="bibleTheme.layout.labelPosition === 'right'">
      <div
        v-if="contentVisible"
        class="content bible-label writing-mode-vertical"
        :class="[
          currentState.settings.animations ? 'come-up-2' : '',
          bibleThemeClasses.label,
        ]"
        v-html="slide?.contents?.[1]"
      ></div>
      <div
        v-if="contentVisible"
        class="content bible-content flex-1"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          currentState.settings.animations ? 'come-up-1' : '',
          bibleThemeClasses.content,
        ]"
        v-html="slide?.contents?.[0]"
      ></div>
    </template>

    <!-- For 'overlay' label position -->
    <template v-else-if="bibleTheme.layout.labelPosition === 'overlay'">
      <div
        v-if="contentVisible"
        class="content bible-content"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          currentState.settings.animations ? 'come-up-1' : '',
          bibleThemeClasses.content,
        ]"
        v-html="slide?.contents?.[0]"
      ></div>
      <div
        v-if="contentVisible"
        class="content bible-label"
        :class="[
          currentState.settings.animations ? 'come-up-2' : '',
          bibleThemeClasses.label,
        ]"
        v-html="slide?.contents?.[1]"
      ></div>
    </template>

    <!-- Default: 'bottom' label position (Classic) -->
    <template v-else>
      <div
        v-if="contentVisible"
        class="content bible-content"
        :class="[
          useURLFriendlyString(slide?.slideStyle?.font || 'Inter'),
          currentState.settings.animations ? 'come-up-1' : '',
          bibleThemeClasses.content,
        ]"
        v-html="slide?.contents?.[0]"
      ></div>
      <div
        v-if="contentVisible"
        class="content bible-label"
        :class="[
          currentState.settings.animations ? 'come-up-2' : '',
          bibleThemeClasses.label,
        ]"
        v-html="slide?.contents?.[1]"
      ></div>
    </template>
  </div>

  <div
    v-else-if="slide?.layout === slideLayoutTypes.countdown"
    class="slide-layout-ctn flex flex-col gap-2 h-[100%] justify-center"
    :style="`padding: ${padding.top}vw ${padding.right}vw ${padding.bottom}vw ${padding.left}vw; font-size: ${
      (slide?.slideStyle?.fontSize!!) *
      ((slide?.slideStyle?.fontSizePercent || currentState.settings.slideStyles.fontSizePercent || 100) / 100)
    }vw`"
  >
    <div class="content jost" v-html="slide?.contents?.[1]"></div>
    <div
      class="content"
      :class="[useURLFriendlyString(slide?.slideStyle?.font || 'Inter')]"
      v-html="slide?.contents?.[2]"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"
import useTheme, { type BibleTheme } from "~/composables/useTheme"

const props = defineProps<{
  slide: Slide
  padding: { top: number; right: number; bottom: number; left: number }
  contentVisible: boolean
}>()

const { currentState } = storeToRefs(useAppStore())
const { getSlideTheme } = useTheme()

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
      " bg-black/40 px-[2vw] py-[0.5vw] rounded-[0.5vw] inline-block"
  }

  return classes
})
</script>

<style scoped>
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
