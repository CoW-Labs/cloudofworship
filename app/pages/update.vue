<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-0">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Update
        <span class="font-semibold">Cloud of Worship</span>
      </p>
    </div>
    <form class="flex flex-col gap-3 max-w-[250px] mx-auto">
      <UButton
        block
        size="lg"
        class="mt-12"
        :loading="loading"
        @click="updateApp"
      >
        Update Cloud of Worship
      </UButton>
      <p class="text-sm flex items-center justify-center gap-0">
        I want to go back
        <UButton size="sm" class="p-1" variant="link" to="/">Go Home</UButton>
      </p>
    </form>
  </div>
</template>
<script setup lang="ts">
const { $pwa } = useNuxtApp()

definePageMeta({
  layout: "auth",
})

useHead({
  title: "Update Available - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "A new version of Cloud of Worship is available. Update now to get the latest features, improvements, and bug fixes for your church presentation software.",
    },
    {
      name: "keywords",
      content:
        "Cloud of Worship update, software update, app update, church software update, PWA update, presentation software update",
    },
    { property: "og:title", content: "Update Available - Cloud of Worship" },
    {
      property: "og:description",
      content:
        "A new version of Cloud of Worship is available. Update now to get the latest features and improvements.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Update Available - Cloud of Worship",
    },
    {
      name: "twitter:description",
      content:
        "Update Cloud of Worship to get the latest features and improvements for your church.",
    },
  ],
})

const loading = ref(false)

onMounted(() => {
  updateApp()
})

const updateApp = () => {
  loading.value = true
  $pwa?.updateServiceWorker()

  setTimeout(() => {
    loading.value = false
    window.location.href = "/"
  }, 5000)
}

// If error occurred
</script>

<style scoped></style>
