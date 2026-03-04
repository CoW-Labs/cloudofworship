<template>
  <div class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] pb-[15%]">
    <!-- LOOK AND FEEL OF SLIDES -->
    <div class="settings-group">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">
          Look and Feel
          <div class="text-primary">Settings ONLY apply to new slides</div>
        </h3>
      </div>
      <UForm :state="{}">
        <UFormGroup
          label="Set default font"
          class="flex items-center justify-between py-1 px-2 hover:bg-primary/10"
        >
          <USelectMenu
            class="border-0 shadow-none w-[200px]"
            searchable
            searchable-placeholder="Search fonts"
            select-class="w-[200px] bg-gray-100 dark:bg-gray-800 dark:text-white"
            size="md"
            :options="appFonts"
            :model-value="appStore.currentState.settings.defaultFont"
            variant="none"
            color="primary"
            clear-search-on-close
            :ui="selectUI"
            :ui-menu="selectMenuUI"
            @change="appStore.setDefaultFont($event)"
          >
            <template #label>
              <IconWrapper name="i-bx-font-family" size="4"> </IconWrapper>
              <span
                v-if="font?.length"
                class="truncate"
                :class="
                  useURLFriendlyString(
                    appStore.currentState.settings.defaultFont
                  )
                "
                >{{ appStore.currentState.settings.defaultFont }}</span
              >
              <span v-else>Select font</span>
            </template>
            <template #option="{ option: font }">
              <span
                v-if="font?.length"
                class="truncate"
                :class="useURLFriendlyString(font)"
                >{{ font }}</span
              >
              <span v-else>Select font</span>
            </template>
          </USelectMenu>
        </UFormGroup>

        <UFormGroup
          label="Set default font size"
          class="flex items-center justify-between py-3 px-2 hover:bg-primary/10"
        >
          <div
            class="flex px-0 items-center gap-2 font-semibold w-full min-w-[200px]"
          >
            <span class="text-sm">{{ MIN_FONT_SIZE }}%</span>
            <URange
              :model-value="
                appStore.currentState.settings.slideStyles.fontSizePercent
              "
              :min="MIN_FONT_SIZE"
              :max="MAX_FONT_SIZE"
              :step="5"
              @change="
                appStore.setSlideStyles({
                  ...appStore.currentState.settings.slideStyles,
                  fontSizePercent: Number($event),
                })
              "
            />
            <span class="text-sm">{{ MAX_FONT_SIZE }}%</span>
          </div>
        </UFormGroup>

        <UFormGroup
          label="Set default slide alignment"
          class="flex items-center justify-between py-1 px-2 hover:bg-primary/10"
        >
          <USelectMenu
            class="border-0 shadow-none max-w-[200px] capitalize"
            select-class="w-[200px] bg-gray-100 dark:bg-gray-800 dark:text-white capitalize"
            size="md"
            :options="['left', 'center', 'right']"
            :model-value="appStore.currentState.settings.slideStyles.alignment"
            variant="none"
            color="primary"
            clear-search-on-close
            :ui="selectUI"
            :ui-menu="selectMenuUI"
            @change="
              appStore.setSlideStyles({
                ...appStore.currentState.settings.slideStyles,
                alignment: $event,
              })
            "
          />
        </UFormGroup>
        <UFormGroup
          label="Uppercase Text"
          class="flex items-center justify-between py-2 px-2 hover:bg-primary/10"
        >
          <UToggle
            size="lg"
            :model-value="
              appStore.currentState.settings.slideStyles.lettercase ===
              'uppercase'
            "
            @change="
              appStore.setSlideStyles({
                ...appStore.currentState.settings.slideStyles,
                lettercase: $event ? 'uppercase' : '',
              })
            "
          />
        </UFormGroup>
        <UFormGroup
          label="Outlined Text"
          class="flex items-center justify-between py-2 px-2 hover:bg-primary/10"
        >
          <UToggle
            size="lg"
            :model-value="
              appStore.currentState.settings.slideStyles.textOutlined
            "
            @change="
              appStore.setSlideStyles({
                ...appStore.currentState.settings.slideStyles,
                textOutlined: $event,
              })
            "
          />
        </UFormGroup>
        <UFormGroup
          label="Bold Text"
          class="flex items-center justify-between py-2 px-2 hover:bg-primary/10"
        >
          <UToggle
            size="lg"
            :model-value="appStore.currentState.settings.slideStyles.textBold"
            @change="
              appStore.setSlideStyles({
                ...appStore.currentState.settings.slideStyles,
                textBold: $event,
              })
            "
          />
        </UFormGroup>
        <UFormGroup
          label="Set default background fill type"
          class="flex items-center justify-between py-1 px-2 hover:bg-primary/10"
        >
          <USelectMenu
            class="border-0 shadow-none max-w-[200px] capitalize"
            select-class="w-[200px] bg-gray-100 dark:bg-gray-800 dark:text-white capitalize"
            size="md"
            :options="Object.values(backgroundFillTypes)"
            :model-value="
              appStore.currentState.settings.slideStyles.backgroundFillType ||
              backgroundFillTypes.crop
            "
            variant="none"
            color="primary"
            clear-search-on-close
            :ui="selectUI"
            :ui-menu="selectMenuUI"
            @change="
              appStore.setSlideStyles({
                ...appStore.currentState.settings.slideStyles,
                backgroundFillType: $event,
              })
            "
          />
        </UFormGroup>
        <!-- flex items-center justify-between -->
      </UForm>
    </div>

    <UDivider class="mt-4" />

    <!-- BIBLE SLIDES -->
    <div class="settings-group border-gray-200 dark:border-gray-800 mt-8">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">
          Bible Slides
          <div class="text-primary">Settings ONLY apply to new slides</div>
        </h3>
      </div>
      <UForm :state="{}">
        <div class="flex items-center gap-2">
          <UFormGroup
            label="Set default Bible Version"
            class="flex items-center w-full justify-between py-1 px-2 hover:bg-primary/10"
          >
            <USelectMenu
              class="border-0 shadow-none max-w-[200px]"
              searchable
              searchable-placeholder="Search version"
              select-class="w-[200px]  bg-gray-100 dark:bg-gray-800 dark:text-white"
              size="md"
              :options="bibleVersionSelectOptions"
              :model-value="appStore.currentState.settings.defaultBibleVersion"
              variant="none"
              color="primary"
              clear-search-on-close
              :ui="selectUI"
              :ui-menu="selectMenuUI"
              @change="
                $event === '+ More Versions'
                  ? useGlobalEmit(
                      appWideActions.openSettings,
                      'Bible Version Settings'
                    )
                  : appStore.setDefaultBibleVersion($event)
              "
            >
            </USelectMenu>
          </UFormGroup>
          <UButton
            size="md"
            icon="i-bx-plus"
            variant="outline"
            class="mt-1"
            @click="$emit('select-active-tab', 'Bible Version Settings')"
          >
            Add more
          </UButton>
        </div>
      </UForm>
    </div>

    <UDivider class="mt-4" />

    <!-- FOOTNOTES & CREDITS -->
    <div class="settings-group border-gray-200 dark:border-gray-800 mt-8">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">
          Footnotes & Credits
          <div class="text-primary">Settings ONLY apply to new slides</div>
        </h3>
      </div>
      <UForm :state="{}">
        <UFormGroup
          label="Toggle song/hymn title and artistes"
          class="flex items-center justify-between py-2 px-2 hover:bg-primary/10"
        >
          <UToggle
            size="lg"
            :model-value="
              appStore.currentState.settings.songAndHymnLabelsVisibility
            "
            @change="appStore.setSongAndHymnLabelsVisibility($event)"
          />
        </UFormGroup>
        <UFormGroup
          label="Toggle footnotes and credits for Bible & Hymn Slides"
          class="flex items-center justify-between py-2 px-2 hover:bg-primary/10"
        >
          <UToggle
            size="lg"
            :model-value="appStore.currentState.settings.footnotes"
            @change="appStore.setFootnotes($event)"
          />
        </UFormGroup>
      </UForm>
    </div>

    <UDivider class="mt-4" />

    <!-- SPACE MANAGEMENT OF SLIDES -->
    <div
      class="settings-group border-gray-200 dark:border-gray-800 mt-8 relative"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold relative">
          Space Management
          <IconWrapper
            v-if="showTeamsBadge && !hasAccessToSpaceManagement"
            name="i-bxs-award"
            class="inline-flex w-6 h-6 text-xs ml-2 text-[#FF8980] absolute -top-1 cursor-pointer"
            @click="handleUpgradeClick"
          />
        </h3>
      </div>
      <UForm :state="{}">
        <div class="header flex items-center justify-between">
          <h4 class="text-sm font-semibold opacity-70 whitespace-nowrap mr-6">
            Set default padding between slides
          </h4>
          <div
            v-if="activePadding"
            class="flex px-0 items-center gap-2 font-semibold come-up-1 w-[200px]"
          >
            <span class="text-sm">24</span>
            <URange
              :model-value="(appStore.currentState.settings.slideStyles?.windowPadding?.[activePadding as 'top' | 'right' | 'bottom' | 'left'] as number)"
              :min="24"
              :max="
                activePadding === 'right' || activePadding === 'left'
                  ? 100
                  : 120
              "
              :step="1"
              :disabled="!hasAccessToSpaceManagement"
              @change="
                hasAccessToSpaceManagement
                  ? appStore.setWindowPadding({ [activePadding]: $event })
                  : handleUpgradeClick()
              "
            />
            <span class="text-sm">
              {{
                activePadding === "right" || activePadding === "left"
                  ? 100
                  : 120
              }}</span
            >
          </div>
        </div>
        <div
          class="sample-monitor bg-gray-100 dark:bg-gray-800 dark:text-white rounded-lg my-4 relative grid place-items-center"
          :style="`width: 400px; height: 220px`"
        >
          <div class="inner max-w-[60%] mx-auto text-center p-8">
            <p class="text-sm opacity-50">
              Click on any of the dashed corners to adjust the padding
            </p>
          </div>
          <UButton
            variant="ghost"
            class="top-padding border-b border-dashed justify-center border-gray-500 dark:border-gray-500 absolute top-0 left-0 right-0 rounded-b-none"
            :class="
              activePadding === 'top'
                ? 'bg-primary-200 dark:bg-primary-800'
                : ''
            "
            :disabled="!hasAccessToSpaceManagement"
            :style="`height: ${currentState.settings.slideStyles?.windowPadding?.top}px`"
            @click="
              hasAccessToSpaceManagement
                ? (activePadding = 'top')
                : handleUpgradeClick()
            "
          >
            {{ currentState.settings.slideStyles?.windowPadding?.top }}</UButton
          >
          <UButton
            variant="ghost"
            class="bottom-padding border-t border-dashed justify-center border-gray-500 dark:border-gray-500 absolute bottom-0 left-0 right-0 rounded-t-none"
            :class="
              activePadding === 'bottom'
                ? 'bg-primary-200 dark:bg-primary-800'
                : ''
            "
            :disabled="!hasAccessToSpaceManagement"
            :style="`height: ${currentState.settings.slideStyles?.windowPadding?.bottom}px`"
            @click="
              hasAccessToSpaceManagement
                ? (activePadding = 'bottom')
                : handleUpgradeClick()
            "
          >
            {{
              currentState.settings.slideStyles?.windowPadding?.bottom
            }}</UButton
          >
          <UButton
            variant="ghost"
            class="right-padding opacity-50 p-0 pl-[3px] border-l border-dashed border-gray-500 dark:border-gray-500 absolute top-0 bottom-0 right-0 rounded-l-none"
            :class="
              activePadding === 'right'
                ? 'bg-primary-200 dark:bg-primary-800'
                : ''
            "
            :disabled="!hasAccessToSpaceManagement"
            :style="`width: ${currentState.settings.slideStyles?.windowPadding?.right}px`"
            @click="
              hasAccessToSpaceManagement
                ? (activePadding = 'right')
                : handleUpgradeClick()
            "
          >
            {{
              currentState.settings.slideStyles?.windowPadding?.right
            }}</UButton
          >
          <UButton
            variant="ghost"
            class="left-padding opacity-50 p-0 pl-[3px] border-r border-dashed border-gray-500 dark:border-gray-500 absolute top-0 bottom-0 left-0 rounded-r-none"
            :class="
              activePadding === 'left'
                ? 'bg-primary-200 dark:bg-primary-800'
                : ''
            "
            :disabled="!hasAccessToSpaceManagement"
            :style="`width: ${currentState.settings.slideStyles?.windowPadding?.left}px`"
            @click="
              hasAccessToSpaceManagement
                ? (activePadding = 'left')
                : handleUpgradeClick()
            "
          >
            {{ currentState.settings.slideStyles?.windowPadding?.left }}
          </UButton>
        </div>
      </UForm>
    </div>

    <UDivider class="mt-4" />

    <!-- ANIMATION -->
    <div
      class="settings-group border-gray-200 dark:border-gray-800 mt-8 relative"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold relative">
          Animation & Transitions
          <IconWrapper
            v-if="showTeamsBadge && !hasAccessToAnimations"
            name="i-bxs-award"
            class="inline-flex w-6 h-6 text-xs ml-2 text-[#FF8980] absolute -top-1 cursor-pointer"
            @click="handleUpgradeClick"
          />
        </h3>
      </div>
      <UForm :state="{}">
        <UFormGroup
          label="Transition between slides and micro animations"
          class="flex items-center justify-between px-2 py-2 hover:bg-primary/10"
        >
          <UToggle
            size="lg"
            :model-value="appStore.currentState.settings.animations"
            :disabled="!hasAccessToAnimations"
            @change="
              hasAccessToAnimations
                ? appStore.setAnimations($event)
                : handleUpgradeClick()
            "
          />
        </UFormGroup>
        <UFormGroup
          v-if="appStore.currentState.settings.animations"
          label="Transition interval in seconds"
          class="flex items-center justify-between px-2 py-2 hover:bg-primary/10"
        >
          <div
            class="flex px-0 items-center gap-2 font-semibold w-full min-w-[200px]"
          >
            <span class="text-sm">0s</span>
            <URange
              :model-value="appStore.currentState.settings.transitionInterval"
              :min="0"
              :max="5"
              :step="0.1"
              :disabled="!hasAccessToAnimations"
              @change="
                hasAccessToAnimations
                  ? appStore.setTransitionInterval($event)
                  : handleUpgradeClick()
              "
            />
            <span class="text-sm"> 5s</span>
          </div>
        </UFormGroup>
      </UForm>
    </div>

    <UDivider class="mt-4" />

    <!-- OVERLAYS AND THEMES -->
    <div
      class="settings-group border-gray-200 dark:border-gray-800 mt-8 relative"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold relative">
          Overlays & Themes
          <IconWrapper
            v-if="showTeamsBadge && !hasAccessToOverlays"
            name="i-bxs-award"
            class="inline-flex w-6 h-6 text-xs ml-2 text-[#FF8980] absolute -top-1 cursor-pointer"
            @click="handleUpgradeClick"
          />
        </h3>
      </div>
      <UForm :state="{}">
        <div class="flex items-end gap-4">
          <UFormGroup
            label="Set slide overlay"
            class="flex w-full items-center justify-between py-2 px-2 hover:bg-primary/10"
          >
            <USelectMenu
              class="border-0 shadow-none max-w-[200px]"
              select-class="w-[200px] bg-gray-100 dark:bg-gray-800 dark:text-white"
              size="md"
              :options="[
                { key: 'falling-snow', label: 'Falling Snow' },
                { key: 'none', label: 'None selected' },
              ]"
              :model-value="appStore.currentState.activeOverlay"
              :disabled="!hasAccessToOverlays"
              variant="none"
              color="primary"
              :ui="selectUI"
              :ui-menu="selectMenuUI"
              @change="
                (event: any) => {
                  if (!hasAccessToOverlays) {
                    handleUpgradeClick()
                    return
                  }
                  const overlay = event.key
                  appStore.setActiveOverlay(overlay)
                  sendOverlayToWebsocket(overlay)
                }
              "
            >
            </USelectMenu>
          </UFormGroup>
        </div>
      </UForm>
    </div>

    <UDivider class="mt-4" />

    <!-- SONG SLIDES -->
    <div class="settings-group border-gray-200 dark:border-gray-800 mt-8">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">
          Song Slides
          <div class="text-primary">Settings ONLY apply to new slides</div>
        </h3>
      </div>
      <UForm :state="{}">
        <UFormGroup label="Set default lines per slide">
          <USelectMenu
            class="absolute border-0 shadow-none top-[6px]"
            select-class="border-3 shadow-none outline-none text-center w-[200px] bg-gray-100 dark:bg-gray-800 dark:text-white"
            size="md"
            :options="['1', '2', '3', '4', '5', '6']"
            v-model.number="lines"
            variant="none"
            color="primary"
            clear-search-on-close
            :ui="{
              base: 'bg-primary-500',
              input: 'bg-primary-500',
              color: {
                primary: {
                  outline: 'shadow-sm bg-primary-500 ',
                },
              },
            }"
            :ui-menu="{
              width: 'w-[200px]',
              input: 'text-xs',
              empty: 'text-xs',
              option: {
                size: 'text-xs',
              },
            }"
            @change="appStore.setLinesPerSlide($event)"
          >
            <template #label>
              <IconWrapper name="i-tabler-list-numbers" size="4"> </IconWrapper>
              <span v-if="lines" class="truncate"
                >{{ lines }} {{ lines > 1 ? "lines" : "line" }}</span
              >
              <span v-else class="truncate whitespace-nowrap"
                >Lines per slide</span
              >
            </template>
            <template #option="{ option: lines }">
              <span
                v-if="lines"
                class="truncate"
                :class="useURLFriendlyString(lines)"
                >{{ lines }} {{ lines > 1 ? "lines" : "line" }}</span
              >
              <span v-else class="truncate whitespace-nowrap"
                >Lines per slide</span
              >
            </template>
          </USelectMenu>
        </UFormGroup>
      </UForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
