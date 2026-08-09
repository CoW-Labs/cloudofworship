<template>
  <div
    class="settings-ctn h-[100%] flex flex-col gap-8 overflow-y-auto mb-[2.5%] p-1.5 pb-[10%]"
  >
    <SettingsGroup
      v-if="currentScreen"
      title="Control Center"
      :note="`This is where behind the scene control is done. We advise you get a second screen for the live content.${
        isTauri ? ' (Desktop Mode)' : ''
      }`"
    >
      <div
        class="rounded-2xl bg-primary-100 dark:bg-primary-900/40 px-4 py-3.5 flex justify-between items-center gap-4"
      >
        <div class="info flex gap-3 min-w-0">
          <IconWrapper name="i-lucide-monitor" size="6" class="pt-1 shrink-0" />
          <div class="name-and-dimensions min-w-0">
            <div class="name text-sm font-semibold flex items-center gap-2">
              <span class="truncate">
                {{ currentScreen?.label || "Unlabeled Screen" }}
              </span>
              <span
                v-if="currentScreen?.isPrimary"
                class="internal shrink-0 bg-primary-300 dark:bg-primary-700 text-xs px-2 py-0.5 rounded-full"
                >Primary screen</span
              >
            </div>
            <div class="dimensions text-xs text-gray-600 dark:text-[#9aa3b2]">
              {{ currentScreen?.width }} x {{ currentScreen?.height }}
            </div>
          </div>
        </div>
        <CowButton
          v-if="!currentScreen?.isPrimary && !isTauri"
          variant="secondary"
          size="2xs"
          class="!px-3.5 !py-1.5 text-xs shrink-0"
          @click="moveCurrentScreenToNativeDisplay"
        >
          Move to primary screen
        </CowButton>
      </div>
    </SettingsGroup>

    <SettingsGroup
      title="Live Window Settings"
      note="Configure how the live output window opens."
    >
      <SettingsRow
        v-if="isTauri"
        label="Open in fullscreen mode"
        description="When enabled, the live window opens in fullscreen without window decorations. When disabled, it opens as a resizable window with title bar controls."
      >
        <CowToggle
          bare
          label="Open in fullscreen mode"
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
      </SettingsRow>

      <SettingsRow
        v-else
        label="Close live window when this tab is closed"
        description="When enabled, the live output window closes automatically if you close the control center tab."
      >
        <CowToggle
          bare
          label="Close live window when this tab is closed"
          :model-value="currentState.settings.closeLiveWindowWithOperator"
          @update:model-value="
            (value: boolean) => {
              appStore.setCloseLiveWindowWithOperator(value)
              useToast().add({
                title: value
                  ? 'Live window will close with this tab'
                  : 'Live window will stay open when this tab is closed',
                icon: 'i-bx-check-circle',
              })
            }
          "
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup v-if="allScreens?.length" title="Secondary Screens">
      <template #actions>
        <CowButton
          variant="secondary"
          size="2xs"
          class="!px-3.5 !py-1.5 text-xs gap-1.5"
          :loading="isLoading"
          @click="getDisplayDetails()"
        >
          <RefreshIcon class="w-3.5 h-3.5" />
          Refresh screens
        </CowButton>
      </template>

      <div class="no-screens" v-if="!externalScreens?.length">
        <div
          class="text-center flex flex-col items-center justify-center max-w-[180px] mx-auto mt-[5%]"
        >
          <IconWrapper name="i-lucide-monitor-x" size="7" class="pb-2" />
          <div class="text-sm text-gray-500 dark:text-[#9aa3b2]">
            No external screens detected
          </div>
        </div>
      </div>

      <div
        v-for="(screen, index) in externalScreens"
        :key="screen.id"
        class="rounded-2xl bg-white dark:bg-[#131a27] px-4 py-3.5 flex justify-between items-center gap-4"
        :class="
          currentState.mainDisplayLabel === screen.id
            ? 'ring-2 ring-primary-500'
            : 'ring-1 ring-gray-200 dark:ring-white/10'
        "
      >
        <div class="info flex gap-3 min-w-0">
          <IconWrapper
            name="i-lucide-monitor-play"
            size="6"
            class="pt-1 shrink-0"
          />
          <div class="name-and-dimensions min-w-0">
            <div class="name text-sm font-semibold flex items-center gap-2">
              <span class="truncate">
                {{ screen?.label || `Unlabeled Screen ${index + 1}` }}
              </span>
              <span
                v-if="screen?.isPrimary"
                class="internal shrink-0 bg-primary-200 dark:bg-primary-800 text-xs px-2 py-0.5 rounded-full"
                >Primary screen</span
              >
            </div>
            <div class="dimensions text-xs text-gray-500 dark:text-[#9aa3b2]">
              {{ screen?.width }} x {{ screen?.height }}
            </div>
          </div>
        </div>

        <div
          v-if="currentScreen.label !== screen.label"
          class="shrink-0 flex items-center gap-2.5"
        >
          <span class="text-xs font-semibold text-gray-600 dark:text-[#a7afbd]">
            Live display
          </span>
          <CowToggle
            bare
            label="Live display"
            :model-value="currentState.mainDisplayLabel === screen.id"
            @update:model-value="
              ($event: boolean) => {
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
    </SettingsGroup>
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
  } catch (error) {
    console.error("Failed to get Tauri displays:", error)
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
  } catch (error) {
    console.error("Failed to get browser displays:", error)
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
    const name = (error as DOMException | undefined)?.name
    if (name !== "NotAllowedError" && name !== "SecurityError") {
      console.error("Failed to move to native display:", error)
    }
  }
}
</script>
