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
          v-if="!currentScreen?.isPrimary"
          variant="ghost"
          leading-icon="i-bx-info-circle"
          @click="moveCurrentScreenToNativeDisplay"
        >
          Move this window to primary screen
        </UButton>
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
        <div class="text-center max-w-[150px] mx-auto mt-[5%]">
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
              ($event) => {
                appStore.setMainDisplayLabel($event ? screen.id : '')
                const tempScreen: Screen = ({
                  id: screen.id,
                  width: screen.width,
                  height: screen.height,
                  availWidth: screen.availWidth,
                  availHeight: screen.availHeight,
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
  screenDetails = await window.getScreenDetails()
  screenDetails.currentScreen.id = useScreenId(screenDetails?.currentScreen)
  screenDetails?.screens?.map((screen: any) => {
    screen.id = useScreenId(screen)
  })
  currentScreen.value = screenDetails?.currentScreen as Screen
  allScreens.value = screenDetails?.screens
  isLoading.value = false
  useToast().add({
    title: "Screens updated",
    icon: "i-bx-check-circle",
  })
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
  const nativeDisplay = allScreens.value.find(
    (screen: any) => screen?.isPrimary
  )
  document.documentElement.requestFullscreen({
    screen: nativeDisplay,
  })
}
</script>
