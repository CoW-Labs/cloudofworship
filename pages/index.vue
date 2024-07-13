<template>
  <div class="flex mt-4 gap-2 px-4">
    <QuickActions />
    <PreviewContent />
    <LiveOutput />
  </div>
</template>

<script setup>
definePageMeta({
  layout: "app",
})
useHead({
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
  ],
})
import { useAppStore } from "~/store/app"
// import useScheduleWebsocket from "~/composables/useScheduleWebsocket";
import { ref, watchEffect } from "vue"
import { storeToRefs } from "pinia"

const appStore = useAppStore()
const { activeSchedule } = storeToRefs(appStore)

const scheduleId = ref(undefined)

// watch(
//   activeSchedule,
//   (newSchedule) => {
//     scheduleId.value = newSchedule ? newSchedule._id : undefined;
//     useScheduleWebsocket("http://localhost:4500", scheduleId);
//   },
//   {immediate: true}
// );
</script>
