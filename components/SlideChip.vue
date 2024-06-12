<template>
  <p
    class="text-xs font-medium rounded-full px-2 py-1 inline-flex gap-1 capitalize"
    :class="[getBGBySlideType(slideType)]"
  >
    <IconWrapper :name="getIconBySlideType(slideType)" size="4" />
    {{ slideType }} {{ slideSubType ? ` (${slideSubType})` : "" }}
  </p>
</template>

<script setup>
const props = defineProps({
  slideType: String,
  slideSubType: String,
  darkMode: Boolean,
})
const getIconBySlideType = (slideType) => {
  switch (slideType) {
    case slideTypes.song:
      return "i-bx-music"
    case slideTypes.hymn:
      return "i-bx-church"
    // case slideTypes.sermon:
    //   return "i-bx-slideshow"
    case slideTypes.bible:
      return "i-bx-bible"
    case slideTypes.text:
      return "i-bx-text"
    case slideTypes.media:
      return "i-bx-image"
    // case slideTypes.carousel:
    //   return "i-bx-carousel"
    case slideTypes.countdown:
      return "i-bx-time"
  }
  return ""
}
const getBGBySlideType = (slideType) => {
  switch (slideType) {
    case slideTypes.song:
      if (props.darkMode) {
        return "bg-green-700 text-green-100"
      }
      return "bg-green-100 border border-green-500 text-green-700"
    case slideTypes.hymn:
      if (props.darkMode) {
        return "bg-pink-700 text-pink-100"
      }
      return "bg-pink-100 border border-pink-500 text-pink-700"
    case slideTypes.bible:
      if (props.darkMode) {
        return "bg-primary-700 text-primary-100"
      }
      return "bg-primary-200 border border-primary-500 text-primary-700"
    case slideTypes.text:
      if (props.darkMode) {
        return "bg-cyan-700 text-cyan-100"
      }
      return "bg-cyan-100 border border-cyan-500 text-cyan-700"
    case slideTypes.media:
      if (props.darkMode) {
        return "bg-orange-700 text-orange-100"
      }
      return "bg-orange-100 border border-orange-500 text-orange-700"
    case slideTypes.countdown:
      if (props.darkMode) {
        return "bg-gray-700 text-gray-100"
      }
      return "bg-gray-100 border border-gray-500 text-gray-700"
  }
  return ""
}
</script>

<style></style>
