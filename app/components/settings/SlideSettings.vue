<template>
  <div
    class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%] flex flex-col gap-8"
  >
    <!-- LOOK AND FEEL OF SLIDES -->
    <SettingsGroup
      title="Look and Feel"
      note="These settings ONLY apply to new slides."
    >
      <SettingsRow label="Default font">
        <SettingsSelect
          searchable
          searchable-placeholder="Search fonts"
          :options="appFonts"
          :model-value="appStore.currentState.settings.defaultFont"
          @change="appStore.setDefaultFont($event)"
        >
          <template #label>
            <IconWrapper name="i-bx-font-family" size="4" />
            <span
              v-if="appStore.currentState.settings.defaultFont?.length"
              class="truncate"
              :class="
                useURLFriendlyString(appStore.currentState.settings.defaultFont)
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
        </SettingsSelect>
      </SettingsRow>

      <SettingsSlider
        label="Default font size"
        :model-value="appStore.currentState.settings.slideStyles.fontSizePercent"
        :min="MIN_FONT_SIZE"
        :max="MAX_FONT_SIZE"
        :step="5"
        suffix="%"
        @change="
          appStore.setSlideStyles({
            ...appStore.currentState.settings.slideStyles,
            fontSizePercent: Number($event),
          })
        "
      />

      <SettingsRow label="Default slide alignment">
        <SettingsSelect
          class="capitalize"
          :options="['left', 'center', 'right']"
          :model-value="appStore.currentState.settings.slideStyles.alignment"
          @change="
            appStore.setSlideStyles({
              ...appStore.currentState.settings.slideStyles,
              alignment: $event,
            })
          "
        />
      </SettingsRow>

      <SettingsRow label="Uppercase text">
        <CowToggle
          bare
          label="Uppercase text"
          :model-value="
            appStore.currentState.settings.slideStyles.lettercase === 'uppercase'
          "
          @update:model-value="
            appStore.setSlideStyles({
              ...appStore.currentState.settings.slideStyles,
              lettercase: $event ? 'uppercase' : '',
            })
          "
        />
      </SettingsRow>

      <SettingsRow label="Outlined text">
        <CowToggle
          bare
          label="Outlined text"
          :model-value="appStore.currentState.settings.slideStyles.textOutlined"
          @update:model-value="
            appStore.setSlideStyles({
              ...appStore.currentState.settings.slideStyles,
              textOutlined: $event,
            })
          "
        />
      </SettingsRow>

      <SettingsRow label="Bold text">
        <CowToggle
          bare
          label="Bold text"
          :model-value="appStore.currentState.settings.slideStyles.textBold"
          @update:model-value="
            appStore.setSlideStyles({
              ...appStore.currentState.settings.slideStyles,
              textBold: $event,
            })
          "
        />
      </SettingsRow>

      <SettingsRow label="Text line background">
        <CowToggle
          bare
          label="Text line background"
          :model-value="
            appStore.currentState.settings.slideStyles.textLinesBackground
          "
          @update:model-value="
            appStore.setSlideStyles({
              ...appStore.currentState.settings.slideStyles,
              textLinesBackground: $event,
            })
          "
        />
      </SettingsRow>

      <SettingsRow label="Default background fill type">
        <SettingsSelect
          class="capitalize"
          :options="Object.values(backgroundFillTypes)"
          :model-value="
            appStore.currentState.settings.slideStyles.backgroundFillType ||
            backgroundFillTypes.crop
          "
          @change="
            appStore.setSlideStyles({
              ...appStore.currentState.settings.slideStyles,
              backgroundFillType: $event,
            })
          "
        />
      </SettingsRow>
    </SettingsGroup>

    <!-- FOOTNOTES & CREDITS -->
    <SettingsGroup
      title="Footnotes & Credits"
      note="These settings ONLY apply to new slides."
    >
      <SettingsRow label="Song/hymn title and artistes">
        <CowToggle
          bare
          label="Song/hymn title and artistes"
          :model-value="
            appStore.currentState.settings.songAndHymnLabelsVisibility
          "
          @update:model-value="appStore.setSongAndHymnLabelsVisibility($event)"
        />
      </SettingsRow>

      <SettingsRow
        label="Footnotes and credits"
        description="Shown on Bible and Hymn slides."
      >
        <CowToggle
          bare
          label="Footnotes and credits"
          :model-value="appStore.currentState.settings.footnotes"
          @update:model-value="appStore.setFootnotes($event)"
        />
      </SettingsRow>
    </SettingsGroup>

    <!-- SPACE MANAGEMENT OF SLIDES -->
    <SettingsGroup
      title="Space Management"
      note="Click any of the dashed edges to adjust that side's padding."
    >
      <template #badge>
        <IconWrapper
          v-if="showTeamsBadge && !hasAccessToSpaceManagement"
          name="i-bxs-award"
          class="inline-flex w-5 h-5 text-[#FF8980] cursor-pointer"
          @click="handleUpgradeClick"
        />
      </template>

      <SettingsSlider
        v-if="activePadding"
        class="come-up-1"
        :label="activePaddingLabel"
        :model-value="paddingValue"
        :min="24"
        :max="paddingMax"
        :step="1"
        :disabled="!hasAccessToSpaceManagement"
        @change="
          hasAccessToSpaceManagement
            ? appStore.setWindowPadding({ [activePadding]: $event })
            : handleUpgradeClick()
        "
      />

      <div
        class="sample-monitor rounded-2xl bg-[#f1f3f6] dark:bg-[#1b212e] relative grid place-items-center overflow-hidden"
        :style="`width: 400px; height: 220px`"
      >
        <div class="inner max-w-[60%] mx-auto text-center p-8">
          <p class="text-xs text-gray-500 dark:text-[#9aa3b2]">
            Click on any of the dashed edges to adjust the padding
          </p>
        </div>
        <button
          v-for="side in paddingSides"
          :key="side.name"
          class="padding-edge absolute grid place-items-center border-dashed border-gray-400 dark:border-[#3a4356] text-xs font-semibold text-gray-600 dark:text-[#a7afbd] transition-colors disabled:cursor-not-allowed"
          :class="[
            side.class,
            activePadding === side.name
              ? 'bg-primary-200 dark:bg-primary-800'
              : 'hover:bg-white/70 dark:hover:bg-[#222938]',
          ]"
          :disabled="!hasAccessToSpaceManagement"
          :style="side.style"
          @click="
            hasAccessToSpaceManagement
              ? (activePadding = side.name)
              : handleUpgradeClick()
          "
        >
          {{ windowPadding?.[side.name] }}
        </button>
      </div>
    </SettingsGroup>

    <!-- ANIMATION -->
    <SettingsGroup title="Animation & Transitions">
      <template #badge>
        <IconWrapper
          v-if="showTeamsBadge && !hasAccessToAnimations"
          name="i-bxs-award"
          class="inline-flex w-5 h-5 text-[#FF8980] cursor-pointer"
          @click="handleUpgradeClick"
        />
      </template>

      <SettingsRow
        label="Transitions between slides"
        :disabled="!hasAccessToAnimations"
      >
        <CowToggle
          bare
          label="Transitions between slides"
          :model-value="appStore.currentState.settings.animations"
          :disabled="!hasAccessToAnimations"
          @update:model-value="
            hasAccessToAnimations
              ? appStore.setAnimations($event)
              : handleUpgradeClick()
          "
        />
      </SettingsRow>

      <SettingsSlider
        v-if="appStore.currentState.settings.animations"
        label="Transition interval"
        :model-value="appStore.currentState.settings.transitionInterval"
        :min="0"
        :max="3"
        :step="0.1"
        suffix="s"
        :disabled="!hasAccessToAnimations"
        @change="
          hasAccessToAnimations
            ? appStore.setTransitionInterval($event)
            : handleUpgradeClick()
        "
      />

      <SettingsRow
        label="Micro animations"
        description="Text and micro animations on slide content."
        :disabled="!hasAccessToAnimations"
      >
        <CowToggle
          bare
          label="Micro animations"
          :model-value="appStore.currentState.settings.microAnimations !== false"
          :disabled="!hasAccessToAnimations"
          @update:model-value="
            hasAccessToAnimations
              ? appStore.setMicroAnimations($event)
              : handleUpgradeClick()
          "
        />
      </SettingsRow>

      <SettingsRow
        label="Verse-to-verse transition"
        :disabled="!hasAccessToAnimations"
      >
        <SettingsSelect
          :options="verseTransitionStyleOptions"
          value-attribute="key"
          option-attribute="label"
          :model-value="
            appStore.currentState.settings.verseTransitionStyle || 'off'
          "
          :disabled="!hasAccessToAnimations"
          @change="
            (key: string) => {
              if (!hasAccessToAnimations) {
                handleUpgradeClick()
                return
              }
              appStore.setVerseTransitionStyle(key)
            }
          "
        />
      </SettingsRow>

      <SettingsSlider
        v-if="
          (appStore.currentState.settings.verseTransitionStyle || 'off') !==
          'off'
        "
        label="Verse-to-verse interval"
        :model-value="appStore.currentState.settings.verseTransitionInterval"
        :min="0"
        :max="1.5"
        :step="0.1"
        suffix="s"
        :disabled="!hasAccessToAnimations"
        @change="
          hasAccessToAnimations
            ? appStore.setVerseTransitionInterval($event)
            : handleUpgradeClick()
        "
      />
    </SettingsGroup>

    <!-- SONG SLIDES -->
    <SettingsGroup
      title="Song Slides"
      note="These settings ONLY apply to new slides."
    >
      <SettingsRow label="Default lines per slide">
        <SettingsSelect
          :options="['1', '2', '3', '4', '5', '6']"
          v-model.number="lines"
          @change="appStore.setLinesPerSlide($event)"
        >
          <template #label>
            <IconWrapper name="i-tabler-list-numbers" size="4" />
            <span v-if="lines" class="truncate"
              >{{ lines }} {{ lines > 1 ? "lines" : "line" }}</span
            >
            <span v-else class="truncate whitespace-nowrap">
              Lines per slide
            </span>
          </template>
          <template #option="{ option: option }">
            <span v-if="option" class="truncate"
              >{{ option }} {{ Number(option) > 1 ? "lines" : "line" }}</span
            >
            <span v-else class="truncate whitespace-nowrap">
              Lines per slide
            </span>
          </template>
        </SettingsSelect>
      </SettingsRow>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
