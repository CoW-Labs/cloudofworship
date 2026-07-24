<template>
  <CowSelectMenu
    class="settings-select border-0 shadow-none"
    :class="width"
    :select-class="`${width} settings-select__trigger`"
    size="md"
    variant="none"
    color="primary"
    clear-search-on-close
    :options="options"
    :model-value="modelValue"
    :ui="{ rounded: 'rounded-xl' }"
    :ui-menu="{ width }"
    v-bind="$attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </CowSelectMenu>
</template>

<script setup lang="ts">
// The one dropdown shape used by every settings panel: a fixed-width, pill-ish
// trigger on the right of a SettingsRow. Everything else (searchable,
// option-attribute, disabled, @change) passes straight through to
// CowSelectMenu via $attrs, so consumers keep the USelectMenu API.
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    options?: any[]
    modelValue?: any
    width?: string
  }>(),
  {
    options: () => [],
    width: "w-[220px]",
  }
)
</script>

<style>
/* Global on purpose: the class lands on USelectMenu's own trigger button,
   several component boundaries below this one, where scoped CSS can't reach.
   The name is unique to this component so a plain global rule is safe. */
.settings-select__trigger {
  border-radius: 0.75rem !important;
  background-color: #f1f5f9 !important;
  box-shadow: none !important;
  color: #0f172a !important;
  font-size: 0.85rem;
  transition: background-color 0.15s ease;
}

.settings-select__trigger:hover {
  background-color: #e7ebf1 !important;
}

.settings-select__trigger:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

html.dark .settings-select__trigger {
  background-color: #222938 !important;
  color: #f8fafc !important;
}

html.dark .settings-select__trigger:hover {
  background-color: #2b3344 !important;
}
</style>
