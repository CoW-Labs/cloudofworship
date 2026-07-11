<template>
  <UModal
    v-model="isOpen"
    :ui="{
      width: 'w-full sm:max-w-sm',
    }"
  >
    <div class="p-6">
      <div class="flex flex-col justify-center h-full">
        <h4 class="text-md font-medium">Take over live output?</h4>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {{ presenterName }} is presenting. Take over and change the live
          slide?
        </p>
        <div class="flex items-center justify-end gap-2 mt-6">
          <UButton variant="outline" color="gray" @click="isOpen = false">
            Cancel
          </UButton>
          <UButton color="red" @click="handleConfirm">Take over</UButton>
        </div>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  presenterName: string
}>()

const emit = defineEmits<{
  "update:open": [value: boolean]
  confirm: []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
})

const handleConfirm = () => {
  emit("confirm")
  isOpen.value = false
}
</script>

