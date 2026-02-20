<template>
  <div
    class="settings-ctn h-[100%] flex flex-col gap-6 overflow-y-auto mb-[2.5%] pb-[10%]"
  >
    <div v-if="currentScreen" class="primary-display flex flex-col gap-2">
      <div class="sub-header">
        <h3 class="font-medium">Control Center</h3>
        <p class="text-xs opacity-50 mb-2 mt-1">
          This is where behind the scene control is done. We advise you get a
          second screen for the live content.
          <span v-if="isTauri" class="text-primary-500 font-medium">
            (Desktop Mode)
          </span>
        </p>
      </div>
      <div
        class="bg-primary-100 dark:bg-primary-800 p-4 px-6 rounded-md flex justify-between items-center"
      >
        <div class="info flex gap-4">
          <IconWrapper name="i-lucide-monitor" size="6" class="pt-1" />
          <div class="name-and-dimensions">
            <div class="name text-sm font-semibold">
              {{ currentScreen?.label || "Unlabeled Screen" }}
              <span
                v-if="currentScreen?.isPrimary"
                class="internal bg-primary-300 dark:bg-primary-600 text-xs px-2 py-1 rounded-md ml-1"
                >Primary screen</span
              >
            </div>
            <div class="dimensions text-xs">
              {{ currentScreen?.width }} x
              {{ currentScreen?.height }}
            </div>
          </div>
        </div>
        <UButton
          v-if="!currentScreen?.isPrimary && !isTauri"
          variant="ghost"
          leading-icon="i-bx-info-circle"
          @click="moveCurrentScreenToNativeDisplay"
        >
          Move this window to primary screen
        </UButton>
      </div>
    </div>
    <div v-if="isTauri" class="live-window-settings flex flex-col gap-2">
      <div class="sub-header">
        <h3 class="font-medium">Live Window Settings</h3>
        <p class="text-xs opacity-50 mb-2 mt-1">
          Configure how the live output window opens.
        </p>
      </div>
      <div
        class="bg-gray-100 dark:bg-gray-800 p-4 px-6 rounded-md flex justify-between items-center"
      >
        <div class="info">
          <div class="text-sm font-semibold">Open in Fullscreen Mode</div>
          <div class="text-xs opacity-70 mt-1">
            When enabled, the live window opens in fullscreen without window
            decorations. When disabled, it opens as a resizable window with
            title bar controls.
          </div>
        </div>
        <UToggle
          :model-value="currentState.settings.liveWindowFullscreen"
          @update:model-value="
            (value: boolean) => {
              appStore.setLiveWindowFullscreen(value)
              useToast().add({
                title: value
                  ? 'Live window will open in fullscreen'
                  : 'Live window will open as resizable window',
                icon: 'i-bx-check-circle',
              })
            }
          "
        />
      </div>
    </div>
    <div
      v-if="allScreens?.length"
      class="secondary-display flex flex-col gap-2"
    >
      <div class="flex items-center justify-between">
        <h3 class="font-medium">Secondary Screens</h3>
        <UButton
          size="sm"
          variant="outline"
          leading-icon="i-bx-refresh"
          :loading="isLoading"
          @click="getDisplayDetails()"
        >
          Refresh screens
        </UButton>
      </div>
      <div class="no-screens" v-if="!externalScreens?.length">
        <div
          class="text-center flex flex-col items-center justify-center max-w-[150px] mx-auto mt-[5%]"
        >
          <IconWrapper name="i-lucide-monitor-x" size="7" class="pb-2" />
          <div class="text-sm">No external screens detected</div>
        </div>
      </div>
      <div
        v-for="(screen, index) in allScreens?.filter((screen: any) => screen?.label !== currentScreen?.label)"
        :key="screen.id"
        class="bg-gray-100 dark:bg-gray-800 p-4 px-6 rounded-md flex justify-between items-center"
      >
        <div class="info flex gap-4">
          <IconWrapper name="i-lucide-monitor-play" size="6" class="pt-1" />
          <div class="name-and-dimensions">
            <div class="name text-sm font-semibold">
              {{ screen?.label || `Unlabeled Screen ${index + 1}` }}
              <span
                v-if="screen?.isPrimary"
                class="internal bg-primary-200 dark:bg-primary-800 text-xs px-2 py-1 rounded-md ml-1"
                >Primary screen</span
              >
            </div>
            <div class="dimensions text-xs">
              {{ screen?.width }} x
              {{ screen?.height }}
            </div>
          </div>
        </div>

        <div
          v-if="currentScreen.label !== screen.label"
          class="flex flex-col gap-2"
        >
          <!-- <div>Live content screen:</div> -->
          <UCheckbox
            :ui="{ base: 'h-5 w-5', rounded: 'rounded-full' }"
            label="Live display"
            :value="screen.id"
            :model-value="currentState.mainDisplayLabel === screen.id"
            @change="
              ($event: any) => {
                appStore.setMainDisplayLabel($event ? screen.id : '')
                const tempScreen: (Screen | any) = ({
                  // prettier-ignore
                  id: screen.id,
                  width: screen.width,
                  height: screen.height,
                  availWidth: screen.availWidth,
                  availHeight: screen.availHeight,
                  availLeft: screen.availLeft,
                  availTop: screen.availTop,
                  isExtended: screen.isExtended,
                  isInternal: screen.isInternal,
                  devicePixelRatio: screen.devicePixelRatio,
                  label: screen.label,
                  pixelDepth: screen.pixelDepth,
                })
                $event
                  ? appStore.setMainDisplayScreen(tempScreen)
                  : appStore.setMainDisplayScreen(null)
              }
            "
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store/app"
import { useDebounceFn } from "@vueuse/core"

