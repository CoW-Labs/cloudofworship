<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-24 h-24" />
      <p class="max-w-[200px] mx-auto">
        Log in to continue with
        <span class="font-semibold">Cloud of Worshippers</span>
      </p>
    </div>
    <form class="flex flex-col gap-3 max-w-[325px] mx-auto" @submit="login()">
      <UFormGroup size="lg">
        <UInput placeholder="Your email" v-model="email" />
      </UFormGroup>
      <UFormGroup size="lg">
        <div class="flex relative">
          <UInput
            placeholder="Your password"
            :type="passwordType"
            class="w-[100%]"
            v-model="password"
            @update:model-value="passwordInputHover = true"
            @blur="passwordInputHover = false"
          />
          <UButton
            class="absolute right-0 top-0 bottom-0"
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
        Log In
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
const passwordType = ref("password")
const loading = ref(false)
const thirtyDaysAhead = new Date()
thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)
const token = useCookie("token", {
  secure: !isDevEnvironment,
  sameSite: true,
  expires: thirtyDaysAhead,
})

const login = async () => {
  loading.value = true
  const { data, error } = await useAPIFetch("/auth/login", {
    method: "POST",
    body: {
      email: email.value,
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
    token.value = data.value.token
    authStore.setUser(data.value?.data?.user)
    toast.add({
      title: `Successful login as ${email.value}`,
      color: "green",
      icon: "i-bx-check-circle",
    })
    navigateTo("/")
  }
  loading.value = false
}
</script>

<style scoped></style>
