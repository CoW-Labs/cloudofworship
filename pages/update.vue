<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-0">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Update
        <span class="font-semibold">Cloud of Worship</span>
      </p>
    </div>
    <form class="flex flex-col gap-3 max-w-[250px] mx-auto" @submit="login()">
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
        <UButton
          size="sm"
          class="p-1"
          variant="link"
          to="/"
          :loading="resendLoading"
          :disabled="codeResentTimes >= 3"
          @click="resendCode"
          >Go Home</UButton
        >
      </p>
    </form>
  </div>
</template>
<script setup>
import { useAuthStore } from "~/store/auth"

definePageMeta({
  layout: "auth",
})

const authStore = useAuthStore()
const runtimeConfig = useRuntimeConfig()
const isDevEnvironment = runtimeConfig.public.BASE_URL?.includes("localhost")
const googleSignIn = inject("handleGoogleSignIn")
// console.log(runtimeConfig.public.BASE_URL, isDevEnvironment)

const toast = useToast()
const email = ref(authStore.user?.email)
const verificationCode = ref("")
const loading = ref(false)
const resendLoading = ref(false)
const codeResentTimes = ref(0)

onMounted(() => {
  updateApp()
})

const updateApp = () => {
  loading.value = true
  useNuxtApp().$pwa.updateServiceWorker()

  setTimeout(() => {
    loading.value = false
    window.location = "/"
  }, 5000)
}

// If error occurred
</script>

<style scoped></style>
