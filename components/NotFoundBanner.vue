<template>
  <div
    class="h-[88%] p-4 py-6 mt-4 flex justify-center gap-6 bg-primary-100 rounded-lg text-primary-900 relative overflow-hidden"
  >
    <IconWrapper :name="icon" size="16" />
    <IconWrapper
      :name="icon"
      size="20"
      class="absolute opacity-10 -bottom-3 -left-3"
    />
    <div class="texts-action">
      <div>
        <h2 class="text-md font-semibold max-w-[150px]">
          {{ sub }}
        </h2>
        <p class="text-xs max-w-[150px] mt-1">
          {{ desc }}
        </p>
      </div>

      <UButton
        v-if="action"
        :icon="actionIcon"
        @click="useGlobalEmit(action, query)"
        class="mt-2 text-primary-100"
      >
        {{ actionText }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  icon: string
  sub: string
  desc: string
  actionText: string
  action: string
  query: string
}>()

const actionIcon = computed(() => {
  if (
    props.actionText?.toLowerCase().includes("create") ||
    props.actionText?.toLowerCase().includes("add")
  ) {
    return "i-bx-plus"
  }
  return ""
})
</script>
