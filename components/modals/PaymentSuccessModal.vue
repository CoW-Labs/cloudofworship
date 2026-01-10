<template>
  <UModal
    v-model="isOpen"
    :ui="{
      width: 'sm:max-w-md',
    }"
    prevent-close
  >
    <UCard>
      <div class="text-center py-6 px-4">
        <!-- Celebration Icon -->
        <div class="mb-6 flex justify-center">
          <div
            class="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center animate-bounce"
          >
            <IconWrapper
              name="i-heroicons-check-circle"
              size="12"
              class="text-white"
            />
          </div>
        </div>

        <!-- Success Message -->
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🎉 Congratulations!
        </h2>
        <!-- <p class="text-lg font-semibold text-primary-600 dark:text-primary-400 mb-4">
          Payment Successful!
        </p> -->

        <p class="text-gray-600 dark:text-gray-300 mb-6">
          Welcome to the <span class="font-bold">{{ planName }}</span> plan!
          <br />
          You now have access to all premium features.
        </p>

        <!-- Features Highlight -->
        <div
          class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 mb-6 text-left"
        >
          <p
            class="text-sm font-semibold text-primary-900 dark:text-primary-100 mb-2"
          >
            🚀 What's unlocked:
          </p>
          <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <li class="flex items-start gap-2">
              <IconWrapper
                name="i-heroicons-check"
                size="4"
                class="text-primary-500 mt-0.5"
              />
              <span>Unlimited presentations & slides</span>
            </li>
            <li class="flex items-start gap-2">
              <IconWrapper
                name="i-heroicons-check"
                size="4"
                class="text-primary-500 mt-0.5"
              />
              <span>Advanced media and text slides integration</span>
            </li>
            <li class="flex items-start gap-2">
              <IconWrapper
                name="i-heroicons-check"
                size="4"
                class="text-primary-500 mt-0.5"
              />
              <span>Access over 9,000+ songs in our global library</span>
            </li>
            <li class="flex items-start gap-2">
              <IconWrapper
                name="i-heroicons-check"
                size="4"
                class="text-primary-500 mt-0.5"
              />
              <span>5GB Cloud Storage for your fellow stewards</span>
            </li>
            <li class="flex items-start gap-2">
              <IconWrapper
                name="i-heroicons-check"
                size="4"
                class="text-primary-500 mt-0.5"
              />
              <span>Priority support</span>
            </li>
            <li class="flex items-start gap-2">
              <IconWrapper
                name="i-heroicons-check"
                size="4"
                class="text-primary-500 mt-0.5"
              />
              <a
                href="https://cloudofworship.com/pricing"
                class="text-primary-500 hover:underline"
                >And many more</a
              >
            </li>
          </ul>
        </div>

        <!-- CTA Button -->
        <UButton
          size="lg"
          block
          color="primary"
          @click="handleClose"
          class="font-semibold"
        >
          Add your team members
        </UButton>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  planName: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: boolean]
  close: []
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
})

// Confetti animation
const triggerConfetti = () => {
  if (process.client) {
    // Load canvas-confetti dynamically
    import("canvas-confetti").then((confetti) => {
      const count = 200
      const defaults = {
        origin: { y: 0.7 },
        zIndex: 9999,
      }

      function fire(particleRatio: number, opts: any) {
        confetti.default({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        })
      }

      // Fire multiple confetti bursts
      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      })

      fire(0.2, {
        spread: 60,
      })

      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      })

      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      })

      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      })
    })
  }
}

const handleClose = () => {
  isOpen.value = false
  emit("close")
  setTimeout(() => {
    useGlobalEmit("open-invite-modal")
  }, 300)
}

// Watch for modal opening to trigger confetti
watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      // Delay confetti slightly to let modal animate in
      setTimeout(() => {
        triggerConfetti()
      }, 300)
    }
  }
)
</script>

<style scoped>
@keyframes bounce {
  0%,
  100% {
    transform: translateY(-5%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}

.animate-bounce {
  animation: bounce 1s infinite;
}
</style>
