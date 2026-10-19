<template>
  <!-- Stands in for a camera feed anywhere that must not open the camera:
       schedule thumbnails, the editor, and remote screens (livestream, stage)
       that run on someone else's device. -->
  <div
    class="camera-placeholder absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-950 text-center text-white/80"
    :class="size === 'lg' ? 'gap-4 px-8' : 'gap-1.5 px-3'"
  >
    <CameraIcon
      :class="size === 'lg' ? 'h-16 w-16 text-white/70' : 'h-6 w-6 text-white/60'"
    />
    <p
      class="font-semibold leading-tight"
      :class="size === 'lg' ? 'text-2xl' : 'text-[11px]'"
    >
      {{ title }}
    </p>
    <p
      v-if="subtitle"
      class="max-w-full truncate leading-tight text-white/50"
      :class="size === 'lg' ? 'text-base' : 'text-[10px]'"
    >
      {{ subtitle }}
    </p>
  </div>
</template>

<script setup lang="ts">
import CameraIcon from "~/components/svgs/CameraIcon.vue"

withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    size?: "sm" | "lg"
  }>(),
  { title: "Camera", subtitle: "", size: "sm" }
)
</script>
