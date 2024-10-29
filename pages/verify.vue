<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Verify your email address
        <span class="font-semibold">Cloud of Worship</span>
      </p>
    </div>
    <form class="flex flex-col gap-3 max-w-[325px] mx-auto" @submit="login()">
      <UFormGroup size="lg" class="relative">
        <UInput placeholder="Your email" v-model="email" disabled />
        <p
          class="text-sm flex justify-end gap-0 absolute top-0 right-2 z-10 pt-2"
        >
          <UButton size="xs" class="p-1 px-2" to="/?email_change=1"
            >Change email</UButton
          >
        </p>
      </UFormGroup>
      <UFormGroup size="lg">
        <UInput
          placeholder="Your verification code"
          type="text"
          class="w-[100%]"
          v-model="verificationCode"
        />
      </UFormGroup>

      <UButton
        block
        size="lg"
        class="mt-12"
        :disabled="!(useValidEmail(email) && verificationCode.length >= 6)"
        :loading="loading"
        @click="verifyEmail"
      >
        Verify email
      </UButton>
      <p class="text-sm flex items-center justify-center gap-0">
        I didn't receive any code
        <UButton
          size="sm"
          class="p-1"
          variant="link"
          to="#"
          :loading="resendLoading"
          :disabled="codeResentTimes >= 3"
          @click="resendCode"
          >Resend code</UButton
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
  resendCode()
})

const verifyEmail = async () => {
  loading.value = true
  const { data, error } = await useAPIFetch("/auth/verify-email", {
    method: "POST",
    body: {
      token: verificationCode.value,
    },
  })

  // If error occurred
  if (error.value) {
    toast.add({
      title: error.value?.data?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    toast.add({
      title: "Email successfully verified",
      color: "green",
      icon: "i-bx-check-circle",
    })
    useRouter().push("/")
  }
  loading.value = false
}

const resendCode = async () => {
  resendLoading.value = true
  const { data, error } = await useAPIFetch("/auth/send-verify-email", {
    method: "POST",
    body: {
      email: email.value,
    },
  })
  if (data.value) {
    toast.add({
      title: `Code sent to ${email.value}`,
      color: "green",
      icon: "i-bx-check-circle",
    })
  }
  toast.add({
    title: error.value?.data?.msg,
    color: "red",
    icon: "i-bx-error",
  })
  resendLoading.value = false
  codeResentTimes.value += 1
}

// If error occurred
</script>

<style scoped></style>
