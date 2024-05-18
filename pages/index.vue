<template>
  <div class="flex mt-4 gap-2 px-4">
    <QuickActions />
    <PreviewContent />
    <LiveOutput />
  </div>
</template>
<script setup>
definePageMeta({
  layout: "app",
})
useHead({
  link: [
    {
      rel: "manifest",
      href: "/live-manifest.json",
    },
  ],
})
</script>

<style scoped></style>
