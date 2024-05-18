<template>
  <div v-if="!loadingResources" class="app-ctn max-h-[100vh] overflow-hidden">
    <Navbar :app-version="appVersion" />
    <slot />
    <FullScreenLoader v-if="fullScreenLoading" />
  </div>
  <div
    v-else
    class="loading-ctn h-[100vh] w-[100vw] fixed inset-0 grid place-items-center"
  >
    <div class="wrapper flex flex-col gap-2">
      <div class="logo flex items-center justify-center mb-6 gap-2">
        <Logo class="w-[48px]" />
        <h1 class="text-2xl font-semibold">Cloud of Worshippers</h1>
      </div>
      <div class="progress-wrapper text-center">
        <UProgress
          size="2xl"
          class="text-center"
          :value="downloadProgress"
          :max="[
            'Setting up environment...',
            'Loading KJV Bible...',
            'Loading NKJV Bible...',
            'Loading NIV Bible...',
            'Loading AMP Bible...',
            'Loading Hymns...',
            'Loading background videos...',
            'Finishing up',
          ]"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import kjvBible from "../public/kjv.json"
import nkjvBible from "../public/nkjv.json"
import nivBible from "../public/niv.json"
import ampBible from "../public/amp.json"
import hymns from "../public/hymns.json"
import { useAppStore } from "~/store/app"
import { useAuthStore } from "~/store/auth"
import type { Church } from "~/store/auth"
import type { Emitter } from "mitt"
import type { LibraryItem, Media } from "~/types"

useHead({
  title: "Cloud of Worshippers",
})
const props = defineProps({
  appVersion: String,
})

const appStore = useAppStore()
const authStore = useAuthStore()
const loadingResources = ref<boolean>(true)
const downloadProgress = ref<number>(5)
const fullScreenLoading = ref<boolean>(false)
const cachedVideosURLs = ref<string[]>()

// LISTEN TO EVENTS
const emitter = useNuxtApp().$emitter as Emitter<any>
emitter.on("app-loading", (loading) => {
  // console.log("triggered", loading)
  fullScreenLoading.value = loading
})

const saveAllBackgroundVideos = async () => {
  const db = useIndexedDB()
  const savedBgVideos = await db.cached.count()
  if (savedBgVideos >= 6) {
    return
  }
  const bgVideoPromise = await Promise.all([
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-1.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-2.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-3.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-4.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-5.mp4`),
    fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-6.mp4`),
    // fetch(`https://revaise.s3.us-east-2.amazonaws.com/video-bg-7.mp4`),
  ])
  // console.log("values", bgVideoPromise)
  const bgVideoResponse = await Promise.all([
    bgVideoPromise[0].blob(),
    bgVideoPromise[1].blob(),
    bgVideoPromise[2].blob(),
    bgVideoPromise[3].blob(),
    bgVideoPromise[4].blob(),
    bgVideoPromise[5].blob(),
    // bgVideoPromise[6].blob(),
  ])
  bgVideoResponse.forEach((blob, index) => {
    const tempMedia: Media = {
      id: `/video-bg-${index + 1}.mp4`,
      data: blob,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.cached.add(tempMedia)
  })

  // console.log("values", bgVideoResponse.values())
  // const blobData = await bgVideoPromise.blob()
  // // Convert ArrayBuffer object stored in [Slide.content.data] to Blob and b64 url
  // const arrayBuffer: ArrayBuffer = mediaObj[0]?.data
  // const blob = new Blob([blobData], {
  //   type: 'video/mp4',
  // })
}

const downloadEssentialResources = async () => {
  loadingResources.value = true
  downloadProgress.value = 1

  // Download KJV Bible
  // const kjvBible = await useS3File("kjv.json")
  if (!useNuxtApp().$kjvBible) {
    useNuxtApp().provide("kjvBible", kjvBible || "")
    downloadProgress.value = 2
  }

  // Download NKJV Bible
  // const nkjvBible = await useS3File("nkjv.json")
  if (!useNuxtApp().$nkjvBible) {
    useNuxtApp().provide("nkjvBible", nkjvBible || "")
    downloadProgress.value = 3
  }

  // Download NIV Bible
  // const nivBible = await useS3File("niv.json")
  if (!useNuxtApp().$nivBible) {
    useNuxtApp().provide("nivBible", nivBible || "")
    downloadProgress.value = 4
  }

  // Download AMP Bible
  // const ampBible = await useS3File("amp.json")
  if (!useNuxtApp().$ampBible) {
    useNuxtApp().provide("ampBible", ampBible || "")
    downloadProgress.value = 5
  }

  // Download all hymns
  // const hymns = await useS3File("hymns.json")

  if (!useNuxtApp().$hymns) {
    useNuxtApp().provide("hymns", hymns || "")
    downloadProgress.value = 6
  }

  // Download background videos
  await saveAllBackgroundVideos()
  downloadProgress.value = 7

  setTimeout(() => {
    downloadProgress.value = 8
    loadingResources.value = false
  }, 500)
}

