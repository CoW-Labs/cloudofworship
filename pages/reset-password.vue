<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Reset your password for
        <span class="font-semibold">Cloud of Worship</span>
      </p>
    </div>
    <form class="flex flex-col gap-3 max-w-[325px] mx-auto" @submit="login()">
      <UFormGroup size="lg">
        <UInput placeholder="Your email" v-model="email" />
      </UFormGroup>
      <!-- <UFormGroup size="lg">
        <UInput placeholder="Your generated token" v-model="token" />
      </UFormGroup> -->
      <UFormGroup size="lg">
        <div class="flex relative">
          <UInput
            placeholder="Your new password"
            :type="passwordType"
            class="w-[100%]"
            v-model="password"
            @update:model-value="passwordInputHover = true"
            @blur="passwordInputHover = false"
          />
          <UButton
            class="absolute right-0 top-0 bottom-0 dark:hover:bg-primary-300"
            color="gray"
            variant="ghost"
            size="sm"
            @click="
              passwordType === 'password'
                ? (passwordType = 'text')
                : (passwordType = 'password')
            "
          >
            <IconWrapper
              size="5"
              :name="
                passwordType === 'password'
                  ? 'i-tabler-eye'
                  : 'i-tabler-eye-off'
              "
              dark-text
            />
          </UButton>
        </div>
      </UFormGroup>

      <UButton
        block
        size="lg"
        class="mt-12"
        :disabled="!(useValidEmail(email) && password.length >= 8)"
        :loading="loading"
        @click="login"
      >
        Reset Password
      </UButton>
      <p class="text-sm flex items-center justify-center gap-0">
        I don't have an account.
        <UButton size="sm" class="p-1" variant="link" to="/signup"
          >Create an account</UButton
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
// console.log(runtimeConfig.public.BASE_URL, isDevEnvironment)

const toast = useToast()
const email = ref("")
const password = ref("")
const token = ref("")
const passwordType = ref("password")
const loading = ref(false)
const thirtyDaysAhead = new Date()
thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)

const login = async () => {
  loading.value = true
  const route = useRoute()
  const { data, error } = await useAPIFetch("/auth/reset-password", {
    method: "POST",
    body: {
      email: email.value,
      token: route.query.token,
      password: password.value,
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
      title: `Successful reset password for ${email.value}. Back to login page.`,
      color: "green",
      icon: "i-bx-check-circle",
    })
    navigateTo("/login")
  }
  loading.value = false
}
</script>

<style scoped></style>
