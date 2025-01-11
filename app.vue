<template>
  <div class="dark:bg-gray-900">
    <NuxtPwaAssets />
    <NuxtLoadingIndicator />
    <NuxtLayout :app-version="appVersion">
      <NuxtPage />
      <UNotifications>
        <template #title="{ title }">
          <img
            v-if="title === 'Still not convinced?'"
            class="rounded-lg mb-4 w-[100%] h-36 object-cover"
            src="https://images.ctfassets.net/zkw0qlnf0vqv/psycom_page_fid38375_asset_38354/bae5185f9861ecf68719dae696d3b79d/A_psychological_portrait_of_a_young_confused_female_Black_character__an_anxiety_and_depression_concept__psychotherapy"
          />
          <span
            :class="
              title === 'Still not convinced?' ? 'font-semibold text-lg' : ''
            "
            v-html="title"
          />
        </template>

        <template #description="{ description }">
          <span class="leading-5 text-md" v-html="description" />
        </template>
      </UNotifications>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import mitt from "mitt"
import type { AppSettings } from "./types"
import { useAppStore } from "./store/app"
import { appWideActions } from "./utils/constants"

const nuxtApp = useNuxtApp()
const emitter = mitt()
const appStore = useAppStore()
nuxtApp.provide("emitter", emitter)
appStore.setEmitter(emitter)

const appVersion = ref<string>("v0.12.1-beta")

// const registerServiceWorker = async () => {
//   if ("serviceWorker" in navigator) {
//     try {
//       const registration = await navigator.serviceWorker.register("sw.js", {
//         scope: "./",
//       })
//       if (registration.installing) {
//         console.log("Service worker installing")
//       } else if (registration.waiting) {
//         console.log("Service worker installed")
//       } else if (registration.active) {
//         console.log("Service worker active")
//       }
//     } catch (error) {
//       console.error(`Registration failed with ${error}`)
//     }
//   }
// }

// registerServiceWorker()
</script>

<style>
.text-2xs {
  font-size: 0.7rem;
  line-height: 0.9rem;
}

button:focus-visible {
  /* background: #faf5ff;
  border-radius: 0.375rem; */
  outline: none;
}

/* PAGE AND LAYOUT TRANSITIONS */
.layout-enter-active,
.layout-leave-active {
  transition: all 1s;
  -webkit-transition: all 1s;
  -moz-transition: all 1s;
  -ms-transition: all 1s;
  -o-transition: all 1s;
}
.layout-enter-from,
.layout-leave-to {
  filter: grayscale(1);
}
.page-enter-active,
.page-leave-active {
  transition: all 0.4s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  filter: blur(1rem);
}
</style>
