<template>
  <div class="stage-layout bg-black">
    <slot />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: "Cloud of Worship - Stage Display",
  link: [
    {
      rel: "stylesheet",
      href: "/css/fonts.css",
    },
    {
      rel: "stylesheet",
      href: "/css/main.css",
    },
  ],
})
</script>

<style>
/* The stage screen is its own output surface — never light mode, never scrolled. */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: #000000;
}

* {
  box-sizing: border-box;
}
</style>
