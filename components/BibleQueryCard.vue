<template>
  <button
    class="action-card flex gap-3 p-2 py-4 border-t first:border-t-0 border-gray-100 dark:border-primary-950 hover:rounded-md hover:bg-primary-50 dark:hover:bg-primary-800 transition-all cursor-pointer text-left w-[100%]"
    @click="useGlobalEmit(appWideActions.newBible, bibleQuery)"
  >
    <IconWrapper
      name="i-bx-history"
      class="mt-1 text-primary dark:text-primary-300"
      rounded-bg
    />
    <div class="texts">
      <h4 class="font-semibold">
        {{ useScriptureLabel(bibleQuery || "", { toLongForm: true }) }}
      </h4>
      <p class="font-light text-xs mt-1">Recently opened</p>
    </div>
  </button>
</template>
<script setup lang="ts">
import type { QuickAction } from "~/types"
import { appWideActions } from "~/utils/constants"

const props = defineProps<{
  bibleQuery: string
}>()
</script>

<style scoped></style>
