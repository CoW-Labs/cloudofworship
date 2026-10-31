<template>
  <!-- The intro animations' Live Output: a labelled 16:9 screen with the LIVE
       pill. The default slot is what is on air; size text in cqw. -->
  <div class="flex min-w-0 flex-col gap-2">
    <p class="text-[10px] font-medium leading-none text-gray-500 dark:text-[#9aa3b2]">
      Live Output
    </p>
    <div
      class="relative w-full overflow-hidden rounded-lg bg-black"
      style="aspect-ratio: 16 / 9; container-type: inline-size"
    >
      <slot />
      <span class="intro-live-pill"><span class="intro-live-pill__dot" />LIVE</span>
    </div>
  </div>
</template>

<style scoped>
.intro-live-pill {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #f04438;
  background: rgb(255 255 255 / 0.12);
  border: 1px solid rgb(255 255 255 / 0.18);
  backdrop-filter: blur(8px);
}
.intro-live-pill__dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: currentColor;
}
</style>
