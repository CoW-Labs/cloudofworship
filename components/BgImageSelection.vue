<template>
  <div class="bg-image-selection p-2 gap-2 grid grid-cols-4">
    <UButton
      v-for="image in backgroundImages"
      :key="image"
      @click="$emit('select', image)"
      class="w-[40px] h-[40px] p-0 text-black bg-cover transition-all overflow-hidden relative"
    >
      <div
        class="bg-image min-w-[40px] h-[40px] transition rounded-md opacity-100 hover:opacity-30 bg-cover"
        :class="{ 'opacity-30': image === value }"
        :style="`background-image: url(${image})`"
      ></div>
      <IconWrapper
        v-if="image === value"
        name="i-bx-check"
        size="5"
        :rounded-bg="true"
        class="absolute text-primary-500 scale-50 bottom-2 right-2"
      />
    </UButton>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: string
}>()
const backgroundImages = [
  "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=1740",
  "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=1740",
  "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?q=80&w=1740",
  "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=1740",
  "https://images.unsplash.com/photo-1509021436665-8f07dbf5bf1d?q=80&w=1740",
  "https://images.unsplash.com/photo-1593485589800-579b43749b15?q=80&w=1740",
  "https://images.unsplash.com/photo-1478147427282-58a87a120781?q=80&w=1740",
  "https://images.unsplash.com/photo-1507874457470-272b3c8d8ee2?q=80&w=1740",
  "https://images.unsplash.com/photo-1491396023581-4344e51fec5c?q=80&w=1740",
  "https://images.unsplash.com/photo-1518289646039-3e6c87a5aaf6?q=80&w=1740",
  "https://images.unsplash.com/photo-1503455637927-730bce8583c0?q=80&w=1740",
  "https://images.unsplash.com/photo-1579267205095-6b30ba87edba?q=80&w=1740",
  "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=1740",
  "https://images.unsplash.com/photo-1523821741446-edb2b68bb7a0?q=80&w=1740",
  "https://images.unsplash.com/photo-1597773150796-e5c14ebecbf5?q=80&w=1740",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1740",
]
</script>
