<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-10">
      <Logo class="w-24 h-24" />
      <p class="max-w-[200px] mx-auto come-up-1">
        Join
        <span class="text-primary font-semibold">{{ church?.type }}</span> on
        <br />
        <span class="font-semibold">Cloud of Worship</span>
      </p>

      <div class="people-info mt-4 text-center">
        <UAvatarGroup class="mb-2" max="3">
          <UAvatar
            v-for="(user, index) in church?.users?.slice(0, 4)"
            :src="user?.avatar"
            :text="user?.fullname?.split(' ')?.[0]?.[0]"
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
      class="flex flex-col gap-3 max-w-[325px] mx-auto come-up-2"
      @submit="signup()"
    >
      <UFormGroup size="lg">
        <UInput placeholder="Your full name" v-model="fullName" />
      </UFormGroup>
      <UFormGroup size="lg">
        <UInput placeholder="Your email" v-model="email" />
      </UFormGroup>
      <UFormGroup size="lg">
        <div class="flex relative">
          <UInput
            placeholder="Choose a password"
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
        <div
          v-if="passwordInputHover"
          class="help text-gray-400 text-xs mt-2 flex gap-2 come-up-1"
        >
          <IconWrapper name="i-bx-info-circle" size="3" />
          Password must be at least 8 characters, including upper and lowercase
          characters, and a number.
        </div>
      </UFormGroup>
      <UButton
        block
        size="lg"
        class="mt-12"
        :disabled="!(useValidEmail(email) && passwordValid)"
        :loading="loading"
        @click="signup"
      >
        Create your account
      </UButton>
      <UButton
        block
        size="lg"
        class="mt-0"
        color="white"
        :loading="loading"
        @click="handleGoogleSignUp"
      >
        <GoogleIcon />
        Sign up with Google
      </UButton>
      <!-- <p class="text-sm flex items-center justify-center gap-0">
        I already have an account.
        <UButton size="sm" class="p-1" variant="link" to="/login"
          >Sign in</UButton
        >
      </p> -->
    </form>
  </div>
</template>

<script setup>
import { useAuthStore } from "~/store/auth"
definePageMeta({
  layout: "auth",
})

const runtimeConfig = useRuntimeConfig()
const isDevEnvironment = runtimeConfig.public.BASE_URL?.includes("localhost")
const googleSignIn = inject("handleGoogleSignIn")

const thirtyDaysAhead = new Date()
thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)
const token = useCookie("token", {
  secure: !isDevEnvironment,
  sameSite: true,
  expires: thirtyDaysAhead,
})
const authStore = useAuthStore()
const route = useRoute()

const step = ref(1)
const fullName = ref("")
const email = ref("")
const password = ref("")
const passwordType = ref("password")
const passwordInputHover = ref(false)
const loading = ref(false)
const church = ref(null)
// const otherChurch = ref("")
// const churchIdentity = ref("")
// const churchAddress = ref("")
// const churchPastor = ref("")

const passwordValid = computed(() => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+]{8,}$/
  return regex.test(password.value)
})

onMounted(() => {
  setTimeout(() => {
    useToast().add({
      title: "Still not convinced?",
      color: "red",
      description:
        "Watch this video to see why we think Cloud of Worship is your church's literal power point.",
      timeout: 0,
      actions: [
        {
          icon: "i-bx-play",
          label: "Watch video",
          click: () =>
            window.open(
              "https://www.youtube.com/watch?v=e3tbMg_CrpE",
              "_blank"
            ),
        },
      ],
    })
  }, 1500)
})

const getChurch = async () => {
  // console.log(authStore.user)
  const churchId = route.params.church_id
  if (churchId) {
    const promise = await useAPIFetch(`/church/${churchId}?teammates=true`)
    church.value = promise.data.value
  } else {
    navigateTo("/signup")
    useToast().add({
      icon: "i-bx-church",
      title: "Add your church in less than 1 minute to continue.",
    })
  }
}

getChurch()

const signup = async () => {
  const churchId = route.params.church_id
  loading.value = true
  const { data, error } = await useAPIFetch("/auth/signup/teammate", {
    method: "POST",
    body: {
      fullname: fullName.value,
      email: email.value,
      password: password.value,
      churchId,
    },
  })
  if (error.value) {
    useToast().add({
      title: error.value?.data?.error?.includes("E11000")
        ? "Email linked to an account"
        : error.value?.data?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    token.value = data.value?.token
    authStore.setUser(data?.value?.data.newUser)
    authStore.setUser({ ...authStore.user, churchId })
    useToast().add({
      title: "You are all set! 🎉",
      color: "green",
    })
    authStore.setChurch(church.value)
    navigateTo("/?newUser=1")
  }
  loading.value = false
}

const handleGoogleSignUp = async () => {
  const churchId = route.params.church_id
  loading.value = true
  const { user } = await googleSignIn()
  // console.log(user)
  // console.log(user?.accessToken)

  const { data, error } = await useAPIFetch("/auth/signup/google", {
    method: "POST",
    headers: { "x-access-token": `Bearer ${user?.accessToken}` },
    body: {
      churchId,
    },
  })
  if (error.value) {
    useToast().add({
      title: error.value?.data?.error?.includes("E11000")
        ? "Email linked to an account. Sign in instead."
        : error.value?.data?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    token.value = data.value?.token
    authStore.setUser(data?.value?.data.newUser)
    authStore.setUser({ ...authStore.user, churchId })
    useToast().add({
      title: "You are all set! 🎉",
      color: "green",
    })
    authStore.setChurch(church.value)
    navigateTo("/?newUser=1")
  }
  loading.value = false
}
</script>

<style scoped></style>
