<template>
  <div class="slide-layout-selection flex p-2 gap-2">
    <UButton
      v-for="layout in slideLayouts"
      :key="layout"
      @click="
        $emit('select', layout === slideLayoutTypes.full_text ? null : '')
      "
      class="group/item w-[80px] h-[80px] overflow-hidden text-black shadow-none bg-gray-100 dark:bg-primary-900 hover:bg-primary-100 transition disabled:bg-gray-50 disabled:opacity-30"
      :class="{ 'bg-primary-100': layout === value }"
      :disabled="layout !== slideLayoutTypes.full_text"
    >
      <div
        v-if="layout === slideLayoutTypes.heading_sub"
        class="text-center w-[100%] flex flex-col gap-1 group"
      >
        <p
          class="h-4 w-[100%] bg-gray-300 rounded-md group-hover/item:bg-primary-300 group-active/item:bg-primary-300"
          :class="{ 'bg-primary-300': layout === value }"
        ></p>
        <p
          class="h-9 w-[100%] bg-gray-300 rounded-md group-hover/item:bg-primary-300 group-active/item:bg-primary-300"
          :class="{ 'bg-primary-300': layout === value }"
        ></p>
      </div>
      <div
        v-else-if="layout === slideLayoutTypes.full_text"
        class="text-center w-[100%] flex flex-col gap-1"
      >
        <p
          class="h-14 w-[100%] bg-gray-300 rounded-md group-hover/item:bg-primary-300 group-active/item:bg-primary-300"
          :class="{ 'bg-primary-300': layout === value }"
        ></p>
      </div>
      <div v-else class="text-center w-[100%] flex gap-1">
        <p
          class="h-14 w-[100%] bg-gray-300 rounded-md group-hover/item:bg-primary-300 group-active/item:bg-primary-300"
          :class="{ 'bg-primary-300': layout === value }"
        ></p>
        <p
          class="h-14 w-[100%] bg-gray-300 rounded-md group-hover/item:bg-primary-300 group-active/item:bg-primary-300"
          :class="{ 'bg-primary-300': layout === value }"
        ></p>
      </div>
    </UButton>
  </div>
</template>

<script setup lang="ts">
const slideLayouts = Object.values(slideLayoutTypes)?.slice(0, 3)
defineProps<{
  value: string
}>()
</script>

<style scoped></style>
