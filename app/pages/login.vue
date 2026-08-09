<template>
  <div class="w-full">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-32 h-32 mb-12" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        Welcome back
      </h1>
      <p
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[20rem]"
      >
        Lyrics, scripture, slides, no install required. <br />
        Trusted by
        <span class="font-semibold text-gray-900 dark:text-white">3,000+</span>
        churches.
      </p>
    </div>

    <form class="flex flex-col gap-3.5 come-up-2" @submit.prevent="login">
      <CowButton
        v-if="!isTauri"
        variant="secondary"
        block
        type="button"
        :loading="googleLoading"
        @click="handleGoogleSignIn"
      >
        <GoogleIcon class="w-5 h-5" />
        Continue with Google
      </CowButton>

      <div
        v-if="!isTauri"
        class="flex items-center gap-4 my-1 text-gray-500 text-sm"
      >
        <span class="h-px flex-1 bg-gray-200 dark:bg-gray-700/70" />
        Or
        <span class="h-px flex-1 bg-gray-200 dark:bg-gray-700/70" />
      </div>

      <CowInput label="Email address" type="email" v-model="email" />

      <CowInput
        label="Your password"
        type="password"
        v-model="password"
        :error="errorMsg"
      >
        <template #hint>
          <NuxtLink
            to="/forgot-password"
            class="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Forgot password?
          </NuxtLink>
        </template>
      </CowInput>

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="!(useValidEmail(email) && password.length >= 8)"
        :loading="loading"
      >
        Continue
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        New here?
        <NuxtLink
          to="/signup"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
        >
          Create an account.
        </NuxtLink>
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
// console.log(runtimeConfig.public.BASE_URL, isDevEnvironment)

const toast = useToast()
const email = ref("")
const password = ref("")
const errorMsg = ref("")
const loading = ref(false)
const googleLoading = ref(false)
const { token } = useAuthToken()
const { appVersion } = useAppVersion()

watch([email, password], () => {
  errorMsg.value = ""
})

const login = async (event?: Event) => {
  event?.preventDefault()
  errorMsg.value = ""
  loading.value = true

  try {
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

      errorMsg.value = error.value?.data?.message || "Something went wrong"
    } else {
      if (
        !data.value?.data?.user?.emailVerified &&
        new Date().getTime() > new Date(inaccessibleDate).getTime()
      ) {
        token.value = data.value?.token
        authStore.setUser(data.value?.data?.user!!)

        // If account is no longer accessible and user is not verified
        usePosthogCapture("LOGIN_FAILED", {
          method: "email_password",
          email: email.value,
          error: "Email not verified",
        })

        toast.add({
          title:
            "Account is no longer accessible. Verify your email to proceed",
          color: "red",
          icon: "i-bx-error",
        })
        navigateTo("/verify?newUser=1")
      } else {
        token.value = data.value?.token
        authStore.setUser(data.value?.data?.user!!)

        usePosthogCapture("LOGIN_SUCCESSFUL", {
          method: "email_password",
          userId: data.value?.data?.user?._id,
          email: email.value,
          emailVerified: data.value?.data?.user?.emailVerified,
        })

        if (data.value?.data?.user?.emailVerified) {
          const hasChurch = !!data.value?.data?.user?.churchId
          navigateTo(hasChurch ? "/" : "/signup?registerChurch=1")
        } else {
          goToVerify()
        }
      }
    }
  } finally {
    loading.value = false
  }
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
      if (data.value?.data?.user?.emailVerified) {
        const hasChurch = !!data.value?.data?.user?.churchId
        navigateTo(hasChurch ? "/" : "/signup?registerChurch=1")
      } else {
        goToVerify()
      }
    }
  } catch (error: any) {
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
  } finally {
    googleLoading.value = false
  }
}

onMounted(() => {
  usePosthogCapture("LOGIN_PAGE_VIEWED")
})
</script>

<style scoped></style>
