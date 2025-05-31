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
