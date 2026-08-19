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
              ring: 'ring-1',
              background: 'bg-white dark-bg-gray-900 border-0 mr-5',
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
              <div class="actions max-w-[270px]">
                <UButton
                  class="text-left p-3 px-4 hover:bg-primary-100 dark:hover:bg-[#222938]"
                  color="black"
                  variant="ghost"
                  :class="
                    isLiveWindowActive && secondaryButton.action === 'go-live'
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  "
                  :icon="secondaryButton.icon"
                  size="sm"
                  @click="
                    useGlobalEmit(
                      isLiveWindowActive ? '' : appWideActions.goLive
                    )
                  "
                >
                  <div class="pl-2">
                    <div class="text-sm">Open Live Window</div>
                    <div class="text-xs opacity-80">
                      Opens another browser window with live display
                    </div>
                  </div>
                </UButton>
                <div class="line border-b dark:border-[#202838]"></div>
                <UButton
                  class="text-left p-3 px-4 hover:bg-primary-100 dark:hover:bg-[#222938]"
                  :class="!canUseLivestreamLink ? 'cursor-pointer' : ''"
                  color="black"
                  variant="ghost"
                  :icon="
                    isClipboardCopying ? 'i-bx-check-circle' : 'i-bx-clipboard'
                  "
                  size="sm"
                  @click="
                    canUseLivestreamLink
                      ? copyLivestreamURL()
                      : useGlobalEmit('show-upgrade-modal')
                  "
                >
                  <div class="pl-2">
                    <div class="text-sm flex items-center gap-2">
                      Copy livestream URL

                      <IconWrapper
                        v-if="!canUseLivestreamLink"
                        name="i-bxs-award"
                        class="inline-flex w-6 h-6 text-xs text-[#FF8980]"
                      />
                    </div>
                    <div class="text-xs opacity-80">
                      Copy link for OBS, VMix or similar software
                    </div>
                  </div>
                </UButton>
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

// Check if user has Teams subscription for livestream URL feature
const { isTeamsPlan } = useSubscription()
const canUseLivestreamLink = computed(() => isTeamsPlan.value)

defineProps({
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
const isClipboardCopying = ref(false)
type CowButtonVariant = "primary" | "secondary" | "dark" | "danger"

const getCowButtonVariant = (variant?: string): CowButtonVariant => {
  return variant === "primary" ||
    variant === "secondary" ||
    variant === "dark" ||
    variant === "danger"
    ? variant
    : "dark"
}

const copyLivestreamURL = async () => {
  isClipboardCopying.value = true
  const origin = window.location.origin?.includes("localhost:30")
    ? window.location.origin
    : "https://app.cloudofworship.com"
  await navigator.clipboard.writeText(
    `${window.location.origin}/livestream/${currentState.value.activeSchedule?._id}`
  )
  useToast().add({
    title: "Livestream URL copied to clipboard",
    color: "green",
    icon: "i-bx-check-circle",
  })
  setTimeout(() => {
    isClipboardCopying.value = false
  }, 3000)
}
</script>

<style scoped></style>
