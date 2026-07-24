<template>
  <div ref="triggerRef" class="inline-flex">
    <UButton
      size="xs"
      variant="ghost"
      color="gray"
      :class="['p-1', triggerClass]"
      @click.stop="toggle"
    >
      <MoreIcon
        :class="['w-5 h-5', iconClass || 'text-gray-500 dark:text-[#9aa3b2]']"
      />
    </UButton>

    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-50"
        :class="{ 'pointer-events-none': suppressed }"
        @click="close"
        @contextmenu.prevent="close"
      />
      <Transition name="more-modal">
        <div
          v-if="open"
          ref="panelRef"
          class="more-modal fixed z-50 flex flex-col shadow-lg"
          :class="[
            flipped ? 'more-modal--up' : 'more-modal--down',
            { 'opacity-0 pointer-events-none': suppressed },
            flush
              ? 'more-modal--flush min-w-[158px] rounded-xl overflow-hidden bg-white dark:bg-[#131724] ring-1 ring-gray-100 dark:ring-[#0d0f1a]'
              : 'p-2 gap-1 min-w-[120px] rounded-lg bg-white dark:bg-[#222938]',
          ]"
          :style="panelStyle"
        >
          <slot :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import MoreIcon from "~/components/svgs/MoreIcon.vue"

defineProps<{
  // Full-bleed rows separated by dividers, instead of padded, spaced buttons
  flush?: boolean
  triggerClass?: string
  iconClass?: string
}>()

const emit = defineEmits(["update:open"])

const open = ref(false)
const flipped = ref(false)
// A row can open a modal (ConfirmDialog) that renders *under* this teleported
// menu when the menu itself lives inside a modal — stand down while it's open.
const suppressed = ref(false)
provide("more-actions-menu", {
  suppress: (value: boolean) => (suppressed.value = value),
})
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const openMenu = async () => {
  const rect = triggerRef.value?.getBoundingClientRect()
  // Anchored by its right edge so `transform` stays free for the open animation
  if (rect) {
    flipped.value = false
    panelStyle.value = {
      top: `${rect.bottom + 4}px`,
      right: `${window.innerWidth - rect.right}px`,
    }
  }
  open.value = true
  emit("update:open", true)

  // Flip above the trigger when the panel would run past the viewport bottom
  await nextTick()
  const panelHeight = panelRef.value?.offsetHeight
  if (rect && panelHeight && rect.bottom + 4 + panelHeight > window.innerHeight - 8) {
    flipped.value = true
    panelStyle.value = {
      top: `${Math.max(8, rect.top - 4 - panelHeight)}px`,
      right: `${window.innerWidth - rect.right}px`,
    }
  }
}

const close = () => {
  open.value = false
  emit("update:open", false)
}

const toggle = () => {
  open.value ? close() : openMenu()
}

// Close instead of tracking scroll offsets — avoids the menu drifting out of
// sync with its trigger when the (often virtualized) list underneath it scrolls.
const handleScroll = () => {
  if (open.value) close()
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll, true)
})

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll, true)
})

defineExpose({ close })
</script>

<!-- Not scoped: the panel is teleported and its rows come from the parent's slot -->
<style>
/* Expand out of the corner nearest the trigger */
.more-modal--down {
  transform-origin: top right;
}

.more-modal--up {
  transform-origin: bottom right;
}

.more-modal-enter-active {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: transform, opacity;
}

.more-modal-leave-active {
  transition: transform 0.16s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.14s cubic-bezier(0.4, 0, 1, 1);
  will-change: transform, opacity;
}

.more-modal-enter-from,
.more-modal-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.more-modal-enter-to,
.more-modal-leave-from {
  opacity: 1;
  transform: scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .more-modal-enter-active,
  .more-modal-leave-active {
    transition: opacity 0.1s linear;
  }

  .more-modal-enter-from,
  .more-modal-leave-to {
    transform: none;
  }
}

.more-modal--flush > * {
  width: 100%;
}

.more-modal--flush > * + * {
  border-top: 1px solid rgb(243 244 246);
}

html.dark .more-modal--flush > * + * {
  border-top-color: #0d0f1a;
}

/* Uniform rows, whether the item is a bare button or one wrapped by ConfirmDialog */
.more-modal--flush > button,
.more-modal--flush > * > button {
  width: 100%;
  height: 2.25rem;
  justify-content: flex-start;
  padding: 0 1rem;
  border-radius: 0;
  font-size: 0.75rem;
  font-weight: 400;
  color: #4b5563;
}

html.dark .more-modal--flush > button,
html.dark .more-modal--flush > * > button {
  color: #9ba3b2;
}

.more-modal--flush > button:hover,
.more-modal--flush > * > button:hover {
  background-color: #f3f4f6;
}

html.dark .more-modal--flush > button:hover,
html.dark .more-modal--flush > * > button:hover {
  background-color: #2b3140;
}

.more-modal--flush > button:disabled,
.more-modal--flush > * > button:disabled {
  opacity: 0.5;
}

.more-modal--flush > button:disabled:hover,
.more-modal--flush > * > button:disabled:hover {
  background-color: transparent;
}

/* Destructive rows keep their red text (beats the row rule on specificity) */
.more-modal--flush .more-item-danger,
html.dark .more-modal--flush .more-item-danger {
  color: #ef4444;
}
</style>
