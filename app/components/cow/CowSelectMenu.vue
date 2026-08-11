<template>
  <USelectMenu
    v-bind="$attrs"
    :ui="mergedUi"
    :ui-menu="mergedUiMenu"
  >
    <!-- Forward every consumer-provided slot untouched (label, leading, etc.).
         `option` is handled separately below so we can layer on a default. -->
    <template
      v-for="name in passthroughSlots"
      #[name]="slotProps"
      :key="name"
    >
      <slot :name="name" v-bind="slotProps || {}" />
    </template>

    <!-- Default option rendering: label text only. Nuxt UI already renders its
         own selected checkmark (absolutely positioned, see uiMenu.option.selectedIcon
         below) — adding a second one here would show two checkmarks on the
         selected row. Consumers that pass their own #option slot fully override this. -->
    <template #option="{ option, active, selected }">
      <slot name="option" :option="option" :active="active" :selected="selected">
        <span class="truncate">{{ optionText(option) }}</span>
      </slot>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
// Thin wrapper around Nuxt UI's USelectMenu (per the Cow* component
// convention). It ships a neutral, non-purple dropdown panel used app-wide,
// while remaining fully transparent: all props, events and slots pass through
// to the underlying USelectMenu, and consumer-supplied `ui` / `ui-menu` are
// merged over the defaults so per-instance tweaks (widths, text sizes) survive.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  ui?: Record<string, any>
  uiMenu?: Record<string, any>
  // Attribute to read the display label from when options are objects.
  optionAttribute?: string
}>()

const slots = useSlots()
const passthroughSlots = computed(() =>
  Object.keys(slots).filter((name) => name !== "option")
)

const optionText = (option: any): string => {
  if (option == null) return ""
  if (typeof option === "object") {
    return option[props.optionAttribute || "label"] ?? option.name ?? ""
  }
  return String(option)
}

// Trigger styling is left to the consumer (each select keeps its own
// select-class / pill colour); we don't force anything here.
const defaultUi: Record<string, any> = {}

// The dropdown panel — neutral surface, no purple tint, rounded to match the
// app's large-popover radius.
const defaultUiMenu: Record<string, any> = {
  width: "min-w-[240px]",
  background: "bg-white dark:bg-[#1a2130]",
  rounded: "rounded-xl",
  ring: "ring-1 ring-gray-200 dark:ring-white/10",
  shadow: "shadow-xl",
  padding: "p-1.5",
  // Search input bleeds edge-to-edge over the panel's own p-1.5 padding (the
  // negative margins cancel it out), sharing the panel's background so only
  // the bottom border reads as a divider — no separate box/pill around it.
  // The leading search glyph is painted via the global CSS below (Nuxt UI's
  // SelectMenu has no slot for this input, so a real <SearchIcon> can't be
  // placed inline) — its stroke matches the SearchIcon.vue asset exactly.
  // No text-size utility here on purpose — see mergedUiMenu, which appends
  // the consumer's own size override (or text-sm) instead of replacing this
  // whole string, so callers can keep their existing text scale.
  input:
    "cow-select-search-input sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 block w-[calc(100%+0.75rem)] bg-white dark:bg-[#1a2130] text-gray-700 dark:text-white placeholder-gray-400 dark:placeholder-[#7d8695] border-0 border-b border-gray-200 dark:border-white/10 focus:ring-0 focus:outline-none pl-9 pr-3 py-2.5",
  empty: "text-sm text-gray-400 dark:text-[#7d8695]",
  option: {
    rounded: "rounded-lg",
    padding: "px-3 py-2.5",
    size: "text-sm",
    color: "text-gray-700 dark:text-white",
    active: "bg-gray-100 dark:bg-[#2b3344]",
    // "pe-7" preserves the padding Nuxt UI's own default reserves so option
    // text doesn't run under its absolutely-positioned selected checkmark.
    selected: "pe-7 bg-gray-100 dark:bg-[#2b3344]",
  },
}

const mergedUi = computed(() => ({ ...defaultUi, ...(props.ui || {}) }))

const mergedUiMenu = computed(() => {
  const { input: inputOverride, option: optionOverride, ...restOverrides } =
    props.uiMenu || {}
  return {
    ...defaultUiMenu,
    ...restOverrides,
    // Append rather than replace: callers only ever override this to set a
    // text scale (e.g. "text-xs"), and a full replacement would silently
    // drop the search bar's background/divider/icon styling above.
    input: inputOverride
      ? `${defaultUiMenu.input} ${inputOverride}`
      : `${defaultUiMenu.input} text-sm`,
    option: { ...defaultUiMenu.option, ...(optionOverride || {}) },
  }
})
</script>

<style>
/* Deliberately global (not scoped): the search input lives deep inside
   USelectMenu's own template (HComboboxInput, several component boundaries
   down), and mixing :deep() with :global() for the dark-mode variant isn't
   reliably supported by Vue's scoped-CSS compiler. The class name is unique
   to this component so a plain global rule is safe.
   Same path data as app/components/svgs/SearchIcon.vue, painted as a
   background-image since Nuxt UI's SelectMenu doesn't expose a slot for the
   built-in search input to place a real <SearchIcon> component inside it. */
.cow-select-search-input {
  background-repeat: no-repeat;
  background-position: 14px center;
  background-size: 15px 15px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none'%3E%3Cpath d='M14.5 25C20.299 25 25 20.299 25 14.5C25 8.70101 20.299 4 14.5 4C8.70101 4 4 8.70101 4 14.5C4 20.299 8.70101 25 14.5 25Z' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M21.925 21.925L28 28' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
html.dark .cow-select-search-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' fill='none'%3E%3Cpath d='M14.5 25C20.299 25 25 20.299 25 14.5C25 8.70101 20.299 4 14.5 4C8.70101 4 4 8.70101 4 14.5C4 20.299 8.70101 25 14.5 25Z' stroke='%237d8695' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M21.925 21.925L28 28' stroke='%237d8695' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
}
</style>
