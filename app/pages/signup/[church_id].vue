<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-10">
      <Logo class="w-32 h-32 mb-12" />
      <p class="max-w-[280px] mx-auto come-up-1">
        Join
        <span class="text-primary font-semibold"
          >{{ church?.name }}, {{ church?.type }}</span
        >
        on
        <br />
        <span class="font-semibold">Cloud of Worship</span>
      </p>

      <div class="people-info mt-4 text-center">
        <UAvatarGroup class="mb-2" :max="3">
          <UAvatar
            v-for="(user, index) in church?.users?.slice(0, 4)"
            :key="user?._id || index"
            :src="user?.avatar"
            :text="user?.fullname?.split(' ')?.[0]?.[0] || ''"
            size="lg"
            :ui="{ text: `text-[${user?.theme}] font-semibold` }"
            :class="`border-[${user?.theme}] bg-[${user?.theme}20]`"
          />
        </UAvatarGroup>
        <div class="label text-sm">
          {{ church?.users[0]?.fullname }}
          {{
            church?.users?.length === 1
              ? "already joined"
              : "and others already joined"
          }}
        </div>
      </div>
    </div>

    <!-- FORM 1 -->
    <form
      v-show="step === 1"
      class="flex flex-col gap-3.5 mx-auto come-up-2"
      @submit.prevent="signup"
    >
      <CowInput label="Full name" v-model="fullName" />
      <CowInput label="Email address" type="email" v-model="email" />
      <div>
        <CowInput
          label="Choose a password"
          type="password"
          v-model="password"
          @update:model-value="passwordInputHover = true"
          @blur="passwordInputHover = false"
        />
        <div
          v-if="passwordInputHover"
          class="help text-gray-500 dark:text-gray-400 text-xs mt-2 flex gap-2 come-up-1"
        >
          <InfoIcon class="w-3 h-3" />
          Password must be at least 8 characters and include a letter and a
          number.
        </div>
      </div>

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="!(fullName.trim() && useValidEmail(email) && passwordValid)"
        :loading="loading"
      >
        Create your account
      </CowButton>
      <CowButton
        variant="secondary"
        block
        type="button"
        :loading="loading"
        @click="handleGoogleSignUp"
      >
        <GoogleIcon class="w-5 h-5" />
        Sign up with Google
      </CowButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { UserCredential } from "firebase/auth"
import {
  isGoogleAuthCancelled,
  isGoogleAuthRedirectPending,
} from "~/composables/useTauriGoogleAuth"
import { useAuthStore } from "~/store/auth"
import type { SignupResponseT, ApiErrorT } from "~/types/api-responses"
import type { Church } from "~/store/auth"
definePageMeta({
  layout: "auth",
})

const googleSignIn = inject("handleGoogleSignIn") as () => Promise<any>
const { checkRedirectResult } = useTauriGoogleAuth()

const { token } = useAuthToken()
const authStore = useAuthStore()
const route = useRoute()
const toast = useToast()

// Initialize UTM tracking
const { initUTMTracking, getUTMParams } = useUTMParams()

const step = ref(1)
const fullName = ref("")
const email = ref("")
const password = ref("")
const passwordType = ref("password")
const passwordInputHover = ref(false)
const loading = ref(false)
const church = ref<Church>()

const getChurchId = () => {
  const churchId = route.params.church_id
  return Array.isArray(churchId) ? churchId[0] : churchId
}

const passwordValid = computed(() => {
  const regex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
  return regex.test(password.value)
})

const getChurch = async () => {
  // console.log(authStore.user)
  const churchId = getChurchId()
  if (churchId) {
    const promise = await useAPIFetch(`/church/${churchId}?teammates=true`)
    church.value = promise.data.value as Church
  } else {
    navigateTo("/signup")
    toast.add({
      icon: "i-bx-church",
      title: "Add your church in less than 1 minute to continue.",
    })
  }
}

