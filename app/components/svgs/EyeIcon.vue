<template>
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <template v-if="off">
      <path
        d="M3 9.83423C4.575 11.7842 7.4625 14.2499 12 14.2499C16.5375 14.2499 19.425 11.7842 21 9.83423"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M18.8555 11.9341L21.0023 15.6372"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M14.4551 13.9966L15.1207 17.7747"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M9.53672 13.9878L8.87109 17.7753"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M5.13516 11.9341L2.98828 15.656"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
    <template v-else>
      <path
        d="M12 5.25C7.4625 5.25 4.575 7.71573 3 9.66573C4.575 11.6157 7.4625 14.0815 12 14.0815C16.5375 14.0815 19.425 11.6157 21 9.66573C19.425 7.71573 16.5375 5.25 12 5.25Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <circle
        cx="12"
        cy="9.66573"
        r="2.25"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ off?: boolean }>(), { off: false })
</script>
