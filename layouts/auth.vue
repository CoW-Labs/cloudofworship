<template>
  <div
    class="min-h-[100vh] w-[100%] bg-radial-gradient grid place-items-center"
  >
    <h2
      class="text-[6vw] text-center font-black stroke-current outlined-text w-[100%] text-transparent absolute bottom-[5%]"
    >
      Your church's power point.
    </h2>
    <div
      class="auth-box bg-white rounded-2xl shadow-xl p-[3rem] py-[5%] max-w-[450px] w-[100%] shadow-primary-200 relative"
    >
      <slot />
    </div>
  </div>
</template>

<script setup>
useHead({
  title: "Cloud of Worshippers",
})
</script>

<style scoped>
.bg-radial-gradient {
  background: radial-gradient(circle, #cd99ff, white, white);
}
.outlined-text {
  -webkit-text-stroke: 1px #a855f760;
}
</style>
