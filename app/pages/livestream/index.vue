<template>
  <ScheduleCodeEntry destination="livestream" />
</template>

<script setup lang="ts">
// The public livestream is addressed by schedule code. Opened without one, ask
// for it, the same way the password flow asks for an email.
definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Livestream - Cloud of Worship",
  meta: [{ name: "robots", content: "noindex" }],
})
</script>
