<template>
  <div
    class="fs-loader fixed inset-0 bg-primary-950/60 grid place-items-center z-10"
  >
    <UProgress
      size="2xl"
      animation="carousel"
      :ui="{
        wrapper: 'w-40',
      }"
    />
  </div>
</template>
