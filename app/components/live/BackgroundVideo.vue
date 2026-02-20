<template>
  <video
    ref="video"
    v-show="visible"
    :src="source"
    :loop="repeat"
    class="h-[100%] w-[100%] object-cover absolute inset-0"
    crossorigin="anonymous"
  ></video>
</template>

<script setup lang="ts">
const props = defineProps<{
  source: string
  repeat: boolean
  visible: boolean
}>()
</script>
