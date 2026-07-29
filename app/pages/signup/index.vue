<template>
  <div class="w-full">
    <!-- HEADER -->
    <div
      :key="`head-${step}`"
      class="flex flex-col items-center text-center mb-8 come-up-1"
    >
      <Logo class="w-32 h-32 mb-12" />

      <template v-if="step === 1">
        <h1 :class="headingClass">Get Started</h1>
        <p :class="subtitleClass">
          Lyrics, scripture, slides, no install required. <br />
          Trusted by thousands of churches
        </p>
      </template>
      <template v-else-if="step === 2">
        <h1 :class="headingClass">What should we call you?</h1>
        <p :class="subtitleClass">This is what your team knows you as</p>
      </template>
      <template v-else-if="step === 3">
        <h1 :class="headingClass">Tell us about your {{ entityLabel }}</h1>
      </template>
      <template v-else-if="step === 4">
        <h1 :class="headingClass">Will anyone be joining now?</h1>
        <p :class="subtitleClass">
          You can invite others to help plan and create
          {{ authStore.church?.name || "your church" }} schedules.
        </p>
      </template>
      <template v-else>
        <h1 :class="headingClass">One last thing…how can we reach you?</h1>
      </template>
    </div>

    <!-- STEP 1 - Google or email credentials -->
    <form
      v-if="step === 1"
      key="step-1"
      class="flex flex-col gap-3.5 come-up-2"
      @submit.prevent="handleStep1"
    >
      <CowButton
        v-if="!isTauri"
        variant="secondary"
        block
        type="button"
        :loading="googleLoading"
        @click="handleGoogleSignUp"
      >
        <GoogleIcon class="w-5 h-5" />
        Sign up with Google
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
        label="Choose a password"
        type="password"
        v-model="password"
        :error="passwordError"
      />

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="step1Disabled"
        :loading="loading"
      >
        Continue
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        I already have an account.
        <NuxtLink
          to="/login"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
        >
          Sign in
        </NuxtLink>
      </p>
    </form>

    <!-- STEP 2 - full name -->
    <form
      v-else-if="step === 2"
      key="step-2"
      class="flex flex-col gap-3.5 come-up-2"
      @submit.prevent="handleStep2"
    >
      <CowInput label="Full name" v-model="fullName" />

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="step2Disabled"
        :loading="loading"
      >
        Continue
      </CowButton>
    </form>

    <!-- STEP 3 - church details -->
    <form
      v-else-if="step === 3"
      key="step-3"
      class="flex flex-col gap-3.5 come-up-2"
      @submit.prevent="handleStep3"
    >
      <CowToggle
        label="Are you creating this account for a church?"
        v-model="creatingForChurch"
      />
      <CowDropdown
        v-if="creatingForChurch"
        label="Church name"
        v-model="church"
        :options="churchesArr"
        searchable
      />
      <CowInput
        v-if="!creatingForChurch || church === OTHER_CHURCH_OPTION"
        class="come-up-1"
        :label="entityNameInputLabel"
        v-model="otherChurch"
      />
      <CowDropdown
        :label="entityTypeLabel"
        v-model="churchType"
        :options="entityTypes"
      />
      <CowInput :label="entityHeadLabel" v-model="churchPastor" />

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="step3Disabled"
        :loading="loading"
      >
        Continue
      </CowButton>
    </form>

    <!-- STEP 4 - invite team -->
    <form
      v-else-if="step === 4"
      key="step-4"
      class="flex flex-col gap-3.5 come-up-2"
      @submit.prevent="handleStep4"
    >
      <!-- items-stretch matches the button's height to the input; mb-1 leaves
           room for the button's 4px bottom ledge so both bottoms line up -->
      <div class="flex gap-2 items-stretch">
        <CowInput
          class="flex-1"
          label="Email address"
          type="email"
          v-model="inviteInput"
          @keydown.enter.prevent="addInvite"
        />
        <CowButton
          type="button"
          variant="secondary"
          class="shrink-0 !rounded-2xl mb-1"
          :disabled="!useValidEmail(inviteInput)"
          @click="addInvite"
        >
          Add
        </CowButton>
      </div>

      <div v-if="addedEmails.length" class="flex flex-wrap gap-2">
        <span
          v-for="(em, i) in addedEmails"
          :key="em"
          class="signup-invite-chip come-up-1"
        >
          {{ em }}
          <button
            type="button"
            class="signup-invite-chip__remove"
            @click="removeInvite(i)"
          >
            <CloseIcon class="w-3.5 h-3.5" />
          </button>
        </span>
      </div>

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="step4Disabled"
        :loading="loading"
      >
        Continue
      </CowButton>
      <CowButton
        variant="secondary"
        block
        type="button"
        :disabled="loading"
        @click="step = 5"
      >
        I'll do this later
      </CowButton>
    </form>

    <!-- STEP 5 - phone + how did you find us -->
    <form
      v-else
      key="step-5"
      class="flex flex-col gap-3.5 come-up-2"
      @submit.prevent="handleStep5"
    >
      <CowPhoneInput label="Your phone number" v-model="phone" />
      <CowDropdown
        label="How did you find us? (optional)"
        v-model="howYouFoundUs"
        :options="howYouFoundUsOptions"
      />

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="!phone"
        :loading="loading"
      >
        Continue
      </CowButton>
      <CowButton
        variant="secondary"
        block
        type="button"
        :disabled="loading"
        @click="finishOnboarding()"
      >
        I'll do this later
      </CowButton>
    </form>

    <!-- PROGRESS -->
    <div v-if="step > 1" class="flex justify-center items-center gap-1 mt-10">
      <span
        v-for="n in 5"
        :key="n"
        class="h-0.5 w-[30px] rounded-full transition-all duration-300"
        :class="
          n <= step
            ? 'bg-gray-900 dark:bg-white'
            : 'bg-gray-200 dark:bg-slate-600'
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"
import type { User, Church } from "~/store/auth"
import type { ApiErrorT, SignupResponseT } from "~/types/api-responses"
import { appWideActions, churchesArr } from "~/utils/constants"

