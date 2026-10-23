<template>
  <section class="flex flex-col gap-2">
    <SettingsRow :label="user?.email ?? ''">
      <template #description>
        <span
          class="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
          :class="
            unverified
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
              : 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300'
          "
        >
          {{ unverified ? "Not verified" : "Verified" }}
        </span>
      </template>

      <CowButton
        v-if="unverified"
        variant="secondary"
        size="md"
        @click="goVerify"
      >
        Verify email
      </CowButton>
      <CowButton
        v-else-if="!isGoogleAccount && !open"
        variant="secondary"
        size="md"
        @click="open = true"
      >
        Change email
      </CowButton>
    </SettingsRow>

    <p
      v-if="isGoogleAccount"
      class="px-1 text-xs leading-relaxed text-gray-500 dark:text-[#9aa3b2]"
    >
      You sign in with Google, so this email is managed by your Google account.
    </p>

    <form
      v-if="open"
      class="flex max-w-[420px] flex-col gap-3 pt-1"
      @submit.prevent="step === 'details' ? sendCode() : confirm()"
    >
      <template v-if="step === 'details'">
        <CowInput
          v-model="newEmail"
          label="New email"
          type="email"
          autocomplete="email"
          :error="emailError"
        />
        <CowInput
          v-model="password"
          label="Current password"
          type="password"
          autocomplete="current-password"
          :error="passwordError"
        />
        <p class="px-1 text-xs text-gray-500 dark:text-[#9aa3b2]">
          We will email a code to the new address. Your email will not change
          until you enter it.
        </p>
      </template>

      <template v-else>
        <p class="px-1 text-sm text-gray-600 dark:text-[#a7afbd]">
          We sent a code to <strong>{{ newEmail }}</strong
          >. It expires in 10 minutes.
        </p>
        <CowInput
          v-model="code"
          label="Code"
          autocomplete="one-time-code"
          autocapitalize="characters"
          :error="codeError"
        />
        <p class="px-1 text-xs text-gray-500 dark:text-[#9aa3b2]">
          Did not get it?
          <button
            type="button"
            class="font-medium text-primary-500 hover:underline disabled:opacity-50 disabled:no-underline"
            :disabled="loading || resendCooldown > 0"
            @click="sendCode()"
          >
            {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code" }}
          </button>
        </p>
      </template>

      <div class="flex items-center gap-2 pt-1">
        <CowButton
          variant="secondary"
          size="md"
          :disabled="loading"
          @click="step === 'code' ? (step = 'details') : close()"
        >
          {{ step === "code" ? "Back" : "Cancel" }}
        </CowButton>
        <CowButton
          type="submit"
          size="md"
          :loading="loading"
          :disabled="step === 'details' ? !canSendCode : !code.trim()"
        >
          {{ step === "details" ? "Send code" : "Confirm email" }}
        </CowButton>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"

const authStore = useAuthStore()
const toast = useToast()
const { requestEmailChange, confirmEmailChange, loading } = useUser()

const user = computed(() => authStore.user)
const unverified = computed(() => user.value?.emailVerified === false)
const isGoogleAccount = computed(() => user.value?.signupMethod === "google")

const goVerify = () => navigateTo("/verify")

const open = ref(false)
const step = ref<"details" | "code">("details")
const newEmail = ref("")
const password = ref("")
const code = ref("")
const emailError = ref("")
const passwordError = ref("")
const codeError = ref("")

const canSendCode = computed(
  () => !!newEmail.value.trim() && !!password.value
)

// Resending is allowed after a short pause so a held-down button cannot fill
// someone's inbox; the API rate-limits as well.
const resendCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null
const startCooldown = () => {
  resendCooldown.value = 30
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value -= 1
    if (resendCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}
onBeforeUnmount(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})

const reset = () => {
  step.value = "details"
  newEmail.value = ""
  password.value = ""
  code.value = ""
  emailError.value = ""
  passwordError.value = ""
  codeError.value = ""
}

const close = () => {
  open.value = false
  reset()
}

const sendCode = async () => {
  emailError.value = ""
  passwordError.value = ""

  const email = newEmail.value.trim()
  if (!useValidEmail(email)) {
    step.value = "details"
    emailError.value = "Enter a valid email address."
    return
  }
  if (email.toLowerCase() === user.value?.email?.toLowerCase()) {
    step.value = "details"
    emailError.value = "That is already your email."
    return
  }

  const result = await requestEmailChange(email, password.value)
  if (!result.ok) {
    step.value = "details"
    if (result.code === "INVALID_CURRENT_PASSWORD") {
      passwordError.value = result.message || ""
    } else if (result.code === "GOOGLE_ACCOUNT") {
      close()
      toast.add({ title: result.message, color: "red", icon: "i-bx-error" })
    } else {
      emailError.value = result.message || ""
    }
    return
  }

  step.value = "code"
  code.value = ""
  codeError.value = ""
  startCooldown()
}

const confirm = async () => {
  codeError.value = ""
  const result = await confirmEmailChange(code.value.trim())
  if (!result.ok) {
    codeError.value = result.message || "That code is wrong or has expired."
    return
  }
  close()
}
</script>
