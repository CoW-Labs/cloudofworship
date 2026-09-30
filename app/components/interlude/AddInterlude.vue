<template>
  <!-- The scroll container is this root (QuickActions adds overflow-auto), so
       the padding lives on an inner box: selected-card rings and the button's
       raised edge would otherwise be clipped at the scroll edge. -->
  <div class="add-interlude-main">
    <div class="flex flex-col gap-4 px-1.5 pt-3">
      <CowTeamsPreviewNotice
        v-if="!hasAccessToFeature(appWideActions.newInterlude)"
        :feature="appWideActions.newInterlude"
      />
      <p class="text-xs text-gray-500 dark:text-[#7d8695]">
        Adds an animated break screen to this schedule. The heading and sub text
        stay on screen while the animation loops.
      </p>

      <!-- Bottom padding keeps the last row of previews clear of the floating
           button once scrolled to the end. -->
      <InterludeForm
        v-model="form"
        narrow
        await-pick
        class="pb-4"
        @select="picked = true"
      />

      <!-- Hidden until an interlude is picked, then slides up from the bottom
           edge. Sticky to the scroll container, so it stays in reach however
           far the preview list is scrolled. -->
      <Transition
        enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
        enter-from-class="translate-y-full opacity-0"
        leave-active-class="transition duration-200 ease-in motion-reduce:transition-none"
        leave-to-class="translate-y-full opacity-0"
      >
        <div v-if="picked" class="sticky bottom-0 z-10 pb-6">
          <CowButton
            variant="primary"
            block
            size="lg"
            :disabled="!form.heading.trim()"
            @click="createInterlude"
          >
            Create interlude slide
          </CowButton>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defaultInterludeData } from "~/utils/interlude/slide"

const emit = defineEmits(["close"])
const { hasAccessToFeature, requireFeatureAccess } = useSubscription()

const form = ref(defaultInterludeData())
const picked = ref(false)

const createInterlude = () => {
  if (!requireFeatureAccess(appWideActions.newInterlude)) return
  useGlobalEmit(appWideActions.newInterlude, {
    ...form.value,
    heading: form.value.heading.trim(),
    subtitle: form.value.subtitle.trim(),
  })
  emit("close")
}
</script>
