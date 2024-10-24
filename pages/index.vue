<template #default="{ defaultProps }">
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
import { useDebounce } from "@vueuse/core"

const appStore = useAppStore()

const scheduleId = ref(undefined)

const uploadOfflineSlides = useDebounce(() => {
  useGlobalEmit(appWideActions.uploadOfflineSlides)
}, 2000)

onMounted(() => {
  const emailChange = useRoute().query.email_change

  // console.log("emailChange", emailChange)
  if (emailChange) {
    setTimeout(() => {
      useGlobalEmit(appWideActions.openSettings, "Profile Settings")
    }, 1000)
  } else {
    setTimeout(() => {
      useGlobalEmit(appWideActions.openScheduleModal)
    }, 2000)
  }

  // APP-WIDE SHORTCUTS
  useCreateShortcut("/", () => useGlobalEmit(appWideActions.quickActionsFocus))

  useCreateShortcut(
    "z",
    () => {
      appStore.undo()
      uploadOfflineSlides()
    },
    { ctrlOrMeta: true }
  )

  useCreateShortcut(
    "y",
    () => {
      appStore.redo()
      uploadOfflineSlides()
    },
    {
      ctrlOrMeta: true,
    }
  )
})

// watch(
//   activeSchedule,
//   (newSchedule) => {
//     scheduleId.value = newSchedule ? newSchedule._id : undefined;
//     useScheduleWebsocket("http://localhost:4500", scheduleId);
//   },
//   {immediate: true}
// );
</script>
