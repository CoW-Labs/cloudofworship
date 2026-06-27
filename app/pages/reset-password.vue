<template>
  <div class="w-full flex flex-col items-center">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-14 h-14 mb-7" />
      <h1 class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3">Reset password</h1>
      <p class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]">
        Kindly enter your new preferred password in the input fields below
      </p>
    </div>

    <div
      v-if="!hasResetParams"
      class="w-full flex flex-col gap-4 come-up-2"
    >
      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        This password reset link is missing required information. Please request
        a new reset link.
      </p>
      <CowButton block type="button" @click="navigateTo('/forgot-password')">
        Request new link
      </CowButton>
    </div>

    <form
      v-else
      class="w-full flex flex-col gap-4 come-up-2"
      @submit.prevent="resetPassword"
    >
      <div>
        <CowInput label="New password" type="password" v-model="password" />
        <div class="help text-gray-500 dark:text-gray-400 text-xs mt-2 flex gap-2">
          <IconWrapper name="i-bx-info-circle" size="3" />
          Password must be at least 8 characters and include a letter and a
          number.
        </div>
      </div>

      <CowInput
        label="Confirm password"
        type="password"
        v-model="confirmPassword"
        :error="confirmError"
      />

      <CowButton
        block
        type="submit"
        :disabled="!isValid"
        :loading="loading"
      >
        Continue
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        Remember your password?
        <NuxtLink to="/login" class="text-primary-500 dark:text-primary-400 font-medium hover:underline">
          Log in
        </NuxtLink>
      </p>
    </form>
  </div>
</template>
<script setup lang="ts">
definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Reset Password - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "Create a new password for your Cloud of Worship account. Enter your email and new password to regain access to your church presentation tools.",
    },
    {
      name: "keywords",
      content:
        "reset password, change password, password recovery, Cloud of Worship password, account recovery, church software password",
    },
    { property: "og:title", content: "Reset Password - Cloud of Worship" },
    {
      property: "og:description",
      content:
        "Create a new password for your Cloud of Worship account. Regain access to your church presentation tools.",
    },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Reset Password - Cloud of Worship" },
    {
      name: "twitter:description",
      content:
        "Create a new password for your Cloud of Worship account and regain access.",
    },
  ],
})

const toast = useToast()
const route = useRoute()
const password = ref("")
const confirmPassword = ref("")
const loading = ref(false)

const email = computed(() => (route.query.email as string) || "")
const resetToken = computed(() => (route.query.token as string) || "")
const hasResetParams = computed(() =>
  Boolean(useValidEmail(email.value) && resetToken.value)
)
const passwordValid = computed(() => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password.value))

const confirmError = computed(() => {
  if (!confirmPassword.value) return ""
  return password.value === confirmPassword.value ? "" : "Passwords do not match"
})

const isValid = computed(
  () =>
    hasResetParams.value &&
    passwordValid.value &&
    password.value === confirmPassword.value
)

const resetPassword = async () => {
  if (!isValid.value) return
  loading.value = true
  const { error } = await useAPIFetch("/auth/reset-password", {
    method: "POST",
    body: {
      email: email.value,
      token: resetToken.value,
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
    toast.add({
      title: `Successful reset password. Back to login page.`,
      color: "green",
      icon: "i-bx-check-circle",
    })
    navigateTo("/login")
  }
  loading.value = false
}
</script>

<style scoped></style>