const appStore = useAppStore()

type PaddingSide = "top" | "right" | "bottom" | "left"

const MAX_FONT_SIZE = 150
const MIN_FONT_SIZE = 50
const lines = ref<number>(
  appStore.currentState.settings.slideStyles.linesPerSlide || 4
)
const activePadding = ref<PaddingSide | "">("")
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

const verseTransitionStyleOptions = [
  { key: "off", label: "Off" },
  { key: "fade", label: "Fade" },
  { key: "slide-up", label: "Slide up" },
]

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

const windowPadding = computed(
  () => currentState.value.settings.slideStyles?.windowPadding
)

// Left/right padding is capped lower than top/bottom — a 16:9 stage runs out
// of horizontal room first.
const paddingMax = computed(() =>
  activePadding.value === "right" || activePadding.value === "left" ? 100 : 120
)

const activePaddingLabel = computed(() =>
  activePadding.value
    ? `${activePadding.value[0]?.toUpperCase()}${activePadding.value.slice(
        1
      )} padding`
    : ""
)

const paddingValue = computed(() =>
  activePadding.value
    ? (windowPadding.value?.[activePadding.value] as number)
    : 0
)

// Each edge is a button sized to the padding it represents, so the preview
// doubles as the control. Horizontal edges take a height, vertical ones a width.
const paddingSides = computed(() => [
  {
    name: "top" as PaddingSide,
    class: "top-0 left-0 right-0 border-b rounded-t-2xl",
    style: { height: `${windowPadding.value?.top}px` },
  },
  {
    name: "bottom" as PaddingSide,
    class: "bottom-0 left-0 right-0 border-t rounded-b-2xl",
    style: { height: `${windowPadding.value?.bottom}px` },
  },
  {
    name: "right" as PaddingSide,
    class: "top-0 bottom-0 right-0 border-l rounded-r-2xl",
    style: { width: `${windowPadding.value?.right}px` },
  },
  {
    name: "left" as PaddingSide,
    class: "top-0 bottom-0 left-0 border-r rounded-l-2xl",
    style: { width: `${windowPadding.value?.left}px` },
  },
])
</script>
