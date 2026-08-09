<template>
  <div class="w-full flex flex-col items-center">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-32 h-32 mb-12" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        Forgot password?
      </h1>
      <p
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"
      >
        Please enter the email linked to your account. A reset link will be sent
        to this address.
      </p>
    </div>

    <form
      class="w-full flex flex-col gap-4 come-up-2"
      @submit.prevent="requestReset"
    >
      <CowInput label="Email address" type="email" v-model="email" />

      <CowButton
        block
        type="submit"
        :disabled="!useValidEmail(email)"
        :loading="loading"
      >
        Continue
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        Remember your password?
        <NuxtLink
          to="/login"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
        >
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
const successMessage = (targetEmail: string) =>
  `If an account exists for ${targetEmail}, a password reset email will be sent. Check your inbox.`

const requestReset = async () => {
  loading.value = true
  const { error } = await useAPIFetch<{ data: string }>(
    "/auth/request-password-reset",
    {
      method: "POST",
      body: {
        email: email.value,
      },
    }
  )

  if (error.value) {
    toast.add({
      title: "Something went wrong. Please try again.",
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    toast.add({
      title: successMessage(email.value),
      color: "green",
      icon: "i-bx-check-circle",
    })
  }
  loading.value = false
}
</script>

<style scoped></style>
