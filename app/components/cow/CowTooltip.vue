<template>
  <UTooltip
    v-bind="forwardedAttrs"
    :text="text"
    :shortcuts="keys"
    :prevent="prevent"
    :open-delay="openDelay"
    :close-delay="closeDelay"
    :popper="popperOptions"
    :class="['shrink-0', $attrs.class as any]"
    :ui="{ base: tooltipBase, container: 'z-50 group' }"
  >
    <slot />

    <template v-if="$slots.text" #text>
      <slot name="text" />
    </template>
  </UTooltip>
</template>

<script setup lang="ts">
/**
 * Tooltip with a keycap hint.
 *
 * Wraps `UTooltip` so every call site can pass a shortcut *id* from
 * `~/utils/shortcuts` (or a raw `Mod+B`-style combo) and get platform-correct
 * ⌘/Ctrl keycaps for free — see `useShortcutLabel`.
 *
 *   <CowTooltip text="Bold" shortcut="bold"><UButton …/></CowTooltip>
 *
 * Nuxt UI already hides tooltips on coarse pointers, so touch users are not
 * left with a stuck popover.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    text?: string
    /** A shortcut id from the registry, or a raw combo such as "Mod+Shift+D". */
    shortcut?: string
    placement?: string
    arrow?: boolean
    /** Suppress the tooltip entirely (e.g. while a popover is open). */
    prevent?: boolean
    openDelay?: number
    closeDelay?: number
  }>(),
  {
    text: "",
    shortcut: "",
    placement: "top",
    arrow: true,
    prevent: false,
    // Nuxt UI defaults both to 0, which makes a row of toolbar buttons strobe
    // as the pointer sweeps across them.
    openDelay: 400,
    closeDelay: 0,
  }
)

// Everything except `class` (bound separately above) is handed to UTooltip,
// which puts it on the element that actually wraps the trigger. Without this,
// attributes a parent sets on <CowTooltip> vanish — vuedraggable marks each
// item root with `data-draggable` and drives Sortable off that selector, so
// swallowing it silently disables drag-reordering of a wrapped list.
const attrs = useAttrs()
const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})

const keys = computed(() =>
  props.shortcut ? useShortcutLabel(props.shortcut) : []
)

const popperOptions = computed(() => ({
  placement: props.placement as any,
  strategy: "fixed" as const,
  arrow: props.arrow,
}))

// The Nuxt UI preset pins the bubble to `h-6` with `truncate`, which clips the
// longer, more explanatory labels we want here.
const tooltipBase =
  "[@media(pointer:coarse)]:hidden px-2 py-1 text-xs font-normal relative whitespace-nowrap"

// The preset's `z-20` container loses to hover-revealed editor panels — the
// chapter verse list under the verse switcher is `z-40` and expands over
// exactly the spot a bottom-placed tooltip lands in.
</script>