definePageMeta({
  layout: "auth",
})

useHead({
  title: "Sign up - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "Sign up to start using Cloud of Worship - Your church's powerpoint",
    },
  ],
})

const route = useRoute()
const { token } = useAuthToken()
const { isTauri } = useTauri()
const authStore = useAuthStore()
const googleSignIn = inject("handleGoogleSignIn") as () => Promise<any>
const { user } = storeToRefs(authStore)
const { sendEmailInvitations } = useUser()
const { initUTMTracking, getUTMParams } = useUTMParams()
const toast = useToast()
const emitter = useNuxtApp().$emitter as any
const signupMethod = ref<"email" | "google">("email")
const signupVisualState = useSignupVisualState()

const headingClass =
  "text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
const subtitleClass =
  "text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"

const OTHER_CHURCH_OPTION = "Other Church (not included)"

const churchTypes = [
  "Headquarters",
  "Provincial Headquarters",
  "Zonal Parish",
  "Area / District Parish",
  "Branch",
  "Campus Parish",
  "Online Campus",
  "House Fellowship / Center",
]
// Parish/branch language doesn't fit a non-church account, so these accounts
// get their own set of types rather than sharing the church list.
const organizationTypes = [
  "Conference",
  "Meetup",
  "NGO",
  "Non-profit",
  "Ministry",
  "School / Campus Group",
  "Online Community",
  "Other",
]
const howYouFoundUsOptions = [
  "Google Search",
  "Social Media (Facebook, Instagram, etc.)",
  "Word of Mouth / Friend",
  "YouTube",
  "Church Community / WhatsApp Group",
  "App Store",
  "Other",
]

const step = ref(route.query.registerChurch ? 3 : 1)
const loading = ref(false)
const googleLoading = ref(false)
// True once onboarding has handed the user over to the plan chooser, so we
// know a modal close means "done onboarding" rather than some other gate.
const awaitingUpgradeChoice = ref(false)

