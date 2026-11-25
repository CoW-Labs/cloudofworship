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
      v-if="allScreens?.length"
      title="Secondary Screens"
      :note="secondaryScreensNote"
    >
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
            : currentState.stageDisplayLabel === screen.id
            ? 'ring-2 ring-purple-300 dark:ring-purple-400/70'
            : currentState.slidesDisplayLabel === screen.id
            ? 'ring-2 ring-sky-300 dark:ring-sky-400/70'
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

        <SettingsSelect
          v-if="currentScreen.label !== screen.label"
          class="shrink-0"
          width="w-[150px]"
          :options="screenRoleOptions"
          :model-value="getScreenRole(screen)"
          @change="(role: string) => setScreenRole(screen, role)"
        >
          <template #label>
            <span class="flex items-center gap-1.5 truncate">
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="roleDotClass(getScreenRole(screen))"
              />
              {{ getScreenRole(screen) }}
            </span>
          </template>
          <template #option="{ option }">
            <span class="flex items-center gap-1.5 truncate">
              <span
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="roleDotClass(option)"
              />
              {{ option }}
            </span>
          </template>
        </SettingsSelect>
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

      <SettingsRow
        label="Let a team member's phone control this output"
        description="When enabled, someone on the mobile app can pick this device and take slides live on the screen it is driving. They can only do that while the live window is open here, and you will see who is controlling it above the slide schedule. This preference is stored on this device only."
      >
        <CowToggle
          bare
          label="Let a team member's phone control this output"
          :model-value="currentState.settings.allowRemoteControl !== false"
          @update:model-value="
            (value: boolean) => {
              appStore.setAllowRemoteControl(value)
              useToast().add({
                title: value
                  ? 'Mobile devices can control this live output'
                  : 'Only this device can change its live output',
                icon: 'i-bx-check-circle',
              })
            }
          "
        />
      </SettingsRow>
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
let screenDetails: any

const externalScreens = computed(() => {
  return allScreens.value.filter(
    (screen: any) => screen?.label !== currentScreen.value?.label
  )
})

const secondaryScreensNote = computed(() => {
  if (externalScreens.value.length > 1) {
    return "Pick the screen for the live output, the stage display your musicians and speakers read from, and an optional slides-only screen that skips the camera."
  }
  return "Pick the screen for the live output. Connect another screen to give the stage display one of its own — until then it opens in a new tab."
})

// The screen shape stored in app state. Screen objects from the browser API
// are live host objects, so a plain copy is what gets persisted.
const toStoredScreen = (screen: any): Screen | any => ({
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

const screenRoleOptions = [
  "Not assigned",
  "Live display",
  "Stage display",
  "Slides-only display",
]

// Mirrors the ring colours used to highlight a screen's card, so the role
// select reads as the same signal in a different shape.
const roleDotClass = (role: string) => {
  if (role === "Live display") return "bg-primary-500"
  if (role === "Stage display") return "bg-purple-300 dark:bg-purple-400/70"
  if (role === "Slides-only display") return "bg-sky-400 dark:bg-sky-300/80"
  return "bg-gray-300 dark:bg-[#3a4254]"
}

// Each role stores the screen's id and a snapshot of the screen, through its
// own pair of setters. A screen holds at most one role, so a table lets the
// code clear whichever role it held without a branch per pair of roles.
const screenRoles = [
  {
    name: "Live display",
    label: () => currentState.value.mainDisplayLabel,
    set: (id: string, screen: any) => {
      appStore.setMainDisplayLabel(id)
      appStore.setMainDisplayScreen(screen)
    },
    assigned: (name: string) => `${name} is now the live display`,
  },
  {
    name: "Stage display",
    label: () => currentState.value.stageDisplayLabel,
    set: (id: string, screen: any) => {
      appStore.setStageDisplayLabel(id)
      appStore.setStageDisplayScreen(screen)
    },
    assigned: (name: string) => `Stage display will open on ${name}`,
  },
  {
    name: "Slides-only display",
    label: () => currentState.value.slidesDisplayLabel,
    set: (id: string, screen: any) => {
      appStore.setSlidesDisplayLabel(id)
      appStore.setSlidesDisplayScreen(screen)
    },
    assigned: (name: string) =>
      `Slides-only display will open on ${name} when you go live`,
  },
]

const getScreenRole = (screen: any) =>
  screenRoles.find((role) => role.label() === screen.id)?.name ??
  "Not assigned"

const setScreenRole = (screen: any, roleName: string) => {
  const previousRole = getScreenRole(screen)
  if (roleName === previousRole) return

  screenRoles.find((role) => role.name === previousRole)?.set("", null)

  const next = screenRoles.find((role) => role.name === roleName)
  const name = screen.label || "This screen"
  if (next) {
    next.set(screen.id, toStoredScreen(screen))
    useToast().add({ title: next.assigned(name), icon: "i-bx-check-circle" })
  } else {
    useToast().add({
      title: `${name} is no longer assigned`,
      icon: "i-bx-check-circle",
    })
  }
  usePosthogCapture("DISPLAY_ROLE_CHANGED", {
    role: next ? next.name : "none",
    previousRole,
  })
}

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
