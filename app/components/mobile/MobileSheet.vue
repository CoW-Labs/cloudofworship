<template>
  <Teleport to="body">
    <Transition name="fade-sm">
      <div
        v-if="modelValue"
        class="mobile-sheet fixed inset-0 z-40 flex flex-col bg-gray-100 dark:bg-[#111722]"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <!-- HEADER — mirrors AppSection's heading row (same type scale and
             muted colour) so a sheet reads as the same kind of surface as the
             panels it replaces on desktop. -->
        <header
          class="sheet-header flex items-center gap-2 shrink-0 px-4 pb-3 border-b border-white/80 dark:border-[#202838] bg-white dark:bg-[#171d2b]"
          :style="{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }"
        >
          <button
            type="button"
            class="close-btn -ml-2 p-2 rounded-lg text-gray-700 dark:text-[#a7afbd] hover:bg-gray-100 dark:hover:bg-[#222938] transition-colors"
            aria-label="Close"
            @click="close"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
          <h2
            class="font-medium text-sm text-gray-700 dark:text-[#a7afbd] truncate min-w-0 flex-1"
          >
            {{ title }}
          </h2>
          <slot name="header-actions" />
        </header>

        <!-- BODY — owns no padding of its own. The panels dropped in here
             (QuickActions, SchedulesList) already carry an AppSection with its
             own chrome, and double padding would inset them twice. -->
        <div class="sheet-body flex-1 min-h-0 overflow-hidden p-2">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { escapePriority } from "~/composables/useEscapeKey"

const props = defineProps<{
  modelValue: boolean
  title: string
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void
}>()

const close = () => emit("update:modelValue", false)

// Registered once for the life of the component rather than on open, so the
// sheet never has to be re-created to re-enter the stack. Returning false while
// closed lets the press fall through to whatever is underneath, which is the
// contract the shared stack expects.
useEscapeKey(
  () => {
    if (!props.modelValue) return false
    close()
    return true
  },
  { priority: escapePriority.modal }
)

// A sheet covers the whole viewport, so the page behind it must not scroll with
// it — on iOS that shows up as the sheet's own scroll "handing off" to the page
// and dragging the address bar around mid-list.
watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === "undefined") return
    document.body.style.overflow = open ? "hidden" : ""
  }
)

onUnmounted(() => {
  if (typeof document !== "undefined") document.body.style.overflow = ""
})
</script>
