<template>
  <div ref="triggerRef" class="inline-flex">
    <UButton size="xs" variant="ghost" color="gray" class="p-1" @click.stop="toggle">
      <MoreIcon class="w-5 h-5 text-gray-500 dark:text-[#9aa3b2]" />
    </UButton>

    <Teleport to="body">
      <div v-if="open" class="fixed inset-0 z-50" @click="close" @contextmenu.prevent="close" />
      <div
        v-if="open"
        class="more-modal fixed z-50 flex flex-col p-2 gap-1 min-w-[120px] rounded-lg bg-white dark:bg-[#222938] shadow-lg"
        :style="panelStyle"
      >
        <slot :close="close" />
      </div>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import MoreIcon from "~/components/svgs/MoreIcon.vue"

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const openMenu = () => {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (rect) {
    panelStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.right}px`,
      transform: "translateX(-100%)",
    }
  }
  open.value = true
}

const close = () => {
  open.value = false
}

const toggle = () => {
  open.value ? close() : openMenu()
}

// Close instead of tracking scroll offsets — avoids the menu drifting out of
// sync with its trigger when the (often virtualized) list underneath it scrolls.
const handleScroll = () => {
  if (open.value) close()
}

onMounted(() => {
  window.addEventListener("scroll", handleScroll, true)
})

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll, true)
})

defineExpose({ close })
</script>
