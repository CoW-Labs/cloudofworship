<template>
  <div class="login-main section">
    <div class="header flex flex-col items-center text-center mb-12">
      <Logo class="w-28 h-28" />
      <p class="max-w-[200px] mx-auto">
        Forgot your password for
        <span class="font-semibold">Cloud of Worship</span>
      </p>
    </div>
    <form
      class="flex flex-col gap-3 max-w-[325px] mx-auto"
      @submit="requestReset"
    >
      <UFormGroup size="lg">
        <UInput placeholder="Your email" v-model="email" />
      </UFormGroup>

      <UButton
        block
        size="lg"
        class="mt-6"
        type="submit"
        :disabled="!useValidEmail(email)"
        :loading="loading"
        @click="requestReset"
      >
        Send Reset Email
      </UButton>
      <p class="text-sm flex items-center justify-center gap-0">
        Remember your password?
        <UButton size="sm" class="p-1" variant="link" to="/login"
          >Log in</UButton
        >
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "auth",
})

// SEO Meta Tags
useHead({
  title: "Forgot Password - Cloud of Worship",
  meta: [
    {
      name: "description",
      content:
        "Reset your Cloud of Worship password. Enter your email to receive a password reset link and regain access to your church presentation software account.",
    },
    {
      name: "keywords",
      content:
        "forgot password, reset password, cloud of worship, church software, password recovery, account access",
    },
    // Open Graph
    {
      property: "og:title",
      content: "Forgot Password - Cloud of Worship",
    },
    {
      property: "og:description",
      content:
        "Reset your Cloud of Worship password. Enter your email to receive a password reset link.",
    },
    {
      property: "og:type",
      content: "website",
    },
    // Twitter Card
    {
      name: "twitter:card",
      content: "summary",
    },
    {
      name: "twitter:title",
      content: "Forgot Password - Cloud of Worship",
    },
    {
      name: "twitter:description",
      content:
        "Reset your Cloud of Worship password and regain access to your account.",
    },
  ],
})

const toast = useToast()
const email = ref("")
const loading = ref(false)

const requestReset = async () => {
  loading.value = true
  const { data, error } = await useAPIFetch<{ data: string }>(
    "/auth/request-password-reset",
    {
      method: "POST",
      body: {
        email: email.value,
      },
    }
  )

  // If error occurred
  if (error.value) {
    toast.add({
      title: error.value?.data?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    toast.add({
      title:
        data.value?.data ||
        `Password reset email sent to ${email.value}. Check your inbox.`,
      color: "green",
      icon: "i-bx-check-circle",
    })
    // Optionally navigate to login or stay
  }
  loading.value = false
}
</script>

<style scoped></style>
