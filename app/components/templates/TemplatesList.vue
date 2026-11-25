<template>
  <div class="templates-main flex h-full min-h-[80vh] flex-col">
    <CowTeamsPreviewNotice
      v-if="!hasAccessToFeature('new-templates')"
      feature="new-templates"
      class="mb-2"
    />

    <UTabs :items="tabs" @change="selectTab(tabIds[$event]!)" />

    <div
      class="flex min-h-0 flex-1 flex-col rounded-xl bg-[#f1f3f6] p-1.5 dark:bg-[#222938]"
    >
      <!-- SEARCH AND CLOSE -->
      <div class="come-up-1 flex gap-2">
        <UInput
          v-model="search"
          :placeholder="`Search ${tab === 'community' ? 'community' : 'your'} templates`"
          class="cow-search-input w-[100%]"
        >
          <template #leading>
            <SearchIcon class="h-4 w-4 text-gray-400 dark:text-[#9aa3b2]" />
          </template>
        </UInput>
        <CowButton
          variant="secondary"
          size="2xs"
          class="max-h-[40px] rounded-lg !px-2.5 !py-0"
          aria-label="Close templates"
          @click="$emit('close')"
        >
          <CloseIcon class="h-4 w-4" />
        </CowButton>
      </div>

      <!-- SOURCE BANNER: what the slide is being made from. Same tinted card as
           CowTeamsPreviewNotice (soft fill, inset ring, rounded-2xl), with plain
           text so purple only marks the icon and the pill action. -->
      <div
        v-if="lookSlide || text"
        class="mt-1.5 flex items-center gap-2.5 rounded-2xl bg-primary-500/10 px-3 py-2 text-gray-900 ring-1 ring-inset ring-primary-500/30 dark:bg-primary-500/15 dark:text-white"
      >
        <UIcon
          name="i-tabler-wand"
          class="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300"
        />
        <p class="min-w-0 flex-1 truncate text-xs font-medium">
          <template v-if="lookSlide">
            New look for <strong class="font-semibold">{{ lookSlide.name }}</strong>
          </template>
          <template v-else>
            Slide from <strong class="font-semibold">“{{ text }}”</strong>
          </template>
        </p>
        <!-- Same flat pill surface as the navbar's Discord and theme buttons. -->
        <button
          type="button"
          class="shrink-0 whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 transition-colors hover:text-gray-900 dark:bg-[#171d2b] dark:text-gray-300 dark:hover:text-white"
          @click="lookSlide ? $emit('clear-look') : $emit('clear-text')"
        >
          {{ lookSlide ? "Start fresh" : "Clear" }}
        </button>
      </div>

      <!-- CATEGORY FILTERS -->
      <div class="come-up-1 relative mt-1.5">
      <div
        ref="chipRow"
        class="cow-chip-row flex items-center gap-1 overflow-x-auto pb-0.5"
      >
        <button
          v-for="item in categories"
          :key="item.id"
          type="button"
          :aria-pressed="category === item.id"
          class="shrink-0 rounded-full px-2.5 py-1 text-xs capitalize transition"
          :class="chipClass(category === item.id)"
          @click="category = item.id"
        >
          {{ item.id }}
        </button>
      </div>
      <CowScrollFade
        :start="chipFadeStart"
        :end="chipFadeEnd"
        :color="isDark ? '#222938' : '#f1f3f6'"
      />
      </div>

      <!-- DELETE CONFIRMATION -->
      <div
        v-if="pendingDelete"
        class="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200"
        role="alert"
      >
        <span class="min-w-0 truncate">
          Delete <strong>{{ pendingDelete.name }}</strong>? It cannot be undone.
        </span>
        <span class="flex shrink-0 gap-3 font-semibold">
          <button type="button" class="underline" @click="confirmDelete">
            Delete
          </button>
          <button type="button" @click="pendingDelete = null">Keep</button>
        </span>
      </div>

      <!-- GRID -->
      <div
        class="actions-ctn -mx-1.5 mt-2 flex-1 overflow-y-auto overflow-x-hidden px-1.5"
        :style="{ maxHeight: 'calc(100vh - 330px)' }"
      >
        <CowSkeleton v-if="loading" variant="block" :count="6" :height="120" />
        <div v-else-if="tab === 'mine' && templateStore.error" class="p-4 text-sm text-gray-600 dark:text-gray-300">
          Could not load your templates.
          <button type="button" class="underline" @click="selectTab('mine')">Try again</button>
        </div>
        <EmptyState
          v-else-if="!visible.length"
          icon="i-tabler-layout-grid"
          :sub="emptyText.sub"
          :desc="emptyText.desc"
        />
        <!-- Cards fill the panel's width: one column when it is narrow, more
             when it is wide, never smaller than a readable 220px. -->
        <div
          v-else
          class="grid gap-x-3 gap-y-4 pb-3"
          :style="{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }"
        >
          <TemplateCard
            v-for="template in visible"
            :key="template._id"
            :template="template"
            :can-delete="tab === 'mine'"
            @use="useTemplate"
            @delete="pendingDelete = $event"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Template } from "~/types"
import { useTemplateStore } from "~/store/template"
import { useAppStore } from "~/store/app"
import { appWideActions } from "~/utils/constants"
import { lookOf } from "~/utils/templates/apply"
import useScrollEdgeFade from "~/composables/useScrollEdgeFade"

