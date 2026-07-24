<template>
  <div
    class="settings-row"
    :class="[
      { 'settings-row--stacked': stacked },
      { 'settings-row--disabled': disabled },
    ]"
  >
    <div class="settings-row__text">
      <p class="settings-row__label">
        {{ label }}
        <slot name="badge" />
      </p>
      <p v-if="description" class="settings-row__description">
        {{ description }}
      </p>
    </div>

    <div class="settings-row__control">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// One setting = one card. Chrome matches CowInput/CowTextarea at rest (1rem
// radius, inset hairline ring) so a stack of rows reads as the same family as
// the Cow form fields used elsewhere in the app.
withDefaults(
  defineProps<{
    label: string
    description?: string
    // Puts the control on its own full-width line below the label — for
    // sliders and anything else that needs the horizontal space.
    stacked?: boolean
    disabled?: boolean
  }>(),
  {
    stacked: false,
    disabled: false,
  }
)
</script>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  border-radius: 1rem;
  padding: 0.85rem 1rem;
  background-color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.07);
  transition: box-shadow 0.2s ease, background-color 0.2s ease;
}

.settings-row--stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
}

.settings-row--disabled {
  opacity: 0.6;
}

.settings-row__text {
  min-width: 0;
}

.settings-row__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #334155;
  font-size: 0.92rem;
  font-weight: 650;
  line-height: 1.35;
}

.settings-row__description {
  margin-top: 0.25rem;
  color: #64748b;
  font-size: 0.75rem;
  line-height: 1.5;
}

.settings-row__control {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

.settings-row--stacked .settings-row__control {
  justify-content: stretch;
  flex-shrink: 1;
}
</style>

<style>
html.dark .settings-row {
  background-color: #131a27;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.07);
}

html.dark .settings-row__label {
  color: #f8fafc;
}

html.dark .settings-row__description {
  color: #9aa3b2;
}
</style>
