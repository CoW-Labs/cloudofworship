<template>
  <div class="w-full flex flex-col items-center">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-20 h-20 mb-10" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        Verify your account
      </h1>

      <p
        v-if="!editingEmail"
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"
      >
        Enter the code sent to
        <button
          type="button"
          class="font-semibold text-gray-900 dark:text-white hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          @click="beginEmailEdit"
        >
          {{ email }}
        </button>
        to complete your verification.
      </p>

      <div v-else class="w-full max-w-[22rem] space-y-3 come-up-1">
        <CowInput
          label="Email address"
          type="email"
          v-model="editableEmail"
          @keyup.enter="saveEmail"
        />
        <div class="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            :disabled="savingEmail"
            @click="cancelEmailEdit"
          >
            Cancel
          </button>
          <button
            type="button"
            class="font-medium text-primary-500 dark:text-primary-400 hover:underline disabled:opacity-50"
            :disabled="savingEmail || !useValidEmail(editableEmail)"
            @click="saveEmail"
          >
            {{ savingEmail ? "Saving..." : "Save email" }}
          </button>
        </div>
      </div>
    </div>

    <form
      class="w-full flex flex-col gap-4 come-up-2"
      @submit.prevent="verifyEmail"
    >
      <div class="relative">
        <CowInput
          class="verify-code-input"
          label="Input verification code"
          type="text"
          inputmode="text"
          autocapitalize="characters"
          autocomplete="one-time-code"
          v-model="verificationCode"
          @update:model-value="handleVerificationCodeInput"
        />
        <span
          v-if="resendCooldown > 0"
          class="verify-code-timer text-sm text-gray-400 dark:text-gray-500"
        >
          {{ resendCooldown }}s
        </span>
      </div>

      <CowButton
        block
        type="submit"
        class="mt-3"
        :disabled="
          editingEmail ||
          !(useValidEmail(email) && verificationCode.length >= 6)
        "
        :loading="loading"
      >
        Verify code
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        Did not receive it?
        <button
          type="button"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline disabled:opacity-50 disabled:no-underline"
          :disabled="
            resendLoading || resendCooldown > 0 || codeResentTimes >= 3
          "
          @click="resendCode"
        >
          {{ resendLoading ? "Sending..." : "Resend code" }}
        </button>
      </p>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAuthStore } from "~/store/auth"
import type { User } from "~/store/auth"

definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Verify Email - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "Verify your email address to activate your Cloud of Worship account and access all church presentation features including worship slides, lyrics, and media management.",
    },
    {
      name: "keywords",
      content:
        "email verification, verify account, Cloud of Worship verification, account activation, confirm email, church software verification",
    },
    { property: "og:title", content: "Verify Email - Cloud of Worship" },
    {
      property: "og:description",
      content:
        "Verify your email address to activate your Cloud of Worship account and access all church presentation features.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Verify Email - Cloud of Worship" },
    {
      name: "twitter:description",
      content:
        "Verify your email address to activate your Cloud of Worship account.",
    },
  ],
})

const authStore = useAuthStore()
const toast = useToast()
const { getToken } = useAuthToken()

const email = ref(authStore.user?.email || "")
const editableEmail = ref(email.value)
const verificationCode = ref("")
const loading = ref(false)
const resendLoading = ref(false)
const savingEmail = ref(false)
const editingEmail = ref(false)
const codeResentTimes = ref(0)
const resendCooldown = ref(0)
const router = useRouter()
const route = useRoute()
let resendCooldownTimer: ReturnType<typeof setInterval> | null = null

// Store reference to upgrade modal
const showUpgradeModalWithPlan = ref(false)
const pendingPlanId = ref<string | null>(null)

const beginEmailEdit = () => {
  editableEmail.value = email.value
  editingEmail.value = true
}

const handleVerificationCodeInput = (value: string | number) => {
  verificationCode.value = String(value || "").toUpperCase()
}

const cancelEmailEdit = () => {
  editableEmail.value = email.value
  editingEmail.value = false
}

const startResendCooldown = () => {
  if (resendCooldownTimer) clearInterval(resendCooldownTimer)
  resendCooldown.value = 120
  resendCooldownTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0 && resendCooldownTimer) {
      clearInterval(resendCooldownTimer)
      resendCooldownTimer = null
    }
  }, 1000)
}

const saveEmail = async () => {
  const nextEmail = editableEmail.value.trim()
  if (!useValidEmail(nextEmail)) return

  if (nextEmail === email.value) {
    editingEmail.value = false
    return
  }

  savingEmail.value = true
  const { data, error } = await useAPIFetch<User>("/user/update", {
    method: "PUT",
    body: { email: nextEmail },
  })

  if (error.value) {
    toast.add({
      title: error.value?.data?.message || "Could not update email",
      color: "red",
      icon: "i-bx-error",
    })
    savingEmail.value = false
    return
  }

  if (data.value) {
    authStore.setUser(data.value)
  }

  email.value = nextEmail
  editableEmail.value = nextEmail
  verificationCode.value = ""
  codeResentTimes.value = 0
  resendCooldown.value = 0
  if (resendCooldownTimer) {
    clearInterval(resendCooldownTimer)
    resendCooldownTimer = null
  }
  editingEmail.value = false
  savingEmail.value = false

  await resendCode()
}