const appStore = useAppStore()
const { isTauri } = useTauri()
const currentScreen = ref<any>({})
const allScreens = ref<any>([])
const { currentState } = storeToRefs(appStore)
const isLoading = ref(false)

let screenDetails: any

const externalScreens = computed(() => {
  return allScreens.value.filter(
    (screen: any) => screen?.label !== currentScreen.value?.label
  )
})

const getDisplayDetails = async () => {
  isLoading.value = true

  if (isTauri) {
    // Use Tauri API for desktop
    await getTauriDisplays()
  } else if ("getScreenDetails" in window) {
    // Use browser API for web
    await getBrowserDisplays()
  } else {
    useToast().add({
      title: "Your browser does not support automatic displays detection",
      icon: "i-bx-info-circle",
      color: "amber",
    })
  }

  isLoading.value = false
}

const getTauriDisplays = async () => {
  try {
    const { availableMonitors, currentMonitor } = await import(
      "@tauri-apps/api/window"
    )
    const monitors = await availableMonitors()
    const current = await currentMonitor()

    if (!monitors || monitors.length === 0) {
      useToast().add({
        title: "No monitors detected",
        icon: "i-bx-info-circle",
        color: "amber",
      })
      return
    }

    // Map Tauri monitors to screen format
    allScreens.value = monitors.map((monitor: any, index: number) => {
      const monitorId = useScreenId(monitor)
      const isCurrent =
        current &&
        monitor.position.x === current.position.x &&
        monitor.position.y === current.position.y &&
        monitor.size.width === current.size.width &&
        monitor.size.height === current.size.height

      return {
        id: monitorId,
        label: monitor.name || `Display ${index + 1}`,
        width: monitor.size.width,
        height: monitor.size.height,
        availWidth: monitor.size.width,
        availHeight: monitor.size.height,
        availLeft: monitor.position.x,
        availTop: monitor.position.y,
        isPrimary: monitor.position.x === 0 && monitor.position.y === 0,
        isInternal: false, // Tauri doesn't expose this
        isExtended: true,
        devicePixelRatio: monitor.scaleFactor || 1,
        pixelDepth: 24,
      }
    })

    // Set current screen
    if (current) {
      const currentId = useScreenId(current)
      currentScreen.value =
        allScreens.value.find((s: any) => s.id === currentId) ||
        allScreens.value[0]
    } else {
      currentScreen.value = allScreens.value[0]
    }

    // useToast().add({
    //   title: "Screens updated",
    //   icon: "i-bx-check-circle",
    // })
  } catch (error) {
    console.error("Failed to get Tauri displays:", error)
    useToast().add({
      title: "Failed to detect displays",
      description: "Please try again",
      icon: "i-bx-error-circle",
      color: "red",
    })
  }
}

const getBrowserDisplays = async () => {
  try {
    // prettier-ignore
    screenDetails = await (window as any).getScreenDetails()
    screenDetails.currentScreen.id = useScreenId(screenDetails?.currentScreen)
    screenDetails?.screens?.map((screen: any) => {
      screen.id = useScreenId(screen)
    })
    currentScreen.value = screenDetails?.currentScreen as Screen
    allScreens.value = screenDetails?.screens

    // useToast().add({
    //   title: "Screens updated",
    //   icon: "i-bx-check-circle",
    // })
  } catch (error) {
    console.error("Failed to get browser displays:", error)
    useToast().add({
      title: "Failed to detect displays",
      description: "Please try again",
      icon: "i-bx-error-circle",
      color: "red",
    })
  }
}

const debouncedGetDisplayDetails = useDebounceFn(getDisplayDetails, 500)

onMounted(async () => {
  await getDisplayDetails()

  addEventListener("resize", async () => {
    debouncedGetDisplayDetails()
  })
})

onBeforeUnmount(() => {
  removeEventListener("resize", debouncedGetDisplayDetails)
})

const moveCurrentScreenToNativeDisplay = async () => {
  if (isTauri) {
    // In Tauri, we can't move windows between screens this way
    // Instead, show a message
    useToast().add({
      title: "Window movement not supported",
      description: "Please manually move the window to your primary display",
      icon: "i-bx-info-circle",
    })
    return
  }

  // Browser mode
  const nativeDisplay = allScreens.value.find(
    (screen: any) => screen?.isPrimary
  )
  try {
    await document.documentElement.requestFullscreen({
      // @ts-ignore - screen option is experimental
      screen: nativeDisplay,
    })
  } catch (error) {
    console.error("Failed to move to native display:", error)
  }
}
</script>
