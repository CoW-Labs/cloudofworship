<template>
  <div
    ref="pagesPreview"
    class="verse-preview behavior-smooth absolute right-0 left-0 top-12 z-20 overflow-auto rounded-b-2xl bg-white dark:bg-[#222938] shadow-lg"
  >
    <!-- HEADER — stays put while the grid scrolls, so the operator always knows
         which page is live and how many there are. -->
    <div
      class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-100 bg-white/85 px-4 py-2.5 backdrop-blur dark:border-[#2b3344] dark:bg-[#222938]/85"
    >
      <p class="truncate text-xs text-gray-500 dark:text-[#7d8695]">
        <span class="font-semibold text-gray-900 dark:text-white">
          {{ pageCount }} {{ pageCount === 1 ? "page" : "pages" }}
        </span>
        <span class="hidden sm:inline"> — click a page to project it</span>
      </p>
      <span
        class="shrink-0 whitespace-nowrap rounded-full bg-primary-500/10 px-2.5 py-1 text-[11px] font-semibold leading-none text-primary-600 dark:bg-primary-500/15 dark:text-primary-400"
      >
        Page {{ activePage }} of {{ pageCount }}
      </span>
    </div>

    <div class="grid grid-cols-3 gap-3 p-3 lg:grid-cols-4 2xl:grid-cols-5">
      <button
        v-for="obj in slide.presentationObjects"
        :key="obj.page"
        :data-page="obj.page"
        type="button"
        class="page-thumb group relative overflow-hidden rounded-xl bg-gray-100 ring-1 ring-inset transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:bg-[#171d2b]"
        :class="
          obj.page === activePage
            ? 'ring-2 ring-primary-500 dark:ring-primary-400'
            : 'ring-gray-200 hover:ring-gray-300 dark:ring-white/5 dark:hover:ring-white/20'
        "
        @click="$emit('goto-page', obj.page)"
      >
        <!-- `contain`, not `cover`: a presentation page is a fixed composition
             and cropping it hides the very line the operator is looking for. -->
        <img
          v-if="!failedPages.has(obj.page)"
          :src="obj.imageUrl"
          :alt="`Page ${obj.page}`"
          loading="lazy"
          decoding="async"
          class="aspect-video w-full bg-white object-contain dark:bg-black"
          @error="failedPages.add(obj.page)"
        />
        <!-- A page whose image never made it down (still syncing, or a failed
             render) used to show a broken-image glyph over black. -->
        <div
          v-else
          class="flex aspect-video w-full flex-col items-center justify-center gap-1 text-gray-400 dark:text-[#7d8695]"
        >
          <UIcon name="i-bx-image-alt" class="h-5 w-5" dynamic />
          <span class="text-[10px] font-medium">Page {{ obj.page }}</span>
        </div>

        <span
          class="absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white backdrop-blur-sm"
        >
          {{ obj.page }}
        </span>

        <span
          v-if="obj.page === activePage"
          class="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary-500 text-white shadow-sm"
        >
          <UIcon name="i-bx-check" class="h-3.5 w-3.5" dynamic />
        </span>

        <!-- Hover affordance — the whole tile is the target, so say so. -->
        <span
          class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span
            class="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold leading-none text-gray-900"
          >
            {{ obj.page === activePage ? "Current page" : "Go to page" }}
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"

const props = defineProps<{
  slide: Slide
}>()

defineEmits<{
  "goto-page": [page: number]
}>()

const pagesPreview = ref<HTMLDivElement | null>(null)
const failedPages = reactive(new Set<number>())

const activePage = computed(() => (props.slide.presentationPageIndex ?? 0) + 1)
const pageCount = computed(() => props.slide.presentationObjects?.length ?? 0)

// A long deck scrolls inside this panel; keep the projected page on screen so
// paging through with the arrows doesn't leave the grid behind.
const scrollActivePageIntoView = () => {
  const target = pagesPreview.value?.querySelector(
    `[data-page="${activePage.value}"]`
  ) as HTMLElement | null
  target?.scrollIntoView({ block: "nearest" })
}

onMounted(() => nextTick(scrollActivePageIntoView))
watch(activePage, () => nextTick(scrollActivePageIntoView))

// Retry a page that failed while its image was still uploading/rendering.
watch(
  () => props.slide.presentationObjects,
  () => failedPages.clear()
)
</script>