// Step 1
const email = ref("")
const password = ref("")

// Step 2
const fullName = ref("")

// Step 3
const church = ref("")
const otherChurch = ref("")
const churchType = ref("")
const churchPastor = ref("")
const creatingForChurch = ref(true)

// Step 4
const inviteInput = ref("")
const addedEmails = ref<string[]>([])

// Step 5
const howYouFoundUs = ref("")
const phone = ref("")

const passwordValid = computed(() => {
  const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/
  return regex.test(password.value)
})

const passwordError = computed(() => {
  if (!password.value || passwordValid.value) return ""
  return "Password must include a letter, a number and a symbol"
})

const step1Disabled = computed(
  () => !(useValidEmail(email.value) && passwordValid.value)
)

const step2Disabled = computed(() => !fullName.value.trim())

const entityLabel = computed(() =>
  creatingForChurch.value ? "church" : "organization"
)
const entityNameInputLabel = computed(() =>
  creatingForChurch.value ? "Enter church name" : "Organization name"
)
const entityTypeLabel = computed(() =>
  creatingForChurch.value ? "Church type" : "Organization type"
)
const entityTypes = computed(() =>
  creatingForChurch.value ? churchTypes : organizationTypes
)
const entityHeadLabel = computed(() =>
  creatingForChurch.value ? "Head of ministry" : "Head of organization"
)
const churchName = computed(() =>
  church.value === OTHER_CHURCH_OPTION ? otherChurch.value.trim() : church.value
)
const ministryHead = computed(() => churchPastor.value.trim())

const step3Disabled = computed(
  () => !(churchName.value && churchType.value && ministryHead.value)
)

const step4Disabled = computed(
  () => !addedEmails.value.length && !useValidEmail(inviteInput.value)
)

watch(
  [
    step,
    fullName,
    churchName,
    churchType,
    churchPastor,
    creatingForChurch,
    addedEmails,
  ],
  () => {
    signupVisualState.value = {
      step: step.value,
      fullName: fullName.value,
      churchName: churchName.value,
      churchType: churchType.value,
      churchPastor: churchPastor.value,
      creatingForChurch: creatingForChurch.value,
      invitedEmails: [...addedEmails.value],
    }
  },
  { immediate: true, deep: true }
)

const getErrorMessage = (error: ApiErrorT | null | undefined) =>
  error?.data?.message || "Something went wrong"

watch(creatingForChurch, (isCreatingForChurch) => {
  if (!isCreatingForChurch) {
    church.value = OTHER_CHURCH_OPTION
  }

  // The two lists share no options, so anything already picked is now stale.
  if (!entityTypes.value.includes(churchType.value)) {
    churchType.value = ""
  }
})

type ChurchPayload =
  | Church
  | { data?: Church | { church?: Church }; church?: Church }

const normalizeChurchPayload = (
  payload: ChurchPayload | null | undefined
): Church | null => {
  if (!payload) return null
  if ("_id" in payload) return payload
  const nestedData = payload.data
  if (nestedData && typeof nestedData === "object" && "_id" in nestedData) {
    return nestedData
  }
  if (nestedData && typeof nestedData === "object" && "church" in nestedData) {
    return nestedData.church || null
  }
  return payload.church || null
}

const getActiveChurchId = () =>
  authStore.church?._id || authStore.user?.churchId

const updateUserProfile = async (
  updateData: Partial<Pick<User, "fullname" | "phone">>
) => {
  const { data, error } = await useAPIFetch<User, ApiErrorT>("/user/update", {
    method: "PUT",
    body: updateData,
  })

  if (error.value) {
    toast.add({
      title: getErrorMessage(error.value),
      color: "red",
      icon: "i-bx-error",
    })
    return null
  }

  if (data.value) {
    authStore.setUser(data.value)
  }

  return data.value || null
}

