<template>
  <UModal
    v-model="visible"
    :ui="{
      width: 'sm:max-w-[420px]',
      background: '',
      ring: '',
      shadow: '',
      rounded: 'rounded-2xl',
      padding: 'p-0',
      overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
    }"
  >
    <!-- Compact sibling of FeatureIntroductionModal: same card shell, two actions. -->
    <div
      class="rounded-2xl bg-white dark:bg-[#1b2233] shadow-[0_24px_48px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
    >
      <div class="flex items-center justify-between gap-4 pt-3.5 pb-3 pl-5 pr-4">
        <span class="text-[15px] font-medium text-gray-700 dark:text-[#e8ebf2]">
          {{ eyebrow }}
        </span>
        <button
          type="button"
          class="grid place-items-center w-7 h-7 rounded-lg text-gray-500 hover:bg-black/[0.06] hover:text-gray-900 dark:text-[#9aa3b2] dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
          aria-label="Close"
          @click="snooze"
        >
          <CloseIcon class="w-4 h-4" />
        </button>
      </div>

      <div class="mx-3 mb-3 p-5 rounded-[14px] bg-[#f1f3f6] dark:bg-[#232b3d]">
        <!-- Step 1 — the question -->
        <template v-if="step === 'ask'">
          <h2
            class="text-[20px] font-bold leading-[1.25] tracking-[-0.01em] text-slate-900 dark:text-white"
          >
            Are you enjoying Cloud of Worship?
          </h2>
          <p
            class="mt-2 text-[14px] leading-[1.55] text-gray-600 dark:text-[#cfd5e1]"
          >
            It takes a second, and it helps us make it better for your church.
          </p>

          <div class="flex flex-wrap items-center justify-end gap-3 mt-6">
            <CowButton variant="secondary" @click="answerNo">No</CowButton>
            <CowButton @click="answerYes">Yes</CowButton>
          </div>
        </template>

        <!-- Step 2 — the "No" path: ask what went wrong instead of a public review -->
        <template v-else-if="step === 'feedback'">
          <h2
            class="text-[20px] font-bold leading-[1.25] tracking-[-0.01em] text-slate-900 dark:text-white"
          >
            Sorry to hear that
          </h2>
          <p
            class="mt-2 text-[14px] leading-[1.55] text-gray-600 dark:text-[#cfd5e1]"
          >
            Tell us what's getting in your way and we'll look into it.
          </p>

          <CowTextarea
            v-model="feedback"
            label="What could we do better?"
            class="mt-4"
            :rows="4"
          />

          <div class="flex flex-wrap items-center justify-end gap-3 mt-5">
            <CowButton variant="secondary" @click="skipFeedback">
              Not now
            </CowButton>
            <CowButton :disabled="!feedback.trim()" @click="submitFeedback">
              Send feedback
            </CowButton>
          </div>
        </template>

        <!-- Step 3 — the "No" path, after sending -->
        <template v-else>
          <h2
            class="text-[20px] font-bold leading-[1.25] tracking-[-0.01em] text-slate-900 dark:text-white"
          >
            Thank you
          </h2>
          <p
            class="mt-2 text-[14px] leading-[1.55] text-gray-600 dark:text-[#cfd5e1]"
          >
            We've passed this on to the team. If you'd like a hand right away,
            our community is the fastest way to reach us.
          </p>

          <div class="flex flex-wrap items-center justify-end gap-3 mt-6">
            <CowButton variant="secondary" @click="close">Close</CowButton>
            <CowButton @click="openCommunity">Chat with us</CowButton>
          </div>
        </template>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import CloseIcon from "~/components/svgs/CloseIcon.vue"

const STORAGE_KEY = "cow_satisfaction_prompt"

/*
  Cadence, keyed off how the last showing ended:
  - dismissed (closed without answering), or answered "yes" — ask again in a
    month.
  - answered "no" — come back weekly until they tell us what's wrong; a
    churning operator is worth the nudge.
  - sent feedback — done, never ask again. Actually writing to us is the only
    thing that retires the prompt for good.
*/
const COOLDOWN_DAYS: Record<PromptStatus, number | null> = {
  dismissed: 30,
  "answered-yes": 30,
  "answered-no": 7,
  "feedback-sent": null,
}

