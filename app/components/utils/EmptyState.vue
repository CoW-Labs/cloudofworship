<template>
  <div
    class="cow-inset-panel min-h-60 h-full w-full flex-1 min-h-0 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 dark:border-[#3a4456] bg-gray-50 dark:bg-[#222938] text-gray-500"
  >
    <div
      class="w-[118px] h-[74px] grid place-items-center rounded-xl border border-dashed border-gray-400/80 dark:border-[#586277]"
    >
      <NoSlidesIcon
        v-if="svgIcon === 'NoSlidesIcon'"
        class="w-7 h-7 text-gray-500 dark:text-[#8f98aa]"
      />
      <IconWrapper v-else :name="icon" size="7" />
    </div>
    <div>
      <h2
        class="text-sm font-medium max-w-[220px] text-center mx-auto text-gray-400 dark:text-[#9aa3b2]"
        :class="{ 'max-w-[200px]': isWider }"
      >
        {{ sub }}
      </h2>
      <p
        v-if="desc"
        class="text-xs max-w-[150px] text-center mt-1 mx-auto"
        :class="{ 'max-w-[220px]': isWider }"
      >
        {{ desc }}
      </p>
    </div>

    <CowButton
      v-if="action"
      variant="primary"
      size="sm"
      class="!px-5"
      @click="useGlobalEmit(action)"
    >
      {{ actionText }}
    </CowButton>
  </div>
</template>

<script setup lang="ts">
import NoSlidesIcon from "~/components/svgs/NoSlidesIcon.vue"

defineProps<{
  icon: string
  sub: string
  actionText?: string
  action?: string
  desc?: string
  isWider?: boolean
  // Optional custom SVG icon. Currently supports "NoSlidesIcon" — when set it
  // replaces the iconify icon with the new line-style monitor icon.
  svgIcon?: string
}>()
</script>

<style scoped>
.cow-inset-panel {
  position: relative;
}
.cow-inset-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: radial-gradient(
    rgba(15, 23, 42, 0.07) 1px,
    transparent 1px
  );
  background-size: 18px 18px;
  pointer-events: none;
}
html.dark .cow-inset-panel::before {
  background-image: radial-gradient(
    rgba(154, 163, 178, 0.08) 1px,
    transparent 1px
  );
}
.cow-inset-panel > * {
  position: relative;
}
</style>
