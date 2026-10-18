<template>
  <UAccordion
    :items="items"
    :ui="accordionUi"
    multiple
    v-bind="$attrs"
  >
    <!-- Header: the same raised card as CowToggle, so an accordion sitting
         beside a toggle in a form reads as one family. -->
    <template #default="{ item, open }">
      <button
        type="button"
        class="cow-accordion__header"
        :class="{ 'cow-accordion__header--open': open }"
      >
        <span class="min-w-0 flex-1 text-left">
          <span class="cow-accordion__label">{{ item.label }}</span>
          <span v-if="item.description" class="cow-accordion__description">
            {{ item.description }}
          </span>
        </span>
        <IconWrapper
          name="i-bx-chevron-down"
          size="5"
          class="cow-accordion__chevron shrink-0 transition-transform duration-200"
          :class="{ 'rotate-180': open }"
        />
      </button>
    </template>

    <!-- Each item's body is the caller's slot named after `item.slot`
         (default "item"), as with UAccordion itself. -->
    <template v-for="name in panelSlots" #[name]="slotProps" :key="name">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </UAccordion>
</template>

<script setup lang="ts">
// Thin wrapper around Nuxt UI's UAccordion (per the Cow* component
// convention): a raised card header with a label, an optional one-line
// summary and a chevron, and the panel opening inside the same card.
defineOptions({ inheritAttrs: false })

export interface CowAccordionItem {
  label: string
  // A one-line summary under the label, e.g. what is set inside.
  description?: string
  slot?: string
  defaultOpen?: boolean
  disabled?: boolean
}

const props = defineProps<{
  items: CowAccordionItem[]
}>()

const panelSlots = computed(() => [
  ...new Set(props.items.map((item) => item.slot || "item")),
])

const accordionUi = {
  wrapper: "w-full flex flex-col gap-3",
  container: "cow-accordion__item w-full flex flex-col",
  item: {
    base: "",
    size: "text-sm",
    color: "",
    padding: "px-4 pb-4 pt-1",
  },
}
</script>

<style scoped>
:deep(.cow-accordion__item) {
  border-radius: 1rem;
  background-color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1), 0 4px 0 0 #e2e8f0,
    0 10px 16px -10px rgba(15, 23, 42, 0.22);
}

.cow-accordion__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.cow-accordion__header:hover {
  background-color: #f8fafc;
}

.cow-accordion__header--open,
.cow-accordion__header--open:hover {
  background-color: transparent;
}

.cow-accordion__header:focus-visible {
  outline: 2px solid #0f172a;
  outline-offset: 3px;
}

.cow-accordion__label {
  display: block;
  color: #334155;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.35;
}

.cow-accordion__description {
  display: block;
  margin-top: 0.15rem;
  overflow: hidden;
  color: #64748b;
  font-size: 0.75rem;
  line-height: 1.1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cow-accordion__chevron {
  color: #94a3b8;
}
</style>

<style>
html.dark .cow-accordion__item {
  background-color: #1c2433;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.2), 0 4px 0 0 #0d1320,
    0 10px 16px -10px rgba(0, 0, 0, 0.6);
}

html.dark .cow-accordion__header:hover {
  background-color: #232c3d;
}

html.dark .cow-accordion__header--open,
html.dark .cow-accordion__header--open:hover {
  background-color: transparent;
}

html.dark .cow-accordion__header:focus-visible {
  outline-color: #f8fafc;
}

html.dark .cow-accordion__label {
  color: #f8fafc;
}

html.dark .cow-accordion__description {
  color: #9aa3b2;
}

html.dark .cow-accordion__chevron {
  color: #7d8695;
}
</style>
