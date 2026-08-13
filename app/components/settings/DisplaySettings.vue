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
          v-if="!currentScreen?.isPrimary"
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
        :label="`Close live window when this ${operatorSurface} is closed`"
        :description="`When enabled, the live output window closes automatically if you close the control center ${operatorSurface}.`"
      >
        <CowToggle
          bare
          :label="`Close live window when this ${operatorSurface} is closed`"
          :model-value="currentState.settings.closeLiveWindowWithOperator"
          @update:model-value="
            (value: boolean) => {
              appStore.setCloseLiveWindowWithOperator(value)
              useToast().add({
                title: value
                  ? `Live window will close with this ${operatorSurface}`
                  : `Live window will stay open when this ${operatorSurface} is closed`,
                icon: 'i-bx-check-circle',
              })
            }
          "
        />
      </SettingsRow>
    </SettingsGroup>

    <SettingsGroup
      v-if="isTauri"
      title="NDI Live Output"
      note="Publish the live window to NDI receivers on your local network. NDI 5 or 6 must be installed separately."
    >
      <SettingsRow
        label="Broadcast live output over NDI"
        description="When enabled, broadcasting starts after the desktop live window opens. This preference is stored on this device only."
      >
        <CowToggle
          bare
          label="Broadcast live output over NDI"
          :model-value="currentState.settings.ndiEnabled ?? false"
          @update:model-value="handleNdiToggle"
        />
      </SettingsRow>

      <div
        class="rounded-2xl bg-white dark:bg-[#131a27] ring-1 ring-gray-200 dark:ring-white/10 p-4"
      >
        <div class="flex items-center justify-between gap-3 mb-3">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0"
              :class="ndiPhaseDotClass"
            />
            <span class="text-sm font-semibold">{{ ndiPhaseLabel }}</span>
            <span
              v-if="ndiStatus.stalled"
              class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            >
              Stalled
            </span>
          </div>
          <Icon
            v-if="ndiBusy"
            name="i-lucide-loader-2"
            class="w-4 h-4 animate-spin text-primary-500"
          />
        </div>

        <dl class="grid grid-cols-2 gap-x-5 gap-y-3 text-xs">
          <div class="min-w-0">
            <dt class="text-gray-500 dark:text-[#9aa3b2]">Source</dt>
            <dd class="mt-0.5 font-semibold truncate">
              {{ ndiStatus.sourceName }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-gray-500 dark:text-[#9aa3b2]">Resolution</dt>
            <dd class="mt-0.5 font-semibold">
              {{ ndiResolution }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-gray-500 dark:text-[#9aa3b2]">NDI runtime</dt>
            <dd
              class="mt-0.5 font-semibold truncate"
              :title="ndiStatus.runtimePath || undefined"
            >
              {{ ndiStatus.runtimeVersion || "Not detected" }}
            </dd>
          </div>
          <div>
            <dt class="text-gray-500 dark:text-[#9aa3b2]">Receivers</dt>
            <dd class="mt-0.5 font-semibold">
              {{ ndiStatus.connectionCount }}
            </dd>
          </div>
        </dl>

        <div
          v-if="ndiStatus.error"
          class="mt-4 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-xs text-red-800 dark:text-red-200"
        >
          <p class="font-semibold">{{ ndiStatus.error.message }}</p>
          <p v-if="ndiStatus.error.hint" class="mt-1 leading-relaxed">
            {{ ndiStatus.error.hint }}
          </p>
        </div>

        <div
          v-else-if="showWindowsNetworkHint"
          class="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200"
        >
          No receiver is connected. If your NDI receiver cannot find this
          source, allow Cloud of Worship on Windows Firewall and confirm the
          network is marked Private.
        </div>

        <div
          v-if="showNdiActions"
          class="mt-4 flex flex-wrap items-center gap-2"
        >
          <CowButton
            v-if="ndiStatus.error?.recoverable && currentState.settings.ndiEnabled"
            variant="secondary"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            :loading="ndiBusy"
            @click="retryNdi"
          >
            Retry
          </CowButton>
          <CowButton
            v-if="runtimeMissing"
            variant="secondary"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            @click="useOpenExternal('https://ndi.video/tools/')"
          >
            Install NDI runtime
          </CowButton>
          <CowButton
            v-if="capturePermissionNeeded"
            variant="secondary"
            size="2xs"
            class="!px-3.5 !py-1.5 text-xs"
            @click="openNdiCaptureSettings"
          >
            Open Screen Recording settings
          </CowButton>
        </div>
      </div>
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
                {{ screen?.label || `Unlabeled Screen ${Number(index) + 1}` }}
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
const operatorSurface = isTauri ? "window" : "tab"
const currentScreen = ref<any>({})
const allScreens = ref<any>([])
const { currentState } = storeToRefs(appStore)
const isLoading = ref(false)
const {
  status: ndiStatus,
  isInvoking: ndiBusy,
  initialize: initializeNdi,
  start: startNdi,
  stop: stopNdi,
  retry: retryNdiCommand,
  openCaptureSettings: openCaptureSettings,
} = useNdiBroadcast()

const ndiPhaseLabel = computed(() => {
  if (ndiStatus.value.stalled) return "Broadcasting last frame"
  return {
    idle: "Not broadcasting",
    starting: "Starting",
    broadcasting: "Broadcasting",
    error: "Needs attention",
    unsupported: "Unsupported on this system",
  }[ndiStatus.value.phase]
})

const ndiPhaseDotClass = computed(() => ({
  "bg-gray-400": ndiStatus.value.phase === "idle",
  "bg-amber-500 animate-pulse": ndiStatus.value.phase === "starting",
  "bg-green-500": ndiStatus.value.phase === "broadcasting" && !ndiStatus.value.stalled,
  "bg-amber-500": ndiStatus.value.phase === "broadcasting" && ndiStatus.value.stalled,
  "bg-red-500": ndiStatus.value.phase === "error",
  "bg-gray-500": ndiStatus.value.phase === "unsupported",
}))

const ndiResolution = computed(() =>
  ndiStatus.value.width && ndiStatus.value.height
    ? `${ndiStatus.value.width} x ${ndiStatus.value.height} at ${ndiStatus.value.fps} fps`
    : `Waiting for live output at ${ndiStatus.value.fps} fps`
)
const runtimeMissing = computed(
  () => ndiStatus.value.error?.code === "runtimeNotInstalled"
)
const capturePermissionNeeded = computed(() =>
  ["required", "denied"].includes(ndiStatus.value.capturePermission)
)
const showWindowsNetworkHint = computed(
  () =>
    import.meta.client &&
    navigator.userAgent.includes("Windows") &&
    ndiStatus.value.phase === "broadcasting" &&
    ndiStatus.value.connectionCount === 0
)
const showNdiActions = computed(
  () =>
    Boolean(ndiStatus.value.error?.recoverable) ||
    runtimeMissing.value ||
    capturePermissionNeeded.value
)

const liveWindowIsOpen = async () => {
  const { getAllWebviewWindows } = await import(
    "@tauri-apps/api/webviewWindow"
  )
  return (await getAllWebviewWindows()).some(
    (window) => window.label === "live-output"
  )
}

const handleNdiToggle = async (enabled: boolean) => {
  appStore.setNdiEnabled(enabled)
  if (!enabled) {
    try {
      await stopNdi()
    } catch (error) {
      console.warn("Could not stop NDI cleanly:", error)
    }
    return
  }

  if (!(await liveWindowIsOpen())) {
    useToast().add({
      title: "NDI will start with the live window",
      icon: "i-bx-check-circle",
    })
    return
  }
  try {
    await startNdi()
  } catch (error: any) {
    useToast().add({
      title: "NDI could not start",
      description: error?.message,
      icon: "i-bx-error-circle",
      color: "red",
    })
  }
}

const retryNdi = async () => {
  if (!(await liveWindowIsOpen())) {
    useToast().add({
      title: "Open the live window before retrying NDI",
      icon: "i-bx-info-circle",
      color: "amber",
    })
    return
  }
  try {
    await retryNdiCommand()
  } catch (error: any) {
    useToast().add({
      title: "NDI retry failed",
      description: error?.message,
      icon: "i-bx-error-circle",
      color: "red",
    })
  }
}

const openNdiCaptureSettings = async () => {
  try {
    await openCaptureSettings()
  } catch (error: any) {
    useToast().add({
      title: "Could not open Screen Recording settings",
      description: error?.message,
      icon: "i-bx-error-circle",
      color: "red",
    })
  }
}

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
  if (isTauri) await initializeNdi()
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
    // Desktop can move the control center outright, rather than asking the
    // browser to go fullscreen on another screen the way the web build does.
    try {
      const { getCurrentWindow, PhysicalPosition, availableMonitors } =
        await import("@tauri-apps/api/window")

      const monitors = await availableMonitors()
      const primary = monitors.find(
        (monitor: any) => monitor.position.x === 0 && monitor.position.y === 0
      )

      if (!primary) {
        useToast().add({
          title: "Could not find your primary display",
          icon: "i-bx-info-circle",
          color: "amber",
        })
        return
      }

      // Monitor positions are reported in physical pixels, so they must be
      // wrapped as such — a LogicalPosition would land wrong on scaled displays.
      const appWindow = getCurrentWindow()
      await appWindow.setPosition(
        new PhysicalPosition(primary.position.x, primary.position.y)
      )
      await appWindow.setFocus()
      await getDisplayDetails()
    } catch (error) {
      console.error("Failed to move window to primary display:", error)
      useToast().add({
        title: "Could not move the window",
        description: "Please drag the window to your primary display manually",
        icon: "i-bx-error-circle",
        color: "red",
      })
    }
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