// The Google signup endpoint returns `newUser` for a fresh account, and `user`
// when the Google account is already linked to an existing one. Either way the
// user is authenticated, so take them into the app instead of stalling.
const applyGoogleSignupResult = (
  payload: SignupResponseT | null | undefined,
  churchId: string
) => {
  const newUser = payload?.data?.newUser
  const existingUser = payload?.data?.user
  const signedInUser = newUser || existingUser
  if (!signedInUser) return

  const userChurchId = signedInUser.churchId || churchId

  token.value = payload?.token || null
  authStore.setUser({ ...signedInUser, churchId: userChurchId })
  if (church.value && userChurchId === churchId) {
    authStore.setChurch(church.value)
  }

  if (!newUser) {
    toast.add({
      title: "Welcome back, you already have an account",
      icon: "i-bx-check-circle",
      color: "primary",
    })
  }

  if (signedInUser.emailVerified) {
    navigateTo(newUser ? "/?newUser=1" : "/")
  } else {
    navigateTo(newUser ? "/verify?newUser=1" : "/verify")
  }
}

onMounted(async () => {
  // Initialize UTM tracking on page load
  initUTMTracking(route)

  await getChurch()

  // The Google redirect flow (mobile, PWA, in-app browsers, Tauri) lands back
  // here with the credential waiting to be picked up.
  const result = await checkRedirectResult()
  if (result?.user) {
    await handleGoogleSignUp(result)
  }
})

const signup = async () => {
  const churchId = getChurchId()
  if (!churchId) {
    navigateTo("/signup")
    return
  }

  loading.value = true

  // Get UTM parameters
  const utmParams = getUTMParams(route)

  const { data, error } = await useAPIFetch<SignupResponseT, ApiErrorT>(
    "/auth/signup/teammate",
    {
      method: "POST",
      body: {
        fullname: fullName.value,
        email: email.value,
        password: password.value,
        churchId,
        utmParams,
      },
    }
  )
  if (error.value) {
    toast.add({
      title: error.value?.data?.error?.includes("E11000")
        ? "Email linked to an account"
        : error.value?.data?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    const newUser = data.value?.data.newUser
    if (newUser) {
      token.value = data.value?.token || null
      authStore.setUser({ ...newUser, churchId })
      if (church.value) {
        authStore.setChurch(church.value)
      }
      if (newUser.emailVerified) {
        navigateTo("/?newUser=1")
      } else {
        navigateTo("/verify?newUser=1")
      }
    }
  }
  loading.value = false
}

const handleGoogleSignUp = async (redirectResult?: UserCredential) => {
  const churchId = getChurchId()
  if (!churchId) {
    navigateTo("/signup")
    return
  }

  loading.value = true

  try {
    // Coming back from the redirect flow we already hold the credential.
    const { user } = redirectResult ?? (await googleSignIn())

    // Don't process if redirect was initiated
    if (!user) {
      return
    }

    // Get the ID token from Firebase user
    const idToken = await user.getIdToken()

    // Get UTM parameters
    const utmParams = getUTMParams(route)

    const { data, error } = await useAPIFetch<SignupResponseT, ApiErrorT>(
      "/auth/signup/google",
      {
        method: "POST",
        headers: { "x-access-token": `Bearer ${idToken}` },
        body: {
          churchId,
          utmParams,
        },
      }
    )
    if (error.value) {
      toast.add({
        title: error.value?.data?.error?.includes("E11000")
          ? "Email linked to an account. Sign in instead."
          : error.value?.data?.message,
        color: "red",
        icon: "i-bx-error",
      })
    } else {
      applyGoogleSignupResult(data.value, churchId)
    }
  } catch (error: any) {
    // Handing off to the redirect flow: the page is unloading, not failing.
    if (isGoogleAuthRedirectPending(error)) return

    // The person closed the Google window themselves — no error to report.
    if (isGoogleAuthCancelled(error)) return

    toast.add({
      title: "Google sign up failed",
      description: error?.message || "An error occurred",
      color: "red",
      icon: "i-bx-error",
    })
  } finally {
    loading.value = false
  }
}
</script>

<style scoped></style>