const updateChurchProfile = async (
  updateData: Partial<Church> & { howYouFoundUs?: string }
) => {
  const churchId = getActiveChurchId()
  if (!churchId) {
    usePosthogCapture("SIGNUP_CHURCH_UPDATE_SKIPPED", {
      reason: "missing_church_id",
      updateFields: Object.keys(updateData),
      userId: authStore.user?._id,
    })
    return null
  }

  const { data, error } = await useAPIFetch<ChurchPayload, ApiErrorT>(
    `/church/${churchId}`,
    {
      method: "PUT",
      body: updateData,
    }
  )

  if (error.value) {
    usePosthogCapture("SIGNUP_CHURCH_UPDATE_FAILED", {
      churchId,
      updateFields: Object.keys(updateData),
      error: getErrorMessage(error.value),
    })
    toast.add({
      title: getErrorMessage(error.value),
      color: "red",
      icon: "i-bx-error",
    })
    return null
  }

  const updatedChurch = normalizeChurchPayload(data.value)
  if (updatedChurch) {
    authStore.setChurch(updatedChurch)
  }

  return updatedChurch
}

const createEmailAccount = async () => {
  const utmParams = getUTMParams(route)
  const { data, error } = await useAPIFetch<SignupResponseT, ApiErrorT>(
    "/auth/signup",
    {
      method: "POST",
      body: {
        email: email.value,
        password: password.value,
        utmParams,
      },
    }
  )

  if (error.value) {
    const emailExists = error.value?.data?.error?.includes("E11000")
    usePosthogCapture("SIGNUP_CREATE_ACCOUNT_FAILED", {
      method: "email",
      email: email.value,
      error: emailExists
        ? "Email already exists"
        : getErrorMessage(error.value),
    })
    toast.add({
      title: emailExists
        ? "Email linked to an account"
        : getErrorMessage(error.value),
      color: "red",
      icon: "i-bx-error",
    })
    return null
  }

  const newUser = data.value?.data.newUser
  if (!newUser) return null

  token.value = data.value?.token || null
  authStore.setUser(newUser)
  usePosthogCapture("SIGNUP_CREATE_ACCOUNT_COMPLETED", {
    method: "email",
    userId: newUser._id,
    email: email.value,
    utmParams,
  })
  return newUser
}

const handleStep1 = async () => {
  if (step1Disabled.value) return

  signupMethod.value = "email"
  loading.value = true
  usePosthogCapture("SIGNUP_CREATE_ACCOUNT_ATTEMPTED", {
    method: "email",
    email: email.value,
  })

  const newUser = await createEmailAccount()
  if (newUser) {
    step.value = 2
  }
  loading.value = false
}

const handleStep2 = async () => {
  const fullNameValue = fullName.value.trim()
  if (!fullNameValue) return

  loading.value = true
  usePosthogCapture("SIGNUP_ADD_FULL_NAME_ATTEMPTED", {
    method: signupMethod.value,
    userId: authStore.user?._id,
    hasFullName: true,
  })

  if (!authStore.user?._id) {
    toast.add({
      title: "Please create your account first",
      color: "red",
      icon: "i-bx-error",
    })
    loading.value = false
    return
  }

  if (authStore.user.fullname !== fullNameValue) {
    const updatedUser = await updateUserProfile({ fullname: fullNameValue })
    if (!updatedUser) {
      usePosthogCapture("SIGNUP_ADD_FULL_NAME_FAILED", {
        method: signupMethod.value,
        userId: authStore.user?._id,
        error: "Failed to update full name",
      })
      loading.value = false
      return
    }
  }

  usePosthogCapture("SIGNUP_ADD_FULL_NAME_COMPLETED", {
    method: signupMethod.value,
    userId: authStore.user._id,
    fullName: fullNameValue,
  })
  step.value = 3
  loading.value = false
}

