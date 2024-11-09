<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Log in to continue with
        <span class="font-semibold">Cloud of Worship</span>
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
        Log In
      </UButton>
      <UButton
        block
        size="lg"
        class="mt-0"
        color="white"
        :loading="googleLoading"
        @click="handleGoogleSignIn"
      >
        <GoogleIcon />
        Sign in with Google
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

useHead({
  title: "Sign in - Cloud of Worship",
  description:
    "Sign in to continue using Cloud of Worship - Your church's powerpoint",
})

const inaccessibleDate = new Date("2024-12-13T00:00:00.000Z")
const authStore = useAuthStore()
const runtimeConfig = useRuntimeConfig()
const isDevEnvironment = runtimeConfig.public.BASE_URL?.includes("localhost")
const googleSignIn = inject("handleGoogleSignIn")
// console.log(runtimeConfig.public.BASE_URL, isDevEnvironment)

const toast = useToast()
const email = ref("")
const password = ref("")
const passwordType = ref("password")
const loading = ref(false)
const googleLoading = ref(false)
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
    if (
      !data.value?.data?.user?.emailVerified &&
      new Date().getTime() > new Date(inaccessibleDate).getTime()
    ) {
      // If account is no longer accessible and user is not verified
      toast.add({
        title: "Account is no longer accessible. Verify your email to proceed",
        color: "red",
        icon: "i-bx-error",
      })
      navigateTo("/verify")
    } else {
      token.value = data.value.token
      authStore.setUser(data.value?.data?.user)
      toast.add({
        title: `Successful login as ${email.value}`,
        color: "green",
        icon: "i-bx-check-circle",
      })
      if (data.value?.data?.user?.emailVerified) {
        navigateTo("/")
      } else {
        goToVerify()
      }
      navigateTo("/")
    }
  }
  loading.value = false
}

const goToVerify = () => {
  toast.add({
    title: "Please verify your email to proceed",
    icon: "i-bx-circle",
    color: "primary",
  })
  navigateTo("/verify")
}

const handleGoogleSignIn = async () => {
  googleLoading.value = true
  const { user } = await googleSignIn()
  // console.log(user)

  const { data, error } = await useAPIFetch("/auth/login/google", {
    method: "POST",
    headers: { "x-access-token": `Bearer ${user?.accessToken}` },
  })

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
      title: `Successful login as ${user?.email}`,
      color: "green",
      icon: "i-bx-check-circle",
    })
    navigateTo("/")
  }
  googleLoading.value = false
}
</script>

<style scoped></style>
