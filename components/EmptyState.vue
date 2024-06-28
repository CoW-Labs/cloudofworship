<template>
  <div
    class="h-[88%] mt-4 flex flex-col items-center justify-center gap-4 text-gray-500"
  >
    <IconWrapper :name="icon" size="14" />
    <div>
      <h2
        class="text-md font-semibold max-w-[150px] text-center mx-auto"
        :class="{ 'max-w-[200px]': isWider }"
      >
        {{ sub }}
      </h2>
      <p
        class="text-xs max-w-[150px] text-center mt-1 mx-auto"
        :class="{ 'max-w-[220px]': isWider }"
      >
        {{ desc }}
      </p>
    </div>

    <UButton v-if="action" :icon="actionIcon" @click="useGlobalEmit(action)">
      {{ actionText }}
    </UButton>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  icon: string
  sub: string
  desc: string
  actionText: string
  action: string
  isWider: boolean
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