type PromptStatus =
  | "dismissed"
  | "answered-no"
  | "answered-yes"
  | "feedback-sent"

type PromptRecord = {
  /** When the prompt was last put in front of this operator. */
  shownAt: number
  /** How that showing ended — this drives when (or whether) it returns. */
  status: PromptStatus
}

const props = withDefaults(
  defineProps<{
    eyebrow?: string
    /** Public review page opened when the operator says yes. */
    reviewUrl?: string
    /** Where "Chat with us" sends an unhappy operator. */
    communityUrl?: string
  }>(),
  {
    eyebrow: "Quick question",
    reviewUrl: "https://www.trustpilot.com/evaluate/cloudofworship.com",
    communityUrl: "https://chat.whatsapp.com/DeQX11igCSU6YaOoTqY7GY",
  }
)

const emit = defineEmits<{
  (e: "answered", enjoying: boolean): void
}>()

const visible = ref(false)
const step = ref<"ask" | "feedback" | "thanks">("ask")
const feedback = ref("")
// When the prompt currently on screen was opened; the cooldown is measured
// from here, so answering minutes later can't stretch the window.
const shownAtForThisShowing = ref(0)

/**
 * Read the stored prompt record.
 */
const getRecord = (): PromptRecord | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Persist how the current showing ended, against the moment it opened. The
 * timestamp comes from this showing rather than the stored record: reusing the
 * stored one would pin `shownAt` to the very first showing forever, and every
 * launch after the first cooldown elapsed would re-open the prompt.
 */
const setStatus = (status: PromptStatus) => {
  const shownAt = shownAtForThisShowing.value || Date.now()
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ shownAt, status } satisfies PromptRecord)
    )
  } catch {
    // Ignore storage failures (e.g. private mode, quota, SecurityError).
  }
}

/**
 * Is the operator still inside the cooldown from the last showing? A `null`
 * cooldown means the prompt is retired for good.
 */
const isWithinCooldown = (): boolean => {
  const record = getRecord()
  if (!record) return false
  const days = COOLDOWN_DAYS[record.status]
  if (days === null) return true
  return Date.now() - record.shownAt < days * 24 * 60 * 60 * 1000
}

/**
 * Show the prompt, unless its cooldown from the last showing is still running.
 * Returns true if it was shown.
 */
const show = (): boolean => {
  if (isWithinCooldown()) return false
  step.value = "ask"
  feedback.value = ""
  visible.value = true
  shownAtForThisShowing.value = Date.now()
  // Stamped up front so the cooldown holds even if the operator never answers
  // (closing the window, navigating away).
  setStatus("dismissed")
  usePosthogCapture("SATISFACTION_PROMPT_SHOWN")
  return true
}

const close = () => {
  visible.value = false
}

/**
 * Closed via the X without answering — ask again after the snooze window.
 */
const snooze = () => {
  close()
  usePosthogCapture("SATISFACTION_PROMPT_DISMISSED", { step: step.value })
}

/**
 * Happy operator — send them straight to the public review page.
 */
const answerYes = () => {
  setStatus("answered-yes")
  usePosthogCapture("SATISFACTION_PROMPT_ANSWERED", { enjoying: true })
  emit("answered", true)
  close()
  useOpenExternal(props.reviewUrl)
}

/**
 * Unhappy operator — keep it in-app and ask what's wrong.
 */
const answerNo = () => {
  setStatus("answered-no")
  usePosthogCapture("SATISFACTION_PROMPT_ANSWERED", { enjoying: false })
  emit("answered", false)
  step.value = "feedback"
}

const skipFeedback = () => {
  usePosthogCapture("SATISFACTION_FEEDBACK_SKIPPED")
  close()
}

const submitFeedback = () => {
  const message = feedback.value.trim()
  if (!message) return
  // Telling us what's wrong ends the weekly nudge: they've done their part.
  setStatus("feedback-sent")
  usePosthogCapture("SATISFACTION_FEEDBACK_SUBMITTED", { message })
  step.value = "thanks"
}

const openCommunity = () => {
  useOpenExternal(props.communityUrl)
  close()
}

defineExpose({ show, isWithinCooldown })
</script>
