<template>
  <!-- One eye per member, in pair order: it takes that slide off the screen
       (or puts it back) and the other slide fills it. Numbered so the order
       matches the Pair settings cards. Same pill as BibleVersionSelect. -->
  <div
    v-if="pair"
    class="bg-white dark:bg-[#171d2b] rounded-full flex items-center gap-0.5 h-[34px] px-1.5 shrink-0"
  >
    <CowTooltip
      v-for="(member, index) in members"
      :key="member.id"
      :text="
        isHidden(member)
          ? `Show ${member.name} on screen`
          : `Hide ${member.name}; the other slide fills the screen`
      "
    >
      <button
        type="button"
        class="px-1.5 py-1 rounded-full flex items-center gap-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
        :class="
          isHidden(member)
            ? 'text-gray-400 dark:text-[#6f7889]'
            : 'text-gray-700 dark:text-[#d5dae3] hover:text-gray-900 dark:hover:text-white'
        "
        :aria-label="
          isHidden(member)
            ? `Show ${member.name} on screen`
            : `Hide ${member.name} from screen`
        "
        :aria-pressed="isHidden(member)"
        @click="toggleHidden(pair.id, member.id)"
      >
        <EyeIcon :off="isHidden(member)" class="w-5 h-5" />
        <span class="text-xs font-semibold leading-none">
          {{ index + 1 }}
        </span>
      </button>
    </CowTooltip>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { Slide } from "~/types"

/**
 * The editor toolbar's show/hide toggles for the members of a slide pair.
 * One member at most is off the screen; see useSlidePairs.toggleHidden.
 */
const props = defineProps<{ pairId: string }>()

const appStore = useAppStore()
const { toggleHidden } = useSlidePairs()

const pair = computed(() => appStore.slidePairsById.get(props.pairId))

const members = computed<Slide[]>(() =>
  (pair.value?.slideIds ?? [])
    .map((id) => appStore.activeSlidesById.get(id))
    .filter((slide): slide is Slide => !!slide)
)

const isHidden = (member: Slide) => pair.value?.hiddenSlideId === member.id
</script>
