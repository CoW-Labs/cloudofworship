<template>
  <div class="w-full flex flex-col items-center text-center">
    <Logo class="w-20 h-20 mb-8" />
    <h1
      class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
    >
      Signing out
    </h1>
    <p
      class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"
    >
      Ending your Cloud of Worship session.
    </p>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"

definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Signing out - Cloud of Worship",
})

onMounted(() => {
  const authStore = useAuthStore()
  authStore.signOut()
})
</script>
