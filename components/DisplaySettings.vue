<template>
  <div class="settings-ctn h-[100%] flex flex-col gap-6">
    <div v-if="currentScreen" class="primary-display flex flex-col gap-2">
      <h3 class="font-medium">Primary Screen (Control Center)</h3>
      <div
        class="bg-primary-100 p-4 px-6 rounded-md flex justify-between items-center"
      >
        <div class="info flex gap-4">
          <IconWrapper name="i-lucide-monitor" size="6" class="pt-1" />
          <div class="name-and-dimensions">
            <div class="name text-sm font-semibold">
              {{ currentScreen?.label }}
            </div>
            <div class="dimensions text-xs">
              {{ currentScreen?.width }} x
              {{ currentScreen?.height }}
            </div>
          </div>
        </div>
        <UButton
          v-if="!currentScreen?.isInternal"
          @click="moveCurrentScreenToNativeDisplay"
        >
          Move to native screen
        </UButton>
      </div>
    </div>
    <div
      v-if="allScreens?.length"
      class="secondary-display flex flex-col gap-2"
    >
      <h3 class="font-medium">All Screens</h3>
      <div
        v-for="screen in allScreens?.filter((screen: any) => screen?.label !== currentScreen?.label)"
        :key="screen.label"
        class="bg-gray-100 p-4 px-6 rounded-md flex justify-between items-center"
      >
        <div class="info flex gap-4">
          <IconWrapper name="i-lucide-monitor-play" size="6" class="pt-1" />
          <div class="name-and-dimensions">
            <div class="name text-sm font-semibold">
              {{ screen?.label }}
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
            :ui="{ base: 'h-5 w-5' }"
            label="Main display"
            :value="screen.label"
            :model-value="currentState.mainDisplayLabel === screen.label"
            @change="appStore.setMainDisplayLabel($event ? screen.label : '')"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store/app"

const appStore = useAppStore()
const currentScreen = ref<any>({})
const allScreens = ref<any>([])
const { currentState } = storeToRefs(appStore)

let screenDetails: any

onMounted(async () => {
  screenDetails = await window.getScreenDetails()
  currentScreen.value = screenDetails?.currentScreen
  allScreens.value = screenDetails?.screens

  addEventListener("resize", async () => {
    screenDetails = await window.getScreenDetails()
    currentScreen.value = screenDetails.currentScreen
  })
})

const moveCurrentScreenToNativeDisplay = async () => {
  const nativeDisplay = allScreens.value.find(
    (screen: any) => screen?.isInternal
  )
  document.documentElement.requestFullscreen({
    screen: nativeDisplay,
  })
}
</script>
