<template>
  <div class="w-full flex flex-col items-center text-center">
    <Logo class="w-20 h-20 mb-8" />
    <h1
      class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
    >
      {{ copy.title }}
    </h1>
    <p
      class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"
    >
      {{ copy.message }}
    </p>

    <CowButton
      v-if="state === 'signin'"
      class="mt-8"
      to="/login"
    >
      Log in
    </CowButton>
    <CowButton
      v-else-if="state === 'done' || state === 'error'"
      class="mt-8"
      variant="secondary"
      to="/"
    >
      Back to Cloud of Worship
    </CowButton>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"

definePageMeta({
  layout: "auth",
  authVariant: "centered",
})

useHead({
  title: "Unsubscribe - Cloud of Worship",
})

type State = "loading" | "done" | "error" | "signin"

const route = useRoute()
const authStore = useAuthStore()
const { token: sessionToken } = useAuthToken()

const state = ref<State>("loading")
const email = ref("")

const copy = computed(() => {
  switch (state.value) {
    case "done":
      return {
        title: "You're unsubscribed",
        message: `We won't send ${email.value || "you"} any more product or campaign emails. Account and billing notices will still reach you.`,
      }
    case "error":
      return {
        title: "That link didn't work",
        message:
          "We couldn't unsubscribe you from this link. Reply to any of our emails and we'll take you off the list by hand.",
      }
    case "signin":
      return {
        title: "Log in to unsubscribe",
        message:
          "This link doesn't say which account it's for. Log in, then open this page again, or reply to any of our emails and we'll take you off the list.",
      }
    default:
      return { title: "Unsubscribing", message: "Just a moment." }
  }
})

onMounted(async () => {
  const linkToken =
    typeof route.query.token === "string" ? route.query.token : ""

  // A link with no token can only be honoured for a signed-in user.
  if (!linkToken && !sessionToken.value && !authStore.user?._id) {
    state.value = "signin"
    return
  }

  const { data, error } = await useAPIFetch<{ email: string }>(
    "/email/unsubscribe",
    {
      method: "POST",
      body: linkToken ? { token: linkToken } : {},
    }
  )

  if (error.value || !data.value) {
    state.value = "error"
    return
  }

  email.value = data.value.email
  state.value = "done"
})
</script>
