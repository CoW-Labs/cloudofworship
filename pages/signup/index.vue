<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-28 h-28" />
      <p v-show="step === 1" class="max-w-[200px] mx-auto come-up-1">
        Sign up to start using
        <span class="font-semibold">Cloud of Worship</span>
      </p>
      <p v-show="step === 2" class="max-w-[200px] mx-auto come-up-1">
        <span class="font-semibold"
          >Welcome, {{ user?.fullname?.split(" ")?.[0] }}</span
        >
        <br />
        Tell us about your church
      </p>
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
          characters and a number.
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
        :loading="googleLoading"
        @click="handleGoogleSignUp"
      >
        <GoogleIcon />
        Sign up with Google
      </UButton>
      <p class="text-sm flex items-center justify-center gap-0">
        I already have an account.
        <UButton size="sm" class="p-1" variant="link" to="/login"
          >Sign in</UButton
        >
      </p>
    </form>

    <!-- FORM 2 -->
    <form
      v-show="step == 2"
      class="flex flex-col gap-3 max-w-[325px] mx-auto come-up-2"
      @submit="signup()"
    >
      <UFormGroup size="lg">
        <USelectMenu
          placeholder="Select your church's name"
          variant="solid"
          class="bg-gray-100 rounded-md"
          v-model="church"
          :options="churchesArr"
          searchable="true"
          :ui="{
            variant: {
              solid: 'focus:ring-0 dark:bg-primary-200',
            },
          }"
        >
          <template #label>
            <span v-if="church?.length" class="truncate text-black">{{
              church
            }}</span>
            <span v-else class="text-gray-600">Select your church</span>
          </template>
        </USelectMenu>
        <div
          v-if="church === 'Other Church (not included)'"
          class="come-up-1 mt-1"
        >
          <UInput placeholder="Your church" v-model="otherChurch" />
          <div class="help text-gray-400 text-xs mt-2 flex gap-1 come-up-1">
            <IconWrapper name="i-bx-info-circle" size="3" />
            Tell us so we will never forget.
          </div>
        </div>
      </UFormGroup>
      <UFormGroup size="lg" class="relative">
        <UInput
          placeholder="Your branch, zone, district, campus?"
          v-model="churchIdentity"
        />
        <UTooltip
          color="black"
          class="absolute right-1 top-1.5"
          text="How would you identify your church?"
          :ui="{
            background: 'bg-primary-100 dark:bg-gray-900',
            color: 'text-primary-900 dark:text-primary-100',
          }"
        >
          <UButton
            class="p-1 hover:bg-primary-200"
            variant="ghost"
            color="black"
          >
            <IconWrapper name="i-bx-info-circle" size="5" dark-text />
          </UButton>
        </UTooltip>
      </UFormGroup>
      <UFormGroup size="lg">
        <UInput
          placeholder="Your senior pastor's name"
          v-model="churchPastor"
        />
      </UFormGroup>
      <UFormGroup size="lg" class="relative">
        <UInput
          placeholder="Your church's address (optional)"
          v-model="churchAddress"
        />
        <UTooltip
          color="black"
          class="absolute right-1 top-1.5"
          text="[City, State, Country] is enough information"
          :ui="{
            background: 'bg-primary-100 dark:bg-gray-900',
            color: 'text-primary-900 dark:text-primary-100',
          }"
        >
          <UButton
            class="p-1 hover:bg-primary-200"
            variant="ghost"
            color="black"
          >
            <IconWrapper name="i-bx-info-circle" size="5" dark-text />
          </UButton>
        </UTooltip>

        <!-- <div class="help text-gray-400 text-xs mt-2 flex gap-1 come-up-1">
          <IconWrapper name="i-bx-info-circle" size="3" />
        </div> -->
      </UFormGroup>
      <UButton
        block
        size="lg"
        class="mt-12"
        :disabled="
          !(
            church &&
            churchIdentity &&
            churchPastor &&
            (church === 'Other Church (not included)' ? otherChurch : true)
          )
        "
        :loading="loading"
        @click="signup"
      >
        Start using Cloud of Worship
      </UButton>
    </form>
  </div>
</template>
<script setup>
import { useAuthStore } from "~/store/auth"

definePageMeta({
  layout: "auth",
})

useHead({
  title: "Sign up - Cloud of Worship",
  description:
    "Sign up to start using Cloud of Worship - Your church's powerpoint",
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

const step = ref(route.query.registerChurch ? 2 : 1)
const fullName = ref("")
const email = ref("")
const password = ref("")
const passwordType = ref("password")
const passwordInputHover = ref(false)
const loading = ref(false)
const googleLoading = ref(false)
const church = ref("")
const otherChurch = ref("")
const churchIdentity = ref("")
const churchAddress = ref("")
const churchPastor = ref("")
const { user } = storeToRefs(authStore)

const passwordValid = computed(() => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+]{8,}$/
  return regex.test(password.value)
})

const getChurch = async () => {
  if (user.value?.churchId) {
    const { data } = await useAPIFetch(`/church/${user.value?.churchId}`)
    authStore.setChurch(data.value)
    navigateTo("/")
  } else if (!user.value) {
    navigateTo("/login")
  }
}

onMounted(() => {
  if (route.query.registerChurch) {
    getChurch()
  }
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

const goToVerify = () => {
  useToast().add({
    title: "Please verify your email to proceed",
    icon: "i-bx-circle",
    color: "primary",
  })
  navigateTo("/verify?newUser=1")
}

const signup = async () => {
  if (step.value === 1) {
    loading.value = true
    const { data, error } = await useAPIFetch("/auth/signup", {
      method: "POST",
      body: {
        fullname: fullName.value,
        email: email.value,
        password: password.value,
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
      step.value = 2
    }
    loading.value = false
  } else {
    loading.value = true
    const { data, error } = await useAPIFetch("/church", {
      method: "POST",
      body: {
        name:
          church.value === "Other Church (not included)"
            ? otherChurch.value
            : church.value,
        type: churchIdentity.value,
        address: churchAddress.value,
        pastor: churchPastor.value,
        userId: authStore.user?._id,
      },
    })
    if (error.value) {
      useToast().add({
        title: error.value?.data?.message,
        color: "red",
        icon: "i-bx-error",
      })
    } else {
      authStore.setChurch(data?.value)
      authStore.setUser({ ...authStore.user, churchId: data?.value?._id })
      goToVerify()
      useToast().add({
        title: "You are all set! 🎉",
        color: "green",
      })
      // navigateTo("/?newUser=1")
    }
    loading.value = false
  }
}

const handleGoogleSignUp = async () => {
  googleLoading.value = true
  const { user } = await googleSignIn()
  // console.log(user)
  // console.log(user?.accessToken)

  const { data, error } = await useAPIFetch("/auth/signup/google", {
    method: "POST",
    headers: { "x-access-token": `Bearer ${user?.accessToken}` },
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
    step.value = 2
  }
  googleLoading.value = false
}
</script>

<style scoped></style>
