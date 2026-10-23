<template>
  <div v-if="step" class="w-full flex flex-col items-center">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-32 h-32 mb-12" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        {{ heading }}
      </h1>
      <p
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"
      >
        <template v-if="step === 'invalid'">
          This sign-in link is incomplete or has expired. Start again from the
          Cloud of Worship desktop app.
        </template>
        <template v-else-if="step === 'ready'">
          You're signed in as
          <span class="font-semibold text-gray-900 dark:text-white">
            {{ authStore.user?.email }}</span
          >. Only continue if you started signing in from the Cloud of Worship
          desktop app.
        </template>
        <template v-else>
          If the desktop app didn't open, paste this code into it. The code
          works once and expires in 5 minutes.
        </template>
      </p>
    </div>

    <div v-if="step === 'ready'" class="w-full flex flex-col gap-3.5 come-up-2">
      <CowButton block :loading="loading" @click="handOff">
        Open the desktop app
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        Not you?
        <button
          type="button"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
          @click="authStore.signOut()"
        >
          Use another account.
        </button>
      </p>
    </div>

    <div
      v-else-if="step === 'sent'"
      class="w-full flex flex-col gap-3.5 come-up-2"
    >
      <CowInput label="Your sign-in code" :model-value="code" readonly />

      <CowButton variant="secondary" block @click="copyCode">
        <UIcon
          :name="copied ? 'i-bx-check-circle' : 'i-bx-clipboard'"
          class="w-5 h-5"
        />
        Copy code
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        <a
          :href="link"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
        >
          Open the desktop app again
        </a>
      </p>
    </div>

    <CowButton
      v-else
      block
      class="come-up-2"
      @click="navigateTo('/')"
    >
      Continue to Cloud of Worship
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
  title: "Sign in to the desktop app - Cloud of Worship",
})

const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const { getToken } = useAuthToken()

// Unset until mounted, so a signed-out visitor is redirected without first
// seeing the signed-in screen.
const step = ref<"invalid" | "ready" | "sent" | null>(null)
const loading = ref(false)
const code = ref("")
const link = ref("")
const copied = ref(false)

const heading = computed(
  () =>
    ({
      invalid: "Link expired",
      ready: "Open the desktop app",
      sent: "Back to the desktop app",
    })[step.value || "ready"]
)

const handOff = async () => {
  const handoff = readDesktopHandoff()
  if (!handoff) {
    step.value = "invalid"
    return
  }

  loading.value = true
  try {
    const issued = await issueDesktopSigninCode(handoff)
    code.value = issued.code
    link.value = issued.link
    // Done with it: "/" should open the web app again, not come back here.
    clearDesktopHandoff()
    step.value = "sent"
    usePosthogCapture("DESKTOP_SIGNIN_HANDED_OFF")
    window.location.href = issued.link
  } catch (error: any) {
    toast.add({
      title: error?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } finally {
    loading.value = false
  }
}

const copyCode = async () => {
  await navigator.clipboard.writeText(code.value)
  copied.value = true
  toast.add({
    title: "Code copied to clipboard",
    color: "green",
    icon: "i-bx-check-circle",
  })
  setTimeout(() => {
    copied.value = false
  }, 3000)
}

onMounted(() => {
  const handoff = rememberDesktopHandoff(route.query)
  if (!handoff) {
    step.value = "invalid"
    return
  }

  // Signed out: sign in (or up) as usual. The auth middleware brings the
  // browser back here once that lands on "/".
  if (!getToken() && !authStore.user?._id) {
    toast.add({
      title: "Sign in to continue to the desktop app",
      icon: "i-bx-info-circle",
      color: "primary",
    })
    navigateTo(handoff.intent === "signup" ? "/signup" : "/login")
    return
  }

  step.value = "ready"
})
</script>
