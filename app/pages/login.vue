<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Log in to continue with
        <span class="font-semibold">Cloud of Worship</span>
      </p>
    </div>
    <form class="flex flex-col gap-3 max-w-[325px] mx-auto" @submit="login">
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
        <UButton
          size="sm"
          class="p-1 w-full justify-center mt-2"
          variant="link"
          to="/forgot-password"
        >
          I can't remember my password
        </UButton>
      </UFormGroup>

      <UButton
        block
        size="lg"
        class="mt-6"
        type="submit"
        :disabled="!(useValidEmail(email) && password.length >= 8)"
        :loading="loading"
      >
        Log In
      </UButton>
      <UButton
        v-if="!isTauri"
        block
        size="lg"
        class="mt-0"
        color="white"
        type="button"
        :loading="googleLoading"
        @click="handleGoogleSignIn"
      >
        <GoogleIcon />
        Sign in with Google
      </UButton>
      <p class="text-sm flex items-center justify-center gap-0">
        I don't have an account.
        <UButton size="sm" class="p-1" variant="link" to="/signup" type="button"
          >Create an account</UButton
        >
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { UserCredential } from "firebase/auth"
import { useAuthStore } from "~/store/auth"
import type { GoogleAuthResponseT, LoginResponseT } from "~/types/api-responses"

definePageMeta({
  layout: "auth",
})

useHead({
  title: "Sign in - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "Sign in to Cloud of Worship to access powerful church presentation tools for worship slides, lyrics, Bible verses, and media. Free account available.",
    },
    {
      name: "keywords",
      content:
        "church login, worship software, church presentation login, Cloud of Worship sign in, worship slides login, church media software",
    },
    { property: "og:title", content: "Login - Cloud of Worship" },
    {
      property: "og:description",
      content:
        "Sign in to Cloud of Worship to access powerful church presentation tools for worship slides, lyrics, Bible verses, and media.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Login - Cloud of Worship" },
    {
      name: "twitter:description",
      content:
        "Sign in to Cloud of Worship to access powerful church presentation tools for worship slides and media.",
    },
  ],
})

const inaccessibleDate = new Date("2024-12-13T00:00:00.000Z")
const authStore = useAuthStore()
const runtimeConfig = useRuntimeConfig()
const isDevEnvironment = runtimeConfig.public.BASE_URL?.includes("localhost")
const googleSignIn = inject("handleGoogleSignIn") as () => Promise<
  UserCredential | any
>
const { isTauri } = useTauri()
const { checkRedirectResult } = useTauriGoogleAuth()
// console.log(runtimeConfig.public.BASE_URL, isDevEnvironment)

const toast = useToast()
const email = ref("")
const password = ref("")
const passwordType = ref("password")
const passwordInputHover = ref(false)
const loading = ref(false)
const googleLoading = ref(false)
const { token } = useAuthToken()
const { appVersion } = useAppVersion()

const login = async (event) => {
  event.preventDefault()
  loading.value = true

  usePosthogCapture("LOGIN_ATTEMPTED", {
    method: "email_password",
    email: email.value,
  })

  const { data, error } = await useAPIFetch<LoginResponseT>("/auth/login", {
    method: "POST",
    body: {
      email: email.value,
      password: password.value,
      appVersion: appVersion,
    },
  })

  // If error occurred
  if (error.value) {
    usePosthogCapture("LOGIN_FAILED", {
      method: "email_password",
      email: email.value,
      error: error.value?.data?.message,
    })

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
      usePosthogCapture("LOGIN_FAILED", {
        method: "email_password",
        email: email.value,
        error: "Email not verified",
      })

      toast.add({
        title: "Account is no longer accessible. Verify your email to proceed",
        color: "red",
        icon: "i-bx-error",
      })
      navigateTo("/verify")
    } else {
      token.value = data.value?.token
      authStore.setUser(data.value?.data?.user!!)

      usePosthogCapture("LOGIN_SUCCESSFUL", {
        method: "email_password",
        userId: data.value?.data?.user?._id,
        email: email.value,
        emailVerified: data.value?.data?.user?.emailVerified,
      })

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

  usePosthogCapture("LOGIN_ATTEMPTED", {
    method: "google",
  })

  try {
    const { user } = await googleSignIn()

    // Don't process if redirect was initiated (Tauri only)
    if (!user) {
      return
    }

    // Get the ID token from Firebase user
    const idToken = await user.getIdToken()

    const { data, error } = await useAPIFetch<GoogleAuthResponseT>(
      "/auth/login/google",
      {
        method: "POST",
        headers: { "x-access-token": `Bearer ${idToken}` },
        body: {
          appVersion: appVersion,
        },
      }
    )

    if (error.value) {
      usePosthogCapture("LOGIN_FAILED", {
        method: "google",
        email: user?.email,
        error: error.value?.data?.message,
      })

      toast.add({
        title: error.value?.data?.message,
        color: "red",
        icon: "i-bx-error",
      })
    } else {
      token.value = data.value?.token
      authStore.setUser(data.value?.data?.user!!)

      usePosthogCapture("LOGIN_SUCCESSFUL", {
        method: "google",
        userId: data.value?.data?.user?._id,
        email: user?.email,
        emailVerified: data.value?.data?.user?.emailVerified,
      })

      toast.add({
        title: `Successful login as ${user?.email}`,
        color: "green",
        icon: "i-bx-check-circle",
      })
      navigateTo("/")
    }
  } catch (error: any) {
    // Only show error if it's not a redirect initiation
    if (error?.message !== "Redirect initiated") {
      usePosthogCapture("LOGIN_FAILED", {
        method: "google",
        error: error?.message,
      })

      toast.add({
        title: "Google sign in failed",
        description: error?.message || "An error occurred",
        color: "red",
        icon: "i-bx-error",
      })
    }
  } finally {
    googleLoading.value = false
  }
}

// Check for redirect result on mount (for Tauri OAuth redirect)
onMounted(async () => {
  usePosthogCapture("LOGIN_PAGE_VIEWED")

  if (isTauri) {
    googleLoading.value = true
    const result = await checkRedirectResult()

    if (result?.user) {
      usePosthogCapture("LOGIN_ATTEMPTED", {
        method: "google_tauri",
      })

      // Process the Google auth result
      const { user } = result

      // Get the ID token from Firebase user
      const idToken = await user.getIdToken()

      const { data, error } = await useAPIFetch<GoogleAuthResponseT>(
        "/auth/login/google",
        {
          method: "POST",
          headers: { "x-access-token": `Bearer ${idToken}` },
          body: {
            appVersion: appVersion,
          },
        }
      )

      if (error.value) {
        usePosthogCapture("LOGIN_FAILED", {
          method: "google_tauri",
          email: user?.email,
          error: error.value?.data?.message,
        })

        toast.add({
          title: error.value?.data?.message,
          color: "red",
          icon: "i-bx-error",
        })
      } else {
        token.value = data.value?.token
        authStore.setUser(data.value?.data?.user!!)

        usePosthogCapture("LOGIN_SUCCESSFUL", {
          method: "google_tauri",
          userId: data.value?.data?.user?._id,
          email: user?.email,
          emailVerified: data.value?.data?.user?.emailVerified,
        })

        toast.add({
          title: `Successful login as ${user?.email}`,
          color: "green",
          icon: "i-bx-check-circle",
        })
        navigateTo("/")
      }
    }
    googleLoading.value = false
  }
})
</script>

<style scoped></style>
