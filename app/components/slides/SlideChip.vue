<template>
  <p
    class="text-xs font-medium rounded-full px-2 py-1 inline-flex items-center gap-1 capitalize"
    :class="[getBGBySlideType(slideType)]"
  >
    <component
      :is="getIconBySlideType(slideType)"
      v-if="getIconBySlideType(slideType)"
      class="w-4 h-4"
    />
    {{
      slideType === slideTypes.presentation
        ? "PPT/PDF"
        : slideType === slideTypes.songSetlist
          ? "setlist"
          : slideType
    }}
    {{ slideSubType ? ` (${slideSubType})` : "" }}
    <span
      v-if="slideMode === 'overlay'"
      class="ml-0.5 rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase"
    >
      overlay
    </span>
  </p>
</template>

<script setup lang="ts">
import type { Component } from "vue"
import BibleIcon from "~/components/svgs/BibleIcon.vue"
import SongsIcon from "~/components/svgs/SongsIcon.vue"
import SongSetlistIcon from "~/components/svgs/SongSetlistIcon.vue"
import HymnIcon from "~/components/svgs/HymnIcon.vue"
import TextSlideIcon from "~/components/svgs/TextSlideIcon.vue"
import MediaIcon from "~/components/svgs/MediaIcon.vue"
import CountdownIcon from "~/components/svgs/CountdownIcon.vue"
import PptIcon from "~/components/svgs/PptIcon.vue"
import TimeIcon from "~/components/svgs/TimeIcon.vue"

const props = defineProps({
  slideType: String,
  slideSubType: String,
  darkMode: Boolean,
  slideMode: String,
})

// Mirrors the custom line-icons rendered in QuickActions (see ActionCard's
// actionIconComponentMap) so a slide's chip matches the icon it was created from.
const getIconBySlideType = (slideType?: string): Component | null => {
  switch (slideType) {
    case slideTypes.song:
      return SongsIcon
    case slideTypes.songSetlist:
      return SongSetlistIcon
    case slideTypes.hymn:
      return HymnIcon
    case slideTypes.bible:
      return BibleIcon
    case slideTypes.text:
      return TextSlideIcon
    case slideTypes.media:
      return MediaIcon
    case slideTypes.countdown:
      return CountdownIcon
    case slideTypes.time:
      return TimeIcon
    case slideTypes.presentation:
      return PptIcon
  }
  return null
}
const getBGBySlideType = (slideType?: string) => {
  switch (slideType) {
    case slideTypes.song:
      if (props.darkMode) {
        return "bg-green-100 text-green-700"
      }
      return "bg-green-100 border border-green-500 text-green-700"
    case slideTypes.songSetlist:
      if (props.darkMode) {
        return "bg-emerald-100 text-emerald-700"
      }
      return "bg-emerald-100 border border-emerald-500 text-emerald-700"
    case slideTypes.hymn:
      if (props.darkMode) {
        return "bg-pink-100 text-pink-700"
      }
      return "bg-pink-100 border border-pink-500 text-pink-700"
    case slideTypes.bible:
      if (props.darkMode) {
        return "bg-primary-200 text-primary-700"
      }
      return "bg-primary-200 border border-primary-500 text-primary-700"
    case slideTypes.text:
      if (props.darkMode) {
        return "bg-cyan-100 text-cyan-700"
      }
      return "bg-cyan-100 border border-cyan-500 text-cyan-700"
    case slideTypes.media:
      if (props.darkMode) {
        return "bg-orange-100 text-orange-700"
      }
      return "bg-orange-100 border border-orange-500 text-orange-700"
    case slideTypes.countdown:
      if (props.darkMode) {
        return "bg-gray-100 text-gray-700"
      }
      return "bg-gray-100 border border-gray-500 text-gray-700"
    case slideTypes.time:
      if (props.darkMode) {
        return "bg-slate-100 text-slate-700"
      }
      return "bg-slate-100 border border-slate-500 text-slate-700"
    case slideTypes.presentation:
      if (props.darkMode) {
        return "bg-blue-100 text-blue-700"
      }
      return "bg-blue-100 border border-blue-500 text-blue-700"
  }
  return ""
}
</script>

<style></style>
