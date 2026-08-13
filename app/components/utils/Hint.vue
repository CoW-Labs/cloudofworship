<template>
  <div
    v-if="!dismissed"
    class="hint rounded-xl bg-gray-100 px-4 py-3 dark:bg-[#2B3140]"
  >
    <div class="flex items-start justify-between gap-2">
      <slot name="icon">
        <LightbulbIcon class="h-8 w-8 text-gray-900 dark:text-[#F8F9FB]" />
      </slot>
      <button
        v-if="dismissible"
        type="button"
        aria-label="Dismiss hint"
        class="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-black/5 dark:text-[#9BA3B2] dark:hover:bg-white/5"
        @click="dismiss"
      >
        <CloseIcon class="h-4 w-4" />
      </button>
    </div>
    <p
      v-if="title"
      class="mt-2 text-[12px] font-semibold leading-[17px] text-gray-900 dark:text-[#F8F9FB]"
    >
      {{ title }}
    </p>
    <div
      class="text-[12px] leading-[17px] text-gray-500 dark:text-[#9BA3B2]"
      :class="title ? 'mt-0.5' : 'mt-2'"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import CloseIcon from "~/components/svgs/CloseIcon.vue"

// An inline tip: lightbulb over the body copy. `title` is optional — without it
// this is exactly the design, and the icon alone carries the "hint" meaning.
// With `dismissKey`, closing it is remembered across sessions.
const props = defineProps<{
  title?: string
  dismissible?: boolean
  dismissKey?: string
}>()

const STORAGE_KEY = "cow_dismissed_hints"

const getDismissedHints = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const dismissed = ref(false)

const dismiss = () => {
  dismissed.value = true
  if (!props.dismissKey) return
  const keys = getDismissedHints()
  if (keys.includes(props.dismissKey)) return
  keys.push(props.dismissKey)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    // Ignore storage failures (private mode, quota, SecurityError).
  }
}

// localStorage is unavailable during SSR/prerender, so resolve on mount.
onMounted(() => {
  if (props.dismissKey && getDismissedHints().includes(props.dismissKey)) {
    dismissed.value = true
  }
})
</script>
