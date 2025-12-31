<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Verify your email address
        <span class="font-semibold">Cloud of Worship</span>
      </p>
    </div>
    <form class="flex flex-col gap-3 max-w-[325px] mx-auto">
      <UFormGroup size="lg" class="relative">
        <UInput placeholder="Your email" v-model="email" disabled />
        <p
          class="text-sm flex justify-end gap-0 absolute top-0 right-2 z-10 pt-2"
        >
          <UButton size="xs" class="p-1 px-2" to="/?email_change=1"
            >Change email</UButton
          >
        </p>
      </UFormGroup>
      <UFormGroup size="lg">
        <UInput
          placeholder="Your verification code"
          type="text"
          class="w-[100%]"
          v-model="verificationCode"
        />
      </UFormGroup>

      <UButton
        block
        size="lg"
        class="mt-12"
        :disabled="!(useValidEmail(email) && verificationCode.length >= 6)"
        :loading="loading"
        @click="verifyEmail"
      >
        Verify email
      </UButton>
      <p class="text-sm flex items-center justify-center gap-0">
        I didn't receive any code
        <UButton
          size="sm"
          class="p-1"
          variant="link"
          to="#"
          :loading="resendLoading"
          :disabled="codeResentTimes >= 3"
          @click="resendCode"
          >Resend code</UButton
        >
      </p>
    </form>
  </div>
</template>
<script setup lang="ts">
import { useAuthStore } from "~/store/auth"

definePageMeta({
  layout: "auth",
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

const email = ref(authStore.user?.email || "")
const verificationCode = ref("")
const loading = ref(false)
const resendLoading = ref(false)
const codeResentTimes = ref(0)
const router = useRouter()

// Store reference to upgrade modal
const showUpgradeModalWithPlan = ref(false)
const pendingPlanId = ref<string | null>(null)

onMounted(() => {
  usePosthogCapture("EMAIL_VERIFICATION_PAGE_VIEWED", {
    email: email.value,
  })

  // Fetch subscription plans and detect currency early
  const { fetchPlans, detectCurrency } = useSubscriptionPlans()
  detectCurrency() // Start currency detection in background
  fetchPlans()

  // Check if there's a pending plan_id from signup
  const storedPlanId = localStorage.getItem("pending_plan_id")
  if (storedPlanId) {
    pendingPlanId.value = storedPlanId
  }

  resendCode()
})

const verifyEmail = async () => {
  loading.value = true

  usePosthogCapture("EMAIL_VERIFICATION_ATTEMPTED", {
    email: email.value,
  })

  const { data, error } = await useAPIFetch("/auth/verify-email", {
    method: "POST",
    body: {
      token: verificationCode.value,
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
    if (pendingPlanId.value) {
      // Clear the stored plan_id
      localStorage.removeItem("pending_plan_id")

      usePosthogCapture("UPGRADE_MODAL_OPENED_AFTER_VERIFICATION", {
        planId: pendingPlanId.value,
        email: email.value,
      })

      // Navigate to index page first
      await router.push("/")

      // Wait for navigation to complete and show modal
      setTimeout(() => {
        useGlobalEmit("show-upgrade-modal", { planId: pendingPlanId.value })
      }, 500)
    } else {
      // Normal flow - just navigate to index
      router.push("/")
    }

    loading.value = false
  }
}

const resendCode = async () => {
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
  codeResentTimes.value += 1
}

// If error occurred
</script>

<style scoped></style>
