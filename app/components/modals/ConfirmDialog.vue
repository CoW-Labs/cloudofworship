<template>
  <div>
    <UButton
      v-if="noTooltip"
      :icon="$slots.icon ? undefined : buttonIcon"
      :button-size="buttonSize || 'xs'"
      :color="buttonColor"
      :variant="buttonVariant || 'ghost'"
      :class="buttonStyles"
      block
      @click.stop.prevent="isOpen = true"
    >
      <template v-if="$slots.icon" #leading><slot name="icon" /></template>
      {{ buttonLabel }}
    </UButton>
    <UTooltip v-else :text="header" :popper="{ placement: 'top' }">
      <UButton
        :icon="$slots.icon ? undefined : buttonIcon"
        :button-size="buttonSize || 'xs'"
        :color="buttonColor"
        :variant="buttonVariant || 'ghost'"
        :class="buttonStyles"
        @click.stop.prevent="isOpen = true"
      >
        <template v-if="$slots.icon" #leading><slot name="icon" /></template>
        {{ buttonLabel }}
      </UButton>
    </UTooltip>

    <UModal
      v-model="isOpen"
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
        class="confirm-dialog rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden p-6"
      >
        <h4 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ header }}
        </h4>
        <p class="mt-2 text-sm text-gray-500 dark:text-[#9aa3b2]">
          {{ label }}
        </p>
        <div class="flex items-center justify-end gap-3 mt-6">
          <CowButton variant="secondary" size="md" @click="handleCancel">
            Cancel
          </CowButton>
          <CowButton
            :variant="isDestructive ? 'danger' : 'primary'"
            size="md"
            @click="handleYesAction"
          >
            {{ actionLabel }}
          </CowButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { ButtonVariant } from "@nuxt/ui/dist/runtime/types"

const isOpen = ref(false)

// Present only when this dialog is a row inside a MoreActionsMenu
const moreActionsMenu = inject<{ suppress: (value: boolean) => void } | null>(
  "more-actions-menu",
  null
)
watch(isOpen, (value) => moreActionsMenu?.suppress(value))
onUnmounted(() => moreActionsMenu?.suppress(false))

const props = defineProps<{
  header: string
  label: string
  buttonIcon: string
  buttonStyles: string
  buttonColor?: string
  buttonLabel?: string
  buttonSize?: string
  buttonVariant?: ButtonVariant
  noTooltip?: boolean
}>()
const emit = defineEmits(["confirm"])

// Destructive actions (Delete/Sign out) use the danger button variant.
const isDestructive = computed(() => {
  const first = props.header?.split(" ")[0]
  return first === "Delete" || first === "Sign"
})

// Confirm button label: the leading verb of the header (e.g. "Delete"),
// except "Sign out" which keeps its full label.
const actionLabel = computed(() =>
  props.header !== "Sign out" ? props.header?.split(" ")[0] : props.header
)

const handleYesAction = () => {
  emit("confirm")
  isOpen.value = false
}

const handleCancel = () => {
  isOpen.value = false
}
</script>