const handleStep3 = async () => {
  if (step3Disabled.value) return

  // If user already has a church (e.g. refreshed mid-flow), skip creation
  if (authStore.user?.churchId) {
    step.value = 4
    return
  }

  loading.value = true
  usePosthogCapture("SIGNUP_ADD_CHURCH_ATTEMPTED", {
    userId: authStore.user?._id,
    churchName: churchName.value,
    churchType: churchType.value,
    hasChurchPastor: !!ministryHead.value,
    isNotAChurch: !creatingForChurch.value,
  })

  const { data, error } = await useAPIFetch("/church", {
    method: "POST",
    body: {
      name: churchName.value,
      type: churchType.value,
      address: "",
      pastor: ministryHead.value,
      isNotAChurch: !creatingForChurch.value,
      userId: authStore.user?._id,
    },
  })

  if (error.value) {
    usePosthogCapture("SIGNUP_ADD_CHURCH_FAILED", {
      userId: authStore.user?._id,
      error: getErrorMessage(error.value as ApiErrorT),
    })
    toast.add({
      title: getErrorMessage(error.value as ApiErrorT),
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    const newChurch = normalizeChurchPayload(data.value as ChurchPayload)
    if (!newChurch?._id) {
      usePosthogCapture("SIGNUP_ADD_CHURCH_FAILED", {
        userId: authStore.user?._id,
        error: "Church response missing id",
      })
      toast.add({
        title: "Church created, but we could not read its ID",
        color: "red",
        icon: "i-bx-error",
      })
      loading.value = false
      return
    }

    authStore.setChurch(newChurch)
    authStore.setUser({ ...authStore.user, churchId: newChurch._id } as User)
    usePosthogCapture("SIGNUP_ADD_CHURCH_COMPLETED", {
      userId: authStore.user?._id,
      churchId: newChurch._id,
      churchName: newChurch.name,
      emailVerified: authStore.user?.emailVerified,
    })
    step.value = 4
  }
  loading.value = false
}

const addInvite = () => {
  const val = inviteInput.value.trim()
  if (useValidEmail(val) && !addedEmails.value.includes(val)) {
    addedEmails.value.push(val)
    inviteInput.value = ""
  }
}

const removeInvite = (index: number) => {
  addedEmails.value.splice(index, 1)
}

const handleStep4 = async () => {
  addInvite()

  if (addedEmails.value.length && authStore.user?.churchId) {
    loading.value = true
    await sendEmailInvitations(authStore.user.churchId, addedEmails.value)
    loading.value = false
  }
  step.value = 5
}

const handleStep5 = async () => {
  loading.value = true
  const tasks: Promise<any>[] = []

  if (phone.value) {
    tasks.push(updateUserProfile({ phone: phone.value }))
  }
  if (howYouFoundUs.value) {
    tasks.push(updateChurchProfile({ howYouFoundUs: howYouFoundUs.value }))
  }

  if (tasks.length) await Promise.all(tasks)
  loading.value = false
  await finishOnboarding()
}

const finishOnboarding = async () => {
  const planId = route.query.plan_id as string
  const churchId = authStore.church?._id

  if (authStore.user?.emailVerified) {
    usePosthogCapture("SIGNUP_COMPLETE", {
      userId: authStore.user._id,
      churchId,
      emailVerified: true,
      hasPlanId: !!planId,
    })

    if (planId) {
      usePosthogCapture("SIGNUP_COMPLETE_WITH_PLAN_ID", {
        planId,
        userId: authStore.user._id,
        churchId,
      })
    }

    // Stay on this last step and let the user decide on a plan right here
    // instead of bouncing to "/" first — closing the modal takes them home.
    awaitingUpgradeChoice.value = true
    useGlobalEmit(
      appWideActions.showUpgradeModal,
      planId ? { planId } : undefined
    )
  } else {
    usePosthogCapture("SIGNUP_COMPLETE_UNVERIFIED", {
      userId: authStore.user?._id,
      churchId,
      emailVerified: false,
      hasPlanId: !!planId,
    })
    if (planId) {
      try {
        localStorage.setItem("pending_plan_id", planId)
      } catch {
        // localStorage unavailable (private mode / SecurityError)
      }
    }
    goToVerify()
  }
}

const handleUpgradeModalClosed = () => {
  if (!awaitingUpgradeChoice.value) return
  awaitingUpgradeChoice.value = false
  navigateTo("/")
}

const goToVerify = () => {
  toast.add({
    title: "Please verify your email to proceed",
    icon: "i-bx-circle",
    color: "primary",
  })
  navigateTo("/verify?newUser=1")
}

const getChurch = async () => {
  if (user.value?.churchId) {
    const { data } = await useAPIFetch(`/church/${user.value?.churchId}`)
    authStore.setChurch(data.value as Church)
    navigateTo("/")
  } else if (!user.value) {
    navigateTo("/login")
  }
}

const handleGoogleSignUp = async () => {
  googleLoading.value = true
  signupMethod.value = "google"
  usePosthogCapture("SIGNUP_CREATE_ACCOUNT_ATTEMPTED", { method: "google" })

  try {
    const { user: gUser } = await googleSignIn()
    if (!gUser) return

    const idToken = await gUser.getIdToken()
    const utmParams = getUTMParams(route)
    const { data, error } = await useAPIFetch<SignupResponseT, ApiErrorT>(
      "/auth/signup/google",
      {
        method: "POST",
        headers: { "x-access-token": `Bearer ${idToken}` },
        body: { utmParams },
      }
    )

    if (error.value) {
      usePosthogCapture("SIGNUP_CREATE_ACCOUNT_FAILED", {
        method: "google",
        email: gUser?.email,
        error: error.value?.data?.error?.includes("E11000")
          ? "Email already exists"
          : error.value?.data?.message,
      })
      toast.add({
        title: error.value?.data?.error?.includes("E11000")
          ? "Email linked to an account. Sign in instead."
          : getErrorMessage(error.value),
        color: "red",
        icon: "i-bx-error",
      })
    } else {
      const newUser = data.value?.data.newUser
      if (!newUser) return

      token.value = data.value?.token || null
      authStore.setUser(newUser)
      fullName.value = newUser.fullname || gUser?.displayName || ""
      usePosthogCapture("SIGNUP_CREATE_ACCOUNT_COMPLETED", {
        method: "google",
        userId: newUser._id,
        email: gUser?.email,
        fullName: fullName.value,
        utmParams,
      })
      step.value = 2
    }
  } catch (error: any) {
    usePosthogCapture("SIGNUP_CREATE_ACCOUNT_FAILED", {
      method: "google",
      error: error?.message,
    })
    toast.add({
      title: "Google sign up failed",
      description: error?.message || "An error occurred",
      color: "red",
      icon: "i-bx-error",
    })
  } finally {
    googleLoading.value = false
  }
}

onMounted(() => {
  initUTMTracking(route)

  emitter.on(appWideActions.upgradeModalClosed, handleUpgradeModalClosed)

  usePosthogCapture("SIGNUP_PAGE_VIEWED", {
    step: route.query.registerChurch ? 3 : 1,
    hasReferral: !!route.query.from_lyrics,
    hasPlanId: !!route.query.plan_id,
  })

  const { fetchPlans, detectCurrency } = useSubscriptionPlans()
  detectCurrency()
  fetchPlans()

  if (route.query.registerChurch) {
    getChurch()
  }
  if (route.query.from_lyrics) {
    usePosthogCapture("OPENED_SIGNUP_FROM_LYRICS")
  }
})

onBeforeUnmount(() => {
  emitter.off(appWideActions.upgradeModalClosed, handleUpgradeModalClosed)

  signupVisualState.value = {
    step: 1,
    fullName: "",
    churchName: "",
    churchType: "",
    churchPastor: "",
    creatingForChurch: true,
    invitedEmails: [],
  }
})
</script>

<style scoped>
.signup-invite-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.65rem 0.3rem 0.75rem;
  border-radius: 999px;
  font-size: 0.8rem;
  background-color: #f1f5f9;
  color: #0f172a;
}

.signup-invite-chip__remove {
  display: flex;
  align-items: center;
  opacity: 0.55;
  transition: opacity 0.15s;
}

.signup-invite-chip__remove:hover {
  opacity: 1;
}
</style>

<style>
html.dark .signup-invite-chip {
  background-color: rgba(148, 163, 184, 0.12);
  color: #f1f5f9;
}
</style>
