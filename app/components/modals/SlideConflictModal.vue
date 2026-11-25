<template>
  <UModal
    :model-value="!!current"
    prevent-close
    :ui="{
      rounded: 'rounded-2xl',
      background: 'bg-transparent dark:bg-transparent',
      ring: '',
      shadow: 'shadow-none',
      width: 'w-[94vw] sm:max-w-md',
      overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
    }"
  >
    <div
      class="rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden p-6"
    >
      <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
        This slide has two versions
      </h4>
      <p class="mt-2 text-sm text-gray-500 dark:text-[#9aa3b2]">
        Your edit is saved on this device. Compare it with the version on the
        server and choose which one to keep.
      </p>

      <div class="grid grid-cols-2 gap-3 mt-4">
        <div class="rounded-xl bg-[#f1f3f6] dark:bg-[#232b3d] p-3">
          <p
            class="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-[#9aa3b2]"
          >
            Mine
          </p>
          <p
            class="mt-1 text-sm text-gray-900 dark:text-white line-clamp-3 break-words"
          >
            {{ mineText || "No text" }}
          </p>
        </div>
        <div class="rounded-xl bg-[#f1f3f6] dark:bg-[#232b3d] p-3">
          <p
            class="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-[#9aa3b2]"
          >
            Theirs
          </p>
          <p
            class="mt-1 text-sm text-gray-900 dark:text-white line-clamp-3 break-words"
          >
            {{ theirsText || "No text" }}
          </p>
        </div>
      </div>

      <p v-if="sameText" class="mt-3 text-xs text-gray-500 dark:text-[#9aa3b2]">
        Both previews show the same text. Other slide settings may differ.
      </p>

      <p
        v-if="resolutionError"
        role="alert"
        class="mt-3 text-sm text-red-600 dark:text-red-400"
      >
        {{ resolutionError }}
      </p>
      <div class="flex items-center justify-end gap-3 mt-6">
        <CowButton
          variant="secondary"
          size="md"
          :disabled="resolving"
          @click="resolve('theirs')"
        >
          Keep theirs
        </CowButton>
        <CowButton
          variant="primary"
          size="md"
          :loading="resolving"
          @click="resolve('mine')"
        >
          Keep mine
        </CowButton>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import { useSlideConflicts } from "~/composables/useSlideResync"

const { conflicts, resolveKeepMine, resolveKeepTheirs } = useSlideConflicts()
const resolving = ref(false)
const resolutionError = ref("")
const current = computed(() => conflicts.value[0] || null)
watch(current, () => {
  resolutionError.value = ""
})

const clean = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

// The slide's words: its text lines, plus any free-layout box that holds its
// own text instead of pointing at a line.
const textOf = (slide?: {
  contents?: unknown
  slideStyle?: { textBoxes?: Array<{ html?: string }> }
}) => {
  const lines = (Array.isArray(slide?.contents) ? slide!.contents : []).filter(
    (line): line is string => typeof line === "string"
  )
  const custom = (slide?.slideStyle?.textBoxes || [])
    .map((box) => box.html)
    .filter((html): html is string => typeof html === "string")
  return clean([...lines, ...custom].join(" "))
}

const mineText = computed(() => textOf(current.value?.localSlide))
const theirsText = computed(() => textOf(current.value?.serverSlide))

const sameText = computed(() => mineText.value === theirsText.value)

const resolve = async (choice: "mine" | "theirs") => {
  const conflict = current.value
  if (!conflict || resolving.value) return
  resolving.value = true
  try {
    resolutionError.value = ""
    const resolved =
      choice === "mine"
        ? await resolveKeepMine(conflict.serverId)
        : await resolveKeepTheirs(conflict.serverId)
    if (resolved)
      usePosthogCapture("SLIDE_CONFLICT_RESOLVED", {
        resolution: choice,
        slideType: conflict.localSlide.type,
      })
  } catch (error) {
    resolutionError.value =
      "Could not resolve this conflict. Your edit is still available on this device."
    console.error("Failed to resolve slide conflict:", error)
  } finally {
    resolving.value = false
  }
}
</script>