const appStore = useAppStore()

const MAX_FONT_SIZE = 150
const MIN_FONT_SIZE = 50
const font = ref(appStore.currentState.settings.defaultFont)
const lines = ref<number>(
  appStore.currentState.settings.slideStyles.linesPerSlide || 4
)
const activePadding = ref<string>("")
const { currentState } = storeToRefs(appStore)

// Teams subscription check
const { requiresTeams, hasAccessToFeature } = useSubscription()
const { isEnabled: isPremiumFeatureEnabled } = useFeatureFlags("teams")
const emitter = useNuxtApp().$emitter as any

// Check access to premium features
const hasAccessToSpaceManagement = computed(() => {
  if (!isPremiumFeatureEnabled.value) return true
  return hasAccessToFeature("space-management")
})

const hasAccessToAnimations = computed(() => {
  if (!isPremiumFeatureEnabled.value) return true
  return hasAccessToFeature("animations-transitions")
})

const hasAccessToOverlays = computed(() => {
  if (!isPremiumFeatureEnabled.value) return true
  return hasAccessToFeature("overlays-themes")
})

// Show teams badge if feature is locked
const showTeamsBadge = computed(() => {
  return isPremiumFeatureEnabled.value
})

// Handle upgrade click
const handleUpgradeClick = () => {
  emitter.emit("show-upgrade-modal")
  usePosthogCapture("TEAMS_FEATURE_BLOCKED", {
    feature: "slide-settings-premium",
  })
}

