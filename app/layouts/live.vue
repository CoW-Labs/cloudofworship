<template>
  <div>
    <slot />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: "Cloud of Worship - Live",
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
  script: [
    {
      // Ensure Tailwind and other styles are loaded
      type: "module",
      children: `
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', checkStyles);
        } else {
          checkStyles();
        }
        
        function checkStyles() {
          // Ensure styles are applied
          setTimeout(() => {
            const root = document.documentElement;
            if (!root.style.fontSize) {
              root.style.fontSize = '16px';
            }
          }, 100);
        }
      `,
    },
  ],
})
</script>

<style>
/* Ensure critical styles are inline */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

* {
  box-sizing: border-box;
}
</style>
