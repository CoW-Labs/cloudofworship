<template>
  <section
    class="app-section flex flex-col h-full rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden"
  >
    <div
      v-if="heading || subHeading"
      class="heading flex items-center justify-between px-4 py-3 shrink-0 short:px-3 short:py-2"
      :class="headingStyles"
    >
      <h2
        class="font-medium text-sm flex items-center text-gray-700 dark:text-[#a7afbd] min-w-0"
      >
        <template v-if="subHeading">
          <UTooltip text="Go back">
            <button
              class="p-1 -ml-1 px-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-[#222938] transition-colors"
              @click="$emit('header-click')"
            >
              {{ heading }}
            </button>
          </UTooltip>
          <ArrowRightIcon class="w-3.5 h-3.5 text-primary shrink-0" />
          <span
            class="pl-2 text-gray-600 dark:text-[#a7afbd] font-normal capitalize truncate min-w-0 flex-1"
            >{{ subHeading }}</span
          >
        </template>
        <span v-else class="whitespace-nowrap truncate">
          {{ heading }}
        </span>
        <slot name="heading-suffix" />
      </h2>
      <div class="actions flex flex-row-reverse items-center gap-1.5 shrink-0">
        <div
          class="action-inner"
          v-for="secondaryButton in secondaryButtons"
          :data-tour="
            secondaryButton.action === appWideActions.goLive
              ? 'go-live'
              : undefined
          "
        >
          <ConfirmDialog
            v-if="secondaryButton.visible && secondaryButton.confirmAction"
            :button-label="secondaryButton.label"
            :button-icon="secondaryButton.icon"
            :button-color="secondaryButton.color"
            button-size="md"
            header="Delete selected slides"
            button-styles="p-1 px-2"
            label="Are you sure you want to delete all of the selected slides? This action is irreversible."
            @confirm="$emit(secondaryButton.action)"
          >
          </ConfirmDialog>
          <!-- Direct button when live (no popover) -->
          <CowButton
            v-if="
              secondaryButton.visible &&
              !secondaryButton.confirmAction &&
              secondaryButton.action === appWideActions.goLive &&
              isLiveWindowActive
            "
            :variant="getCowButtonVariant(secondaryButton.variant)"
            size="2xs"
            class="whitespace-nowrap !px-3 !py-1.5 text-xs gap-1.5"
            @click.stop="useGlobalEmit(appWideActions.closeLiveWindow)"
          >
            <GoLiveIcon
              v-if="secondaryButton.svgIcon === 'GoLiveIcon'"
              class="w-3.5 h-3.5"
            />
            End Live Session
          </CowButton>

          <button
            v-else-if="
              secondaryButton.visible &&
              !secondaryButton.confirmAction &&
              secondaryButton.action !== appWideActions.goLive
            "
            class="whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 dark:text-[#d5dae3] dark:hover:bg-[#222938]"
            @click.stop="useGlobalEmit(secondaryButton.action)"
          >
            {{ secondaryButton.label }}
          </button>

          <!-- Popover when not live -->
          <UPopover
            v-else-if="
              secondaryButton.visible &&
              !secondaryButton.confirmAction &&
              secondaryButton.action === appWideActions.goLive
            "
            mode="click"
            v-model:open="secondaryActionPopoverOpen"
            :ui="{
              ring: 'ring-0',
              background: 'bg-transparent border-0 mr-5',
              rounded: 'rounded-xl',
              shadow: 'shadow-lg',
            }"
          >
            <CowButton
              :variant="getCowButtonVariant(secondaryButton.variant)"
              size="2xs"
              class="whitespace-nowrap !px-3 !py-1.5 text-xs gap-1.5"
              @click.stop="
                secondaryButton.action !== appWideActions.goLive
                  ? useGlobalEmit(secondaryButton.action)
                  : (secondaryActionPopoverOpen = true)
              "
            >
              <GoLiveIcon
                v-if="secondaryButton.svgIcon === 'GoLiveIcon'"
                class="w-3.5 h-3.5"
              />
              <IconWrapper
                v-else-if="secondaryButton.icon"
                :name="secondaryButton.icon"
                class="w-3.5 h-3.5"
              />
              {{ secondaryButton.label }}
            </CowButton>
            <template #panel>
              <div
                class="go-live-menu w-[272px] flex flex-col rounded-xl overflow-hidden bg-white dark:bg-[#131724] ring-1 ring-gray-100 dark:ring-[#0d0f1a]"
              >
                <button
                  v-for="item in goLiveMenuItems"
                  :key="item.label"
                  type="button"
                  class="go-live-menu__row flex items-start gap-3 w-full px-4 py-2.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-[#2b3140] disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                  :disabled="item.disabled"
                  @click="
                    () => {
                      secondaryActionPopoverOpen = false
                      item.onClick()
                    }
                  "
                >
                  <GoLiveIcon
                    v-if="item.svgIcon === 'GoLiveIcon'"
                    class="w-4 h-4 mt-0.5 shrink-0 text-gray-600 dark:text-[#9ba3b2]"
                  />
                  <IconWrapper
                    v-else
                    :name="item.icon"
                    class="w-4 h-4 mt-0.5 shrink-0 text-gray-600 dark:text-[#9ba3b2]"
                  />
                  <div class="min-w-0">
                    <div
                      class="flex items-center gap-1.5 text-xs font-medium text-gray-800 dark:text-[#d5dae3]"
                    >
                      {{ item.label }}
                      <IconWrapper
                        v-if="item.locked"
                        name="i-ph-crown-simple-fill"
                        class="w-3.5 h-3.5 text-[#FF8980]"
                      />
                    </div>
                    <div class="text-[11px] leading-snug text-gray-500 dark:text-[#9ba3b2]">
                      {{ item.desc }}
                    </div>
                  </div>
                </button>
              </div>
            </template>
          </UPopover>
        </div>
        <!-- Custom header actions (e.g. inline toolbars) rendered left-most -->
        <slot name="actions" />
      </div>
    </div>
    <div
      :class="`slot-ctn px-3 pb-3 text-sm flex flex-col flex-1 min-h-0 short:px-2 short:pb-2 ${
        heading || subHeading ? '' : 'pt-3 short:pt-2'
      } ${slotCtnStyles || ''}`"
    >
      <slot></slot>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store/app"
import { appWideActions } from "~/utils/constants"
import GoLiveIcon from "~/components/svgs/GoLiveIcon.vue"
import ArrowRightIcon from "~/components/svgs/ArrowRightIcon.vue"

const props = defineProps({
  heading: String,
  subHeading: String,
  slotCtnStyles: String,
  headingStyles: String,
  secondaryButtons: Array as PropType<
    Array<{
      label: string
      action: string
      icon: string
      color: string
      variant?: string
      confirmAction: boolean
      visible: boolean
      // Optional custom SVG icon component name (auto-imported from
      // components/svgs). When set it replaces the iconify `icon`.
      svgIcon?: string
    }>
  >,
  isLiveWindowActive: Boolean,
})
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const secondaryActionPopoverOpen = ref(false)

// Shared with the live-output panel's own menu, so the two entry points cannot
// disagree about the URL or the Teams gate.
const {
  canUseLivestreamLink,
  livestreamSessionsLabel,
  isClipboardCopying,
  copyLivestreamURL,
} = useLivestreamLink()
const { canUseStageStreamLink, isStageLinkCopying, copyStageStreamURL } =
  useStageStreamLink()
const { hasAccessToFeature } = useSubscription()
const canOpenStageDisplay = computed(() =>
  hasAccessToFeature(appWideActions.openStageDisplay)
)

const goLiveMenuItems = computed(() => [
  {
    label: "Open live window",
    desc: "Opens another browser window with the live display",
    icon: "",
    svgIcon: "GoLiveIcon",
    disabled: props.isLiveWindowActive,
    locked: false,
    onClick: () => useGlobalEmit(appWideActions.goLive),
  },
  {
    label: "Open stage display",
    desc: "Opens the confidence monitor for musicians and speakers",
    icon: "i-ph-monitor-play",
    disabled: false,
    locked: !canOpenStageDisplay.value,
    onClick: () =>
      canOpenStageDisplay.value
        ? useGlobalEmit(appWideActions.openStageDisplay)
        : useGlobalEmit(appWideActions.showUpgradeModal, {
            feature: appWideActions.openStageDisplay,
          }),
  },
  {
    label: "Copy livestream link",
    desc: livestreamSessionsLabel.value
      ? `For OBS, vMix or similar software. ${livestreamSessionsLabel.value}`
      : "For OBS, vMix or similar software",
    icon: isClipboardCopying.value ? "i-ph-check-circle" : "i-ph-broadcast",
    disabled: false,
    locked: !canUseLivestreamLink.value,
    onClick: () =>
      canUseLivestreamLink.value
        ? copyLivestreamURL()
        : useGlobalEmit(appWideActions.showUpgradeModal, {
            feature: "livestream-url",
          }),
  },
  {
    label: "Copy stage display link",
    desc: "Open the stage display on any phone, tablet or TV",
    icon: isStageLinkCopying.value ? "i-ph-check-circle" : "i-ph-link",
    disabled: false,
    locked: !canUseStageStreamLink.value,
    onClick: () =>
      canUseStageStreamLink.value
        ? copyStageStreamURL()
        : useGlobalEmit(appWideActions.showUpgradeModal, {
            feature: "stagestream-url",
          }),
  },
])

type CowButtonVariant = "primary" | "secondary" | "dark" | "danger"

const getCowButtonVariant = (variant?: string): CowButtonVariant => {
  return variant === "primary" ||
    variant === "secondary" ||
    variant === "dark" ||
    variant === "danger"
    ? variant
    : "dark"
}

</script>

<style scoped></style>