const bibleVersionSelectOptions = computed(() =>
  [
    ...currentState.value.settings.bibleVersions,
    currentState.value.settings.bibleVersions?.find(
      (version) => !version?.isDownloaded
    )
      ? {
          id: "+ More Versions",
          name: "Add more versions",
          isDownloaded: false,
        }
      : null,
  ]
    ?.filter((version) => version?.isDownloaded)
    ?.map((version) => version?.id)
)

const getActivePaddingValue = (side: string) => {
  side = side as "top" | "right" | "bottom" | "left"
  return appStore.currentState.settings.slideStyles.windowPadding?.[
    side as "top" | "right" | "bottom" | "left"
  ]
}

const removeOverlayFromWebsocket = () => {
  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) {
    socket.emit("remove-overlay", {})
  }
}

const sendOverlayToWebsocket = (overlay: string) => {
  if (!overlay) {
    return removeOverlayFromWebsocket()
  }
  const socket = useNuxtApp().$socketio as any
  if (socket?.connected) {
    socket.emit("add-overlay", overlay)
  }
}

const selectUI = {
  base: "bg-primary-500",
  input: "bg-primary-500",
  color: {
    primary: {
      outline: "shadow-sm bg-primary-500 ",
    },
  },
}
const selectMenuUI = {
  width: "w-[200px]",
  input: "text-xs",
  empty: "text-xs",
  option: {
    size: "text-xs",
  },
}
const libraryTabs = [
  { label: "Still Background", icon: "i-bx-image" },
  { label: "Motion Background", icon: "i-bx-film" },
]
</script>
