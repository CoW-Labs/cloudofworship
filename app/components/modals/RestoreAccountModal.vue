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
    <!-- Compact sibling of FeatureIntroductionModal — same shell, smaller body. -->
    <div
      class="rounded-2xl bg-white dark:bg-[#1b2233] shadow-[0_24px_48px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6)]"
    >
      <div
        class="flex items-center justify-between gap-4 pt-3 pb-2.5 pl-4 pr-3"
      >
        <span
          class="flex items-center gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-red-500" />
          Requires attention
        </span>
        <button
          type="button"
          class="grid place-items-center w-7 h-7 rounded-lg text-gray-500 hover:bg-black/[0.06] hover:text-gray-900 dark:text-[#9aa3b2] dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
          aria-label="Close"
          @click="close"
        >
          <CloseIcon class="w-4 h-4" />
        </button>
      </div>

      <div
        class="mx-2.5 mb-2.5 p-5 rounded-[14px] bg-[#f1f3f6] dark:bg-[#232b3d]"
      >
        <h2
          class="text-[20px] font-bold leading-[1.25] tracking-[-0.01em] text-slate-900 dark:text-white"
        >
          Restore your account
        </h2>

        <p
          class="mt-2 text-[14px] leading-[1.55] text-gray-600 dark:text-[#cfd5e1]"
        >
          Your account is currently limited. Restore it to bring back realtime
          collaboration and the rest of the Teams features.
        </p>

        <ul class="mt-3 space-y-1.5">
          <li
            v-for="benefit in benefits"
            :key="benefit"
            class="flex items-start gap-2 text-[14px] leading-[1.45] text-gray-600 dark:text-[#cfd5e1]"
          >
            <UIcon
              name="i-bx-check"
              class="mt-[3px] w-4 h-4 shrink-0 text-primary-500"
            />
            {{ benefit }}
          </li>
        </ul>

        <div class="flex flex-wrap items-center justify-end gap-2 mt-5">
          <CowButton variant="secondary" size="sm" @click="close">
            Not now
          </CowButton>
          <CowButton variant="primary" size="sm" @click="restore">
            Restore account
          </CowButton>
        </div>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
import CloseIcon from "~/components/svgs/CloseIcon.vue"

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: []; restore: [] }>()

const benefits = [
  "Realtime sync with your media team",
  // "Live slide control across every device",
  "Unlimited schedules and team members",
  "Keep Cloud of Worship alive",
]

const visible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    if (!value) emit("close")
  },
})

const close = () => emit("close")

const restore = () => {
  emit("restore")
  emit("close")
}
</script>
