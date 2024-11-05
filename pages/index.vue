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
const socket = ref(null)

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
  }
  // else {
  //   setTimeout(() => {
  //     useGlobalEmit(appWideActions.openScheduleModal)
  //   }, 2000)
  // }

  // APP-WIDE SHORTCUTS
  useCreateShortcut("/", () => useGlobalEmit(appWideActions.quickActionsFocus))

  // Prevent default action on specific keys
  document.addEventListener("keydown", function (event) {
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "y" || event.key === "Y" || event.key === "?")
    ) {
      event.preventDefault()
    }
  })

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

  useCreateShortcut(
    "p",
    () => {
      useGlobalEmit("promote-active-slide-live")
    },
    {
      ctrlOrMeta: true,
    }
  )

  useCreateShortcut(
    "h",
    () => {
      useGlobalEmit("open-shortcuts")
    },
    {
      ctrlOrMeta: true,
    }
  )
})

if (appStore.currentState.activeSchedule) {
  const nuxtApp = useNuxtApp()
  socket.value = await useSocket(appStore.currentState.activeSchedule?._id)
  nuxtApp.provide("socket", socket.value)

  socket.value.onmessage = (event) => {
    const data = JSON.parse(event.data)
    console.log(data)

    switch (data.action) {
      case "live-slide":
        break
      case "new-slide":
        break
      case "update-slide":
        break
      default:
        console.log("Unknown action:", data.action)
    }
  }

  watch(
    () => appStore.currentState.liveSlideId,
    (liveSlideId) => {
      const liveSlide = appStore.currentState.activeSlides.find(
        (slide) => slide.id === liveSlideId
      )
      if (liveSlide) {
        socket.value.send(
          JSON.stringify({
            action: "live-slide",
            data: liveSlide,
          })
        )
      }
    },
    { deep: true }
  )
}

// watch(
//   activeSchedule,
//   (newSchedule) => {
//     scheduleId.value = newSchedule ? newSchedule._id : undefined;
//     useScheduleWebsocket("http://localhost:4500", scheduleId);
//   },
//   {immediate: true}
// );
</script>
