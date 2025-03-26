<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        base: 'min-w-[700px]',
      }"
      prevent-close
    >
      <button
        class="bg-primary-500 absolute p-1 text-white rounded-full top-2 right-2"
        @click="visible = false"
      >
        <IconWrapper name="i-bx-x" class="p-2 text-white" />
      </button>
      <a :href="activeAdvert?.url" target="_blank">
        <img class="rounded-3xl" :src="activeAdvert?.image"
      /></a>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Advert } from "~/types"

const props = defineProps<{
  activeAdvert: Advert | null
}>()

const visible = ref(false)

watch(
  () => props.activeAdvert,
  (newVal, oldVal) => {
    if (newVal) {
      setTimeout(() => {
        visible.value = true
      }, 10000)
    }
  }
)

const emit = defineEmits(["close"])
</script>