const overrideAppSettings = () => {
  const currentAppSettings = appStore.settings
  // Override App Settings if current app version mismatches appVersion in state
  // TODO: When appSettings is editable by user, it must take preference over system settings and override
  // console.log(currentAppSettings.appVersion, props.appVersion)
  if (currentAppSettings.appVersion !== props.appVersion) {
    const db = useIndexedDB()
    db.newSchemaUpdate()

    // console.log("calling again")
    setTimeout(() => {
      useGlobalEmit("show-changelog")
    }, 2000)

    appStore.setAppSettings({
      ...currentAppSettings,
      appVersion: props.appVersion,
      defaultFont: "Inter",
      defaultBackground: {
        hymn: {
          backgroundType: "video",
          background: cachedVideosURLs.value?.[0],
        },
        bible: {
          backgroundType: "video",
          background: cachedVideosURLs.value?.[2],
        },
        text: {
          backgroundType: "video",
          background: cachedVideosURLs.value?.[3],
        },
      },
    })
  }
}

function base64ToBlobURL(base64String: string, mimeType: string) {
  const byteCharacters = atob(decodeURIComponent(base64String))
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: mimeType })
  return URL.createObjectURL(blob)
}

const getChurch = async () => {
  // console.log(authStore.user)
  const churchId = authStore.user?.churchId
  if (churchId) {
    const promise = useAPIFetch(`/church/${churchId}`)
    authStore.setChurch(promise.data as unknown as Church)
  } else {
    navigateTo("/signup?registerChurch=1")
    useToast().add({
      icon: "i-bx-church",
      title: "Add your church in less than 1 minute to continue.",
    })
  }
}

const retrieveAllMediaFilesFromDB = async () => {
  const db = useIndexedDB()

  // For active slides
  const slides = [...appStore.activeSlides]
  slides.forEach(async (slide) => {
    if (slide.type === slideTypes.media) {
      const mediaObj = await db.media.where({ id: slide.id }).toArray()
      if (mediaObj[0]) {
        let b64 = null
        // Convert ArrayBuffer object stored in [Slide.content.data] to Blob and b64 url
        const arrayBuffer: ArrayBuffer = mediaObj[0]?.data
        const blob = new Blob([arrayBuffer], {
          type: mediaObj[0]?.content?.type,
        })
        const fileUrl = URL.createObjectURL(blob)
        slide.data.url = fileUrl
        slide.background = fileUrl
        appStore.setActiveSlides(slides)
      }
    }
  })

  // For saved slides
  const savedSlides = await db.library.where("type").equals("slide").toArray()
  const slidesChanges = await savedSlides?.map((slide) => {
    db.media.get(slide.id).then((resp) => {
      const media = resp

      const arrayBuffer: ArrayBuffer = media?.data as ArrayBuffer
      const blob = new Blob([arrayBuffer], {
        type: media?.content?.type,
      })
      const fileUrl = URL.createObjectURL(blob)
      // console.log(fileUrl)
      // console.log({
      //   key: slide.id,
      //   changes: {
      //     "content.data": { ...slide.content.data, url: fileUrl },
      //   },
      // })
      const updatedLibraryItem = {
        ...slide,
        content: {
          ...slide.content,
          background: fileUrl,
          data: { ...slide.content.data, url: fileUrl },
        },
      }
      // console.log(updatedLibraryItem)
      db.library.update(slide.id, updatedLibraryItem)
    })
  })

  setCachedVideosURL()
}

const setCachedVideosURL = async () => {
  const cachedVideos = await useBackgroundVideos()
  const tempCachedVideosURLs = cachedVideos?.map((blob) =>
    URL.createObjectURL(blob)
  )
  cachedVideosURLs.value = tempCachedVideosURLs as string[]
  // console.log(tempCachedVideosURLs)
  appStore.setBackgroundVideos(tempCachedVideosURLs)
}

onMounted(async () => {
  await downloadEssentialResources()
  overrideAppSettings()
})

getChurch()
retrieveAllMediaFilesFromDB()
</script>

<style scoped></style>
