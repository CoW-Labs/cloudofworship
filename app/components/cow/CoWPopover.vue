<template>
  <div ref="rootRef" class="inline-flex shrink-0">
    <div ref="triggerRef" class="inline-flex" @click="toggle">
      <slot :open="open" :close="close" />
    </div>

    <Teleport v-if="resolvedBoundary" to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="translate-y-1 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-1 opacity-0"
      >
        <div
          v-if="open"
          ref="panelRef"
          class="cow-popover-panel fixed z-[60] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200 focus:outline-none dark:bg-[#1a212e] dark:ring-[#30394a]"
          :class="panelClass"
          :style="panelStyle"
          @click.stop
        >
          <slot name="panel" :open="open" :close="close" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from "vue"
import { escapePriority } from "~/composables/useEscapeKey"

const props = withDefaults(
  defineProps<{
    open?: boolean
    boundary?: HTMLElement | null
    maxWidth?: number
    maxHeight?: number
    offset?: number
    boundaryPadding?: number
    boundaryOverflow?: number
    panelClass?: string
  }>(),
  {
    open: false,
    boundary: null,
    maxWidth: 1100,
    maxHeight: 620,
    offset: 8,
    boundaryPadding: 8,
    boundaryOverflow: 0,
    panelClass: "",
  }
)

const emit = defineEmits<{
  (e: "update:open", open: boolean): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const resolvedBoundary = shallowRef<HTMLElement | null>(null)
const panelStyle = ref<CSSProperties>({ visibility: "hidden" })

let boundaryObserver: ResizeObserver | undefined

const resolveBoundary = () =>
  props.boundary ||
  rootRef.value?.closest<HTMLElement>("[data-cow-popover-boundary]") ||
  null

const getBoundary = () => resolvedBoundary.value || resolveBoundary()

const updatePosition = () => {
  if (!props.open || !triggerRef.value) return

  const boundary = getBoundary()
  if (!boundary) return

  const boundaryRect = boundary.getBoundingClientRect()
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const minimumLeft = Math.max(
    props.boundaryPadding,
    boundaryRect.left - props.boundaryOverflow
  )
  const maximumRight = Math.min(
    viewportWidth - props.boundaryPadding,
    boundaryRect.right + props.boundaryOverflow
  )
  const availableWidth = Math.max(0, maximumRight - minimumLeft)
  const width = Math.min(props.maxWidth, availableWidth)
  const top = Math.max(
    boundaryRect.top + props.boundaryPadding,
    triggerRect.bottom + props.offset
  )
  const maximumBottom = Math.min(
    viewportHeight - props.boundaryPadding,
    boundaryRect.bottom + props.boundaryOverflow
  )
  const availableHeight = Math.max(0, maximumBottom - top)
  const height = Math.min(props.maxHeight, availableHeight)
  const preferredLeft = triggerRect.left + triggerRect.width / 2 - width / 2
  const maximumLeft = Math.max(minimumLeft, maximumRight - width)
  const left = Math.min(Math.max(preferredLeft, minimumLeft), maximumLeft)

  panelStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
    visibility: "visible",
  }
}

const observeBoundary = () => {
  boundaryObserver?.disconnect()

  const boundary = getBoundary()
  if (boundary && typeof ResizeObserver !== "undefined") {
    boundaryObserver = new ResizeObserver(updatePosition)
    boundaryObserver.observe(boundary)
  }
}

const close = () => emit("update:open", false)
const toggle = () => emit("update:open", !props.open)

const onPointerDown = (event: PointerEvent) => {
  if (
    props.open &&
    event.target instanceof Node &&
    !rootRef.value?.contains(event.target) &&
    !panelRef.value?.contains(event.target)
  ) {
    close()
  }
}

// Escape closes the popover before it reaches anything underneath it.
useEscapeKey(
  () => {
    if (!props.open) return false
    close()
    return true
  },
  { priority: escapePriority.popover }
)

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      boundaryObserver?.disconnect()
      return
    }

    panelStyle.value = { visibility: "hidden" }
    await nextTick()
    updatePosition()
    observeBoundary()
  }
)

watch(
  () => props.boundary,
  async () => {
    resolvedBoundary.value = resolveBoundary()
    if (!props.open) return
    await nextTick()
    updatePosition()
    observeBoundary()
  }
)

watch(
  () => [props.maxWidth, props.maxHeight, props.boundaryOverflow],
  async () => {
    if (!props.open) return
    await nextTick()
    updatePosition()
  }
)

onMounted(() => {
  resolvedBoundary.value = resolveBoundary()
  document.addEventListener("pointerdown", onPointerDown)
  window.addEventListener("resize", updatePosition)
  window.addEventListener("scroll", updatePosition, true)
})

onBeforeUnmount(() => {
  boundaryObserver?.disconnect()
  document.removeEventListener("pointerdown", onPointerDown)
  window.removeEventListener("resize", updatePosition)
  window.removeEventListener("scroll", updatePosition, true)
})
</script>

<style scoped>
.cow-popover-panel {
  contain: layout paint;
  will-change: left, width, height;
  transform-origin: top center;
  transition:
    width 280ms cubic-bezier(0.22, 1, 0.36, 1),
    height 280ms cubic-bezier(0.22, 1, 0.36, 1),
    left 280ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .cow-popover-panel {
    transition-duration: 1ms;
  }
}
</style>
