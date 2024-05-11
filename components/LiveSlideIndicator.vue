<template>
  <Transition name="fade">
    <div
      v-if="visible"
      class="live-indicator text-red-500 text-xs font-bold flex gap-2 items-center absolute top-0 right-0"
    >
      <div class="red-dot w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
      <template v-if="!hideText">LIVE</template>
    </div>
  </Transition>
</template>
<script setup>
const props = defineProps({
  visible: Boolean,
  hideText: Boolean,
})
</script>
<style scoped></style>
