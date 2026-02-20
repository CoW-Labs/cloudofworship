<template>
  <div
    v-if="showUpdateAvailable && !downloading"
    class="fixed bottom-4 right-4 z-50"
    role="alert"
    aria-labelledby="update-notification"
  >
    <NotFoundBanner
      icon="i-tabler-refresh"
      :sub="
        updateInfo?.version
          ? `Version ${updateInfo?.version} is available`
          : 'A new version is available!'
      "
      desc="We made the app a little better for you and your church."
      action="install-update"
      action-text="Install Now"
      secondary-action="dismiss-update"
      secondary-action-text="Later"
      is-wider
    />
  </div>
  <div
    v-else-if="downloading"
    class="fixed bottom-4 right-4 z-50"
    role="alert"
    aria-labelledby="update-downloading"
  >
    <div
      class="h-[88%] p-4 py-6 mt-4 flex justify-center gap-6 bg-primary-100 rounded-lg text-primary-900 relative overflow-hidden border shadow-xl"
    >
      <IconWrapper name="i-tabler-refresh" size="16" />
      <IconWrapper
        name="i-tabler-refresh"
        size="20"
        class="absolute opacity-10 -bottom-3 -left-3"
      />
      <div class="texts-action">
        <div>
          <h2 class="text-md font-semibold max-w-[220px]">
            Downloading update...
          </h2>
          <div class="mt-2">
            <div class="flex items-center gap-2">
              <div class="flex-1 bg-primary-200 rounded-full h-2 w-[180px]">
                <div
                  class="bg-primary-900 h-2 rounded-full transition-all duration-300"
                  :style="{ width: `${downloadProgress}%` }"
                />
              </div>
              <span class="text-xs">{{ downloadProgress }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import type { Emitter } from "mitt"

const { isTauri } = useTauri()

const showUpdateAvailable = ref(false)
const updateInfo = ref<any>(null)
const downloading = ref(false)
const downloadProgress = ref(0)

// Listen to events
const emitter = useNuxtApp().$emitter as Emitter<any>

emitter.on("install-update", () => {
  installUpdate()
})

emitter.on("dismiss-update", () => {
  dismissUpdate()
})

onMounted(async () => {
  // Check for updates on component mount (usually app startup)
  if (isTauri) {
    // Wait a bit before checking
    setTimeout(checkForUpdate, 5000)
  }
})

const checkForUpdate = async () => {
  try {
    const update = await check()

    if (update?.available) {
      updateInfo.value = update
      showUpdateAvailable.value = true
    }
  } catch (error) {
    console.error("Failed to check for updates:", error)
  }
}

const installUpdate = async () => {
  if (!updateInfo.value) return

  try {
    downloading.value = true
    downloadProgress.value = 0

    let downloaded = 0
    let contentLength = 0

    await updateInfo.value.downloadAndInstall((event: any) => {
      switch (event.event) {
        case "Started":
          contentLength = event.data.contentLength || 0
          break
        case "Progress":
          downloaded += event.data.chunkLength
          if (contentLength > 0) {
            downloadProgress.value = Math.round(
              (downloaded / contentLength) * 100
            )
          }
          break
        case "Finished":
          downloadProgress.value = 100
          break
      }
    })

    // Restart the application
    await relaunch()
  } catch (error) {
    console.error("Failed to install update:", error)
    downloading.value = false
    alert("Failed to install update. Please try again later.")
  }
}

const dismissUpdate = () => {
  showUpdateAvailable.value = false
}
</script>
