<script setup lang="ts">
/**
 * Example component showing Tauri integration
 * This demonstrates how to use desktop features conditionally
 */

const { isTauri, isWeb } = useTauri()
const { $tauri } = useNuxtApp()

const appVersion = ref("Unknown")
const platform = ref("Unknown")
const windowTitle = ref("Cloud of Worship")

onMounted(async () => {
  if (isTauri.value) {
    await loadTauriInfo()
  }
})

const loadTauriInfo = async () => {
  try {
    // Get app version
    const { getVersion } = await import("@tauri-apps/api/app")
    appVersion.value = await getVersion()

    // Get platform info
    const { platform: getPlatform } = await import("@tauri-apps/api/os")
    platform.value = await getPlatform()
  } catch (error) {
    console.error("Failed to load Tauri info:", error)
  }
}

const changeWindowTitle = async () => {
  const window = await $tauri.getWindow()
  if (window) {
    await window.setTitle(windowTitle.value)
  }
}

const minimizeWindow = async () => {
  const window = await $tauri.getWindow()
  if (window) {
    await window.minimize()
  }
}

const maximizeWindow = async () => {
  const window = await $tauri.getWindow()
  if (window) {
    await window.toggleMaximize()
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <h2 class="text-2xl font-bold">Tauri Integration Example</h2>

    <!-- Show environment info -->
    <div class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
      <h3 class="font-semibold mb-2">Environment</h3>
      <p v-if="isTauri" class="text-green-600 dark:text-green-400">
        ✅ Running as Desktop App
      </p>
      <p v-else class="text-blue-600 dark:text-blue-400">
        🌐 Running as Web App
      </p>
    </div>

    <!-- Desktop-only features -->
    <div v-if="isTauri" class="space-y-4">
      <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <h3 class="font-semibold mb-2">Desktop Info</h3>
        <p><strong>Version:</strong> {{ appVersion }}</p>
        <p><strong>Platform:</strong> {{ platform }}</p>
      </div>

      <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <h3 class="font-semibold mb-3">Window Controls</h3>

        <div class="space-y-2">
          <div class="flex gap-2 items-center">
            <input
              v-model="windowTitle"
              type="text"
              class="flex-1 px-3 py-2 border rounded"
              placeholder="Enter window title"
            />
            <button
              @click="changeWindowTitle"
              class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Set Title
            </button>
          </div>

          <div class="flex gap-2">
            <button
              @click="minimizeWindow"
              class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Minimize
            </button>
            <button
              @click="maximizeWindow"
              class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Toggle Maximize
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Web-only message -->
    <div v-else class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
      <p class="text-sm">
        Desktop features are only available when running the app through Tauri.
        Run
        <code class="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded"
          >npm run tauri:dev</code
        >
        to try them!
      </p>
    </div>
  </div>
</template>
