<template>
  <section
    class="stage-panel relative flex min-h-0 flex-col rounded-[28px] border-2"
    :class="toneClasses.border"
  >
    <header
      v-if="$slots.header"
      class="shrink-0 px-6 pt-5 sm:px-8 sm:pt-6"
      :class="toneClasses.text"
    >
      <slot name="header" />
    </header>

    <div
      class="min-h-0 flex-1 px-6 py-5 sm:px-8 sm:py-6"
      :class="[toneClasses.text, label ? 'pb-12 sm:pb-14' : '']"
    >
      <slot />
    </div>

    <!-- Corner tab, sitting flush in the bottom-right of the panel -->
    <span
      v-if="label"
      class="absolute bottom-0 right-0 rounded-br-[26px] rounded-tl-[22px] px-5 py-2 text-xs font-extrabold uppercase tracking-widest text-black sm:text-sm"
      :class="toneClasses.chip"
    >
      {{ label }}
    </span>
  </section>
</template>

<script setup lang="ts">
type StageTone = "now" | "next" | "muted"

const props = withDefaults(
  defineProps<{
    /** Corner tab text. Omit for a panel with no tab. */
    label?: string
    tone?: StageTone
  }>(),
  { tone: "muted" }
)

const TONES: Record<StageTone, { border: string; text: string; chip: string }> =
  {
    now: {
      border: "border-white",
      text: "text-white",
      chip: "bg-white",
    },
    next: {
      border: "border-purple-300",
      text: "text-purple-300",
      chip: "bg-purple-300",
    },
    muted: {
      border: "border-white/80",
      text: "text-white",
      chip: "bg-white",
    },
  }

const toneClasses = computed(() => TONES[props.tone] || TONES.muted)
</script>