// The category chips scroll sideways; fade the edge that has more past it.
const chipRow = ref<HTMLElement | null>(null)
// Same colour as the panel behind the chips, so the fade blends into it.
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === "dark")
const { start: chipFadeStart, end: chipFadeEnd } = useScrollEdgeFade(chipRow)

const props = defineProps<{
  /** The verse or song slide being restyled. Its words are kept. */
  lookSlideId?: string
  /** A transcript line to make into a new slide, as its main text. */
  text?: string
}>()
const emit = defineEmits<{
  close: []
  "clear-look": []
  "clear-text": []
}>()

const toast = useToast()
const appStore = useAppStore()
const templateStore = useTemplateStore()
const { hasAccessToFeature, requireFeatureAccess } = useSubscription()
const { loadStarters, loadChurchTemplates, deleteTemplate } = useTemplates()

type Tab = "community" | "mine"
const tabIds: Tab[] = ["community", "mine"]
const tabs = [
  { label: "Community", icon: "i-ph-palette-light" },
  { label: "Mine", icon: "i-bx-user" },
]
const categories = [
  "all",
  "worship",
  "sermon",
  "announcement",
  "prayer",
  "general",
  "live",
].map((id) => ({ id }))

const tab = ref<Tab>("community")
const category = ref("all")
const search = ref("")
const loading = ref(true)
const starters = shallowRef<Template[]>([])
const pendingDelete = ref<Template | null>(null)

const lookSlide = computed(() =>
  props.lookSlideId
    ? appStore.activeSlidesById.get(props.lookSlideId) ?? null
    : null
)
// Words handed in become a text slide, so only templates that restyle text fit.
const lookKind = computed(() =>
  lookSlide.value ? lookOf(lookSlide.value) : props.text ? "text" : null
)

onMounted(async () => {
  usePosthogCapture("TEMPLATES_PAGE_OPENED", {
    hasAccess: hasAccessToFeature("new-templates"),
    mode: props.lookSlideId ? "look" : props.text ? "text-line" : "new-slide",
  })
  starters.value = await loadStarters()
  loading.value = false
})

const selectTab = async (id: Tab) => {
  tab.value = id
  if (id === "mine" && !templateStore.loaded) {
    loading.value = true
    await loadChurchTemplates()
    loading.value = false
  }
}

const chipClass = (on: boolean) =>
  on
    ? "bg-primary-600 text-white"
    : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-[#2b3242] dark:text-[#d5dae3] dark:hover:bg-[#343c50]"

const visible = computed<Template[]>(() => {
  const source = tab.value === "community" ? starters.value : templateStore.church
  const query = search.value.trim().toLowerCase()
  return source
    .filter((t) => category.value === "all" || t.category === category.value)
    .filter(
      (t) =>
        !query ||
        t.name.toLowerCase().includes(query) ||
        (t.description ?? "").toLowerCase().includes(query)
    )
    .filter((t) => !lookKind.value || t.looks.includes(lookKind.value))
})

const emptyText = computed(() =>
  tab.value === "mine"
    ? {
        sub: "No templates of your own yet.",
        desc: "Open a slide's menu and choose Save as Template to keep its look.",
      }
    : lookSlide.value
      ? {
          sub: "No starter gives this slide a new look.",
          desc: "Try making a new slide instead.",
        }
      : { sub: "No templates match.", desc: "Try another category or search." }
)

const useTemplate = (template: Template) => {
  if (!requireFeatureAccess("new-templates")) return
  if (lookSlide.value && lookKind.value) {
    useGlobalEmit(appWideActions.applyTemplateLook, {
      slideId: lookSlide.value.id,
      template,
    })
    usePosthogCapture("TEMPLATE_LOOK_APPLIED", {
      templateId: template._id,
      source: template.source,
      look: lookKind.value,
    })
  } else if (props.text) {
    useGlobalEmit(appWideActions.newTemplateSlide, {
      template,
      text: props.text,
    })
    usePosthogCapture("NEW_TEMPLATE_SLIDE_CREATED", {
      templateId: template._id,
      source: template.source,
      category: template.category,
      from: "transcript",
    })
  } else {
    useGlobalEmit(appWideActions.newTemplateSlide, { template })
    usePosthogCapture("NEW_TEMPLATE_SLIDE_CREATED", {
      templateId: template._id,
      source: template.source,
      category: template.category,
    })
  }
  emit("close")
}

const confirmDelete = async () => {
  const template = pendingDelete.value
  pendingDelete.value = null
  if (!template) return
  const ok = await deleteTemplate(template._id)
  if (ok) usePosthogCapture("TEMPLATE_DELETED", { templateId: template._id })
  toast.add({
    icon: ok ? "i-bx-check" : "i-bx-error",
    title: ok ? "Template deleted" : "Could not delete the template",
    color: ok ? undefined : "red",
  })
}
</script>

<style scoped>

.templates-main {
  animation: slideUp 0.3s ease-out;
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.cow-chip-row {
  scrollbar-width: none;
}
.cow-chip-row::-webkit-scrollbar {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .templates-main {
    animation: none;
  }
}
</style>
