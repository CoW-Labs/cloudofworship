<template>
  <section
    class="flex-1 rounded-xl border border-primary-100 dark:border-primary-900 h-[100vh] max-h-[calc(100vh-80px)] overflow-hidden"
  >
    <div
      class="heading p-2 px-3 bg-primary-100 dark:bg-primary-900 border dark:border-none rounded-t-lg"
    >
      <h2
        class="font-medium text-sm flex items-center top-0 bottom-[auto]"
        :class="[secondaryButtons ? 'justify-between' : '', headingStyles]"
      >
        <template v-if="subHeading">
          <UTooltip text="Go back">
            <UButton
              variant="ghost"
              class="p-1 px-2 text-black"
              @click="$emit('header-click')"
              >{{ heading }}</UButton
            >
          </UTooltip>
          <IconWrapper name="i-bx-chevron-right" class="text-primary" />
          <span
            class="pl-2 text-gray-600 dark:text-primary-200 font-normal capitalize"
            >{{ subHeading }}</span
          >
        </template>
        <span v-else class="p-1 px-2 whitespace-nowrap truncate">
          {{ heading }}
        </span>
        <div class="actions flex flex-row-reverse items-center gap-1">
          <div class="action-inner" v-for="secondaryButton in secondaryButtons">
            <ConfirmDialog
              v-if="secondaryButton.visible && secondaryButton.confirmAction"
              :button-label="secondaryButton.label"
              :button-icon="secondaryButton.icon"
              :button-color="secondaryButton.color"
              button-size="md"
              header="Delete selected slides"
              button-styles="p-1 px-2"
              label="Are you sure you want to delete all of the selected slides? This action is irreversible."
              @confirm="$emit(secondaryButton.action, slide?.id)"
            >
            </ConfirmDialog>
            <UPopover
              v-if="secondaryButton.visible && !secondaryButton.confirmAction"
              mode="click"
              v-model:open="secondaryActionPopoverOpen"
              :ui="{
                ring: 'ring-1',
                background: 'bg-white dark-bg-gray-900 border-0 mr-5',
              }"
            >
              <UButton
                class="p-1 px-2 whitespace-nowrap"
                size="md"
                :variant="secondaryButton?.variant || 'ghost'"
                :color="secondaryButton.color"
                :icon="secondaryButton.icon"
                :target="secondaryButton.action === 'go-live' ? false : false"
                :to="secondaryButton.action === 'go-live' ? '#' : '#'"
                @click="
                  secondaryButton.action !== appWideActions.goLive
                    ? useGlobalEmit(secondaryButton.action)
                    : (secondaryActionPopoverOpen = true)
                "
                >{{
                  isLiveWindowActive &&
                  secondaryButton.action === appWideActions.goLive
                    ? "You are live"
                    : secondaryButton.label
                }}</UButton
              >
              <template #panel>
                <div class="actions max-w-[270px]">
                  <UButton
                    class="text-left p-3 px-4 hover:bg-primary-100 dark:hover:bg-primary-900"
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
                  <div class="line border-b dark:border-gray-800"></div>
                  <UButton
                    class="text-left p-3 px-4 hover:bg-primary-100 dark:hover:bg-primary-900"
                    color="black"
                    variant="ghost"
                    :icon="
                      isClipboardCopying
                        ? 'i-bx-check-circle'
                        : 'i-bx-clipboard'
                    "
                    size="sm"
                    @click="copyLivestreamURL"
                  >
                    <div class="pl-2">
                      <div class="text-sm">Copy livestream URL</div>
                      <div class="text-xs opacity-80">
                        Copy link for OBS, VMix or similar software
                      </div>
                    </div>
                  </UButton>
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </h2>
    </div>
    <div :class="`slot-ctn p-3 text-sm ${slotCtnStyles || ''}`">
      <slot></slot>
    </div>
  </section>
</template>

<script setup>
import { useAppStore } from "@/store/app"
import { appWideActions } from "~/utils/constants"
const props = defineProps({
  heading: String,
  subHeading: String,
  slotCtnStyles: String,
  headingStyles: String,
  secondaryButtons: Array,
  isLiveWindowActive: Boolean,
})
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
const secondaryActionPopoverOpen = ref(false)
const isClipboardCopying = ref(false)

const copyLivestreamURL = async () => {
  isClipboardCopying.value = true
  await navigator.clipboard.writeText(
    `${window.location.origin}/livestream/${currentState.value.activeSchedule._id}`
  )
  useToast().add({
    title: "Livestream URL copied to clipboard",
    color: "success",
    icon: "i-bx-check-circle",
  })
  setTimeout(() => {
    isClipboardCopying.value = false
  }, 3000)
}
</script>

<style scoped></style>
