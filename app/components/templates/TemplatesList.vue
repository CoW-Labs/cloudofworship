<template>
  <div class="templates-main min-h-[80vh] h-[100%]" ref="templatesContainer">
    <!-- CATEGORY TABS -->
    <!-- <UTabs :items="categoryTabs" @change="activeCategory = $event">
      <template #default="{ item }">
        <div class="flex gap-2 capitalize">
          <IconWrapper :name="item.icon" size="4" />
          {{ item.label }}s
        </div>
      </template>
    </UTabs> -->

    <!-- Superadmin Info Banner -->
    <div
      v-if="authStore.user?.role === 'superadmin'"
      class="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3"
    >
      <div class="flex items-start gap-2">
        <IconWrapper
          name="i-bx-shield"
          size="4"
          class="text-blue-600 dark:text-blue-400 mt-0.5"
        />
        <p class="text-xs text-blue-800 dark:text-blue-200">
          As a superadmin, you can create, edit, and delete templates.
        </p>
      </div>
    </div>

    <!-- SEARCH AND CLOSE -->
    <div class="flex gap-2 come-up-1 mt-2">
      <UInput
        icon="i-bx-search"
        :placeholder="`Search ${categoryTabs[activeCategory].label} templates`"
        v-model="searchInput"
        class="w-[100%]"
        @input="onSearchInput"
        @input.capture="loading = true"
      />
      <UButton icon="i-bx-x" color="primary" @click="$emit('close')"></UButton>
    </div>

    <!-- LOADING STATE -->
    <div
      v-if="loading"
      class="actions-ctn mt-2 overflow-y-auto max-h-[calc(100vh-350px)]"
    >
      <USkeleton
        v-for="i in 10"
        :key="i"
        class="w-[100%] h-[100px] mt-2"
      ></USkeleton>
    </div>

    <!-- TEMPLATES DISPLAY -->
    <template v-else>
      <template v-if="searchInput.length < 2">
        <div
          class="actions-ctn mt-2 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
        >
          <EmptyState
            v-if="displayedTemplates?.length === 0"
            icon="i-tabler-layout-grid"
            sub="No templates available yet."
            desc="Templates help you quickly create beautiful slides"
          />
          <RecycleScroller
            v-else
            class="h-[calc(100vh-300px)]"
            :items="displayedTemplates"
            :item-size="110"
            key-field="_id"
            v-slot="{ item: template }"
          >
            <TemplateCard
              :key="template._id"
              :template="template"
              @use-template="useTemplate($event)"
            />
          </RecycleScroller>
        </div>
      </template>

      <!-- SEARCH RESULTS -->
      <template v-else>
        <div
          class="actions-ctn mt-2 overflow-x-hidden max-h-[calc(100vh-300px)] come-up-1"
        >
          <EmptyState
            v-if="searchResults?.length === 0"
            icon="i-tabler-search"
            sub="No templates found matching your query"
          />
          <RecycleScroller
            v-else
            class="h-[calc(100vh-300px)]"
            :items="searchResults"
            :item-size="110"
            key-field="_id"
            v-slot="{ item: template }"
          >
            <TemplateCard
              :key="template._id"
              :template="template"
              @use-template="useTemplate($event)"
            />
          </RecycleScroller>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { Template, Slide } from "~/types"
import { useTemplateStore } from "~/store/template"
import { useAuthStore } from "~/store/auth"
import { useDebounceFn } from "@vueuse/core"
import { useAppStore } from "~/store/app"
import fuzzysort from "fuzzysort"
import { appWideActions } from "~/utils/constants"

const emit = defineEmits(["close"])
const toast = useToast()
const templateStore = useTemplateStore()
const authStore = useAuthStore()
const { fetchTemplates } = useTemplates()

const categoryTabs = [
  { label: "all", icon: "i-bx-grid-alt" },
  { label: "worship", icon: "i-bx-music" },
  { label: "sermon", icon: "i-bx-book-open" },
  { label: "announcement", icon: "i-bx-bell" },
  { label: "prayer", icon: "i-bx-heart" },
  { label: "general", icon: "i-bx-slideshow" },
]

const activeCategory = ref<number>(0)
const searchInput = ref<string>("")
const loading = ref<boolean>(true)
const searchResults = ref<Template[]>([])
const templatesContainer = ref<HTMLDivElement | null>(null)

// Fetch templates on mount
onMounted(async () => {
  loading.value = true
  try {
    const templates = await fetchTemplates()
    if (templates) {
      templateStore.setTemplates(templates)
    }
  } catch (error) {
    console.error("Failed to load templates:", error)
    toast.add({
      icon: "i-bx-error",
      title: "Failed to load templates",
      color: "red",
    })
  } finally {
    loading.value = false
  }
})

// Computed templates based on category
const displayedTemplates = computed(() => {
  const category = categoryTabs[activeCategory.value].label
  if (category === "all") {
    return templateStore.allTemplates
  }
  return templateStore.templatesByCategory(category)
})

// Search functionality
const onSearchInput = useDebounceFn(() => {
  if (searchInput.value.length < 2) {
    searchResults.value = []
    loading.value = false
    return
  }

  const results = fuzzysort.go(searchInput.value, templateStore.allTemplates, {
    keys: ["name", "description", "category"],
    threshold: -10000,
  })

  searchResults.value = results.map((result) => result.obj)
  loading.value = false
}, 300)

// Use template - emit event similar to saved slides
const useTemplate = (template: Template) => {
  const slide = template.slideId as Slide

  if (!slide) {
    toast.add({
      icon: "i-bx-error",
      title: "Template slide not found",
      color: "red",
    })
    return
  }

  // Emit the slide to be used similar to saved slides
  useGlobalEmit(`new-${slide.type}`, [
    {
      ...slide,
      fromTemplate: true,
      scheduleId: useAppStore().currentState?.activeSchedule?._id,
    },
  ])

  emit("close")
}

// Watch category changes
watch(activeCategory, () => {
  searchInput.value = ""
  searchResults.value = []
})
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
</style>
