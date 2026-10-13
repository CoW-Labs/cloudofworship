<template>
  <ScheduleCodeEntry destination="stagestream" />
</template>

<script setup lang="ts">
// The public stage display is addressed by schedule code. Opened without one,
// ask for it, the same way the password flow asks for an email.
definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Stage Display - Cloud of Worship",
  meta: [{ name: "robots", content: "noindex" }],
})
</script>
