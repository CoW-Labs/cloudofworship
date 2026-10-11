<template>
  <div class="w-full flex flex-col items-center">
    <div class="flex flex-col items-center text-center mb-8 come-up-1">
      <Logo class="w-14 h-14 mb-7" />
      <h1
        class="text-[2.5rem] lg:text-[2rem] xl:text-[2.5rem] leading-none font-bold mb-3"
      >
        {{ copy.heading }}
      </h1>
      <p
        class="text-gray-500 dark:text-gray-400 text-[15px] lg:text-[13px] xl:text-[15px] max-w-[22rem]"
      >
        {{ copy.description }}
      </p>
    </div>

    <form
      class="w-full flex flex-col gap-4 come-up-2"
      @submit.prevent="submit"
    >
      <CowInput
        v-model="typed"
        class="schedule-code-input"
        label="Schedule code"
        :error="error"
        :maxlength="MAX_TYPED_LENGTH"
        autocomplete="off"
        autocapitalize="characters"
        autocorrect="off"
        spellcheck="false"
        autofocus
      />

      <CowButton
        block
        type="submit"
        :disabled="code.length !== SCHEDULE_CODE_LENGTH"
        :loading="loading"
      >
        Continue
      </CowButton>

      <p class="text-sm text-center text-gray-500 dark:text-gray-400">
        {{ copy.otherPrompt }}
        <NuxtLink
          :to="copy.otherTo"
          class="text-primary-500 dark:text-primary-400 font-medium hover:underline"
        >
          {{ copy.otherLabel }}
        </NuxtLink>
      </p>
    </form>
  </div>
</template>

<script setup lang="ts">
import {
  SCHEDULE_CODE_LENGTH,
  isScheduleCode,
  normalizeScheduleCode,
} from "~/utils/scheduleCode"

/**
 * Asks for a schedule code and opens the public viewer for it. Shown at
 * `/livestream` and `/stagestream` when they are opened without one, and as
 * the place a bad or mistyped code lands (see the schedule-code middleware).
 * Wrapped by the page, which owns the layout, the same way the auth pages are.
 */
const props = defineProps<{
  destination: "livestream" | "stagestream"
}>()

const route = useRoute()
const { resolve } = useScheduleCodeLookup()

const copyByDestination = {
  livestream: {
    heading: "Watch the livestream",
    description:
      "Enter the 6-character code from the person running the service to see what is on screen.",
    otherPrompt: "Looking for the stage display?",
    otherLabel: "Open it instead",
    otherTo: "/stagestream",
  },
  stagestream: {
    heading: "Open the stage display",
    description:
      "Enter the 6-character schedule code to see what is playing now, what is next and the clocks.",
    otherPrompt: "Looking for the livestream?",
    otherLabel: "Open it instead",
    otherTo: "/livestream",
  },
} as const
const copy = computed(() => copyByDestination[props.destination])

const messages = {
  "not-found":
    "We couldn't find a schedule with that code. Check it and try again.",
  "rate-limited":
    "Too many attempts. Please wait a few minutes and try again.",
  unreachable:
    "Couldn't reach Cloud of Worship. Check your connection and try again.",
} as const

// What is in the box is left as typed (uppercased by CSS): rewriting it on every
// keystroke fights the cursor. A little slack over the code length lets a
// pasted "BK3 N9Z" or "BK3-N9Z" through; `code` is the tidied version.
const MAX_TYPED_LENGTH = SCHEDULE_CODE_LENGTH + 3

// A redirect from the middleware brings back the code that failed, and why.
const reasonFromRoute = route.query.reason as keyof typeof messages | undefined
const typed = ref(
  normalizeScheduleCode(route.query.code).slice(0, SCHEDULE_CODE_LENGTH)
)
const code = computed(() => normalizeScheduleCode(typed.value))
const error = ref(reasonFromRoute ? (messages[reasonFromRoute] ?? "") : "")
const loading = ref(false)

watch(typed, () => {
  error.value = ""
})

const submit = async () => {
  if (loading.value || code.value.length !== SCHEDULE_CODE_LENGTH) return

  // Codes never contain 0/O, 1/I/L or a vowel, so a typo of those is caught
  // here without a round trip.
  if (!isScheduleCode(code.value)) {
    error.value = messages["not-found"]
    return
  }

  loading.value = true
  const result = await resolve(code.value)
  loading.value = false

  if (result.status === "found") {
    await navigateTo(`/${props.destination}/${code.value}`)
    return
  }
  error.value = messages[result.status]
}
</script>

<style scoped>
.schedule-code-input :deep(.cow-input__control) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}
</style>