onMounted(async () => {
  if (!getToken()) {
    navigateTo("/login")
    return
  }

  if (!email.value) {
    const { data } = await useAPIFetch<User>("/user/auth")
    if (data.value) {
      authStore.setUser(data.value)
      email.value = data.value.email
      editableEmail.value = data.value.email
    }
  }

  if (authStore.user?.emailVerified) {
    navigateTo("/")
    return
  }

  if (!email.value) {
    toast.add({
      title: "Please sign in again so we can verify your email",
      color: "red",
      icon: "i-bx-error",
    })
    navigateTo("/login")
    return
  }

  usePosthogCapture("EMAIL_VERIFICATION_PAGE_VIEWED", {
    email: email.value,
  })

  // Fetch subscription plans and detect currency early
  const { fetchPlans, detectCurrency } = useSubscriptionPlans()
  detectCurrency() // Start currency detection in background
  fetchPlans()

  // Check if there's a pending plan_id from signup
  try {
    const storedPlanId = localStorage.getItem("pending_plan_id")
    if (storedPlanId) {
      pendingPlanId.value = storedPlanId
    }
  } catch {
    // localStorage unavailable (private mode / SecurityError)
  }

  resendCode()
})

const verifyEmail = async () => {
  const normalizedVerificationCode = verificationCode.value.toUpperCase()
  verificationCode.value = normalizedVerificationCode
  loading.value = true

  usePosthogCapture("EMAIL_VERIFICATION_ATTEMPTED", {
    email: email.value,
  })

  const { data, error } = await useAPIFetch("/auth/verify-email", {
    method: "POST",
    body: {
      token: normalizedVerificationCode,
    },
  })

  // If error occurred
  if (error.value) {
    usePosthogCapture("EMAIL_VERIFICATION_FAILED", {
      email: email.value,
      error: error.value?.data?.message,
    })

    toast.add({
      title: error.value?.data?.message,
      color: "red",
      icon: "i-bx-error",
    })
    loading.value = false
  } else {
    usePosthogCapture("EMAIL_VERIFICATION_SUCCESSFUL", {
      email: email.value,
      hasPendingPlanId: !!pendingPlanId.value,
    })

    toast.add({
      title: "Email successfully verified",
      color: "green",
      icon: "i-bx-check-circle",
    })

    // Check if there's a pending plan_id to show upgrade modal
    loading.value = false

    if (pendingPlanId.value) {
      try {
        localStorage.removeItem("pending_plan_id")
      } catch {
        // localStorage unavailable
      }
    }

    // New signups reach verify as the tail end of onboarding — surface the
    // plan chooser once they're back on the signup screen, whether or not a
    // plan was preselected.
    const isNewUserOnboarding = !!route.query.newUser || !!pendingPlanId.value

    if (isNewUserOnboarding) {
      const planId = pendingPlanId.value
      await router.push("/signup")

      const isOnTeamsPlan = authStore.church?.subscriptionPlan === "teams"
      if (!isOnTeamsPlan) {
        usePosthogCapture("UPGRADE_MODAL_OPENED_AFTER_VERIFICATION", {
          planId,
          email: email.value,
        })

        setTimeout(() => {
          useGlobalEmit("show-upgrade-modal", planId ? { planId } : undefined)
        }, 500)
      }
    } else {
      router.push("/")
    }
  }
}

const resendCode = async () => {
  if (!useValidEmail(email.value) || codeResentTimes.value >= 3) return

  resendLoading.value = true

  usePosthogCapture("EMAIL_VERIFICATION_CODE_RESEND_REQUESTED", {
    email: email.value,
    attemptNumber: codeResentTimes.value + 1,
  })

  const { data, error } = await useAPIFetch("/auth/send-verify-email", {
    method: "POST",
    body: {
      email: email.value,
    },
  })
  if (data.value) {
    usePosthogCapture("EMAIL_VERIFICATION_CODE_SENT", {
      email: email.value,
      attemptNumber: codeResentTimes.value + 1,
    })

    toast.add({
      title: `Code sent to ${email.value}`,
      color: "green",
      icon: "i-bx-check-circle",
    })
    codeResentTimes.value += 1
    startResendCooldown()
  }

  if (error.value) {
    usePosthogCapture("EMAIL_VERIFICATION_CODE_SEND_FAILED", {
      email: email.value,
      error: error.value?.data?.msg,
    })

    toast.add({
      title: error.value?.data?.msg,
      color: "red",
      icon: "i-bx-error",
    })
  }

  resendLoading.value = false
}

onBeforeUnmount(() => {
  if (resendCooldownTimer) {
    clearInterval(resendCooldownTimer)
  }
})

// If error occurred
</script>

<style scoped>
.verify-code-timer {
  position: absolute;
  right: 1.25rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.verify-code-input :deep(.cow-input__control) {
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}
</style>
