<template>
  <!-- Preview chrome for the output windows (live projection, stage display).
       Always dark, whatever the operator's colour mode: these windows sit on a
       black output surface and a light bar beside it reads as a bug. The whole
       thing is hidden the moment the window goes full screen, so nothing here
       ever reaches the projector. -->
  <div
    class="display-banner shrink-0"
    :class="
      floating
        ? 'pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center p-4'
        : 'flex h-[44px] items-center justify-center border-b border-white/[0.08] bg-[#0b0e17] px-6'
    "
  >
    <div
      class="banner-row flex min-w-0 max-w-full items-center gap-4 text-white"
      :class="floating ? 'banner-glass py-1.5 pl-5 pr-3' : ''"
    >
      <span class="flex shrink-0 items-center gap-2">
        <Logo class="w-[22px]" />
        <span class="hidden text-[13px] font-semibold leading-none sm:block">
          Cloud of Worship
        </span>
      </span>

      <span class="hidden h-4 w-px shrink-0 bg-white/15 sm:block" />

      <span
        class="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-500/20 px-2.5 py-[3px] text-[11px] font-semibold leading-none text-primary-300"
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="active ? 'animate-pulse bg-primary-400' : 'bg-white/30'"
        />
        {{ label }}
      </span>

      <p
        class="hidden min-w-0 items-center gap-2 text-[13px] leading-none text-white/55 md:flex"
      >
        <kbd
          v-if="shortcut"
          class="shrink-0 rounded-md border border-white/[0.12] bg-white/[0.12] px-1.5 py-[3px] text-[11px] font-semibold leading-none text-white/90"
        >
          {{ shortcut }}
        </kbd>
        <span class="truncate">{{ hint }}</span>
      </p>

      <button
        type="button"
        class="fullscreen-btn flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-[5px] text-[11px] font-semibold leading-none text-white transition-colors hover:bg-white/25"
        @click.stop="emit('fullscreen')"
      >
        <UIcon name="i-bx-fullscreen" class="h-3.5 w-3.5" dynamic />
        Full screen
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Logo from "~/components/svgs/Logo.vue"

withDefaults(
  defineProps<{
    /** Which output window this is — "Live Output", "Stage Display". */
    label: string
    /** What the operator should do next, shown beside the shortcut chip. */
    hint: string
    /** Key/gesture chip rendered before the hint. */
    shortcut?: string
    /** Pulses the status dot while something is actually being projected. */
    active?: boolean
    /**
     * Float over the output instead of taking a row above it. The live window
     * sizes its projection to the full viewport, so a banner in flow pushes the
     * bottom of the frame off screen.
     */
    floating?: boolean
  }>(),
  { shortcut: "Double click", active: false, floating: false }
)

const emit = defineEmits<{ fullscreen: [] }>()
</script>

<style scoped>
/* Frosted glass: the blur picks up whatever is being projected behind it, so
   the pill tints with the slide instead of sitting on it as a flat panel. The
   inset highlight is the top-edge catch-light that sells the material. */
.banner-glass {
  pointer-events: auto;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11),
    inset 0 0 0 1px rgba(255, 255, 255, 0.01),
    0 12px 40px -12px rgba(0, 0, 0, 0.4);
}

/* Backdrop blur is not universal (older WebKit in some projector browsers);
   without it the translucent fill turns the pill into a smear of the slide. */
@supports not (
  (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))
) {
  .banner-glass {
    background: rgba(11, 14, 23, 0.92);
  }
}
</style>
