<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Save as Template</h3>
          <UButton color="gray" variant="ghost" aria-label="Close" @click="isOpen = false">
            <template #leading><CloseIcon class="h-5 w-5" /></template>
          </UButton>
        </div>
      </template>

      <!-- A template keeps a slide's layout, so the slide needs free layout boxes. -->
      <div v-if="!design" class="space-y-3 text-sm">
        <p>
          Templates keep where the text sits, so this slide needs free layout
          first.
        </p>
        <p class="text-gray-500 dark:text-[#9aa3b2]">
          Open the slide's editor, choose Free layout, place your text, then
          save it again.
        </p>
        <div class="flex justify-end pt-2">
          <UButton label="Got it" size="lg" @click="isOpen = false" />
        </div>
      </div>

      <div v-else class="space-y-4">
        <div class="overflow-hidden rounded-lg ring-1 ring-gray-200/70 dark:ring-white/10">
          <TemplatePreview :design="design" />
        </div>

        <UFormGroup label="Name" size="lg" required>
          <UInput
            v-model="name"
            placeholder="e.g. Sunday welcome, Youth night"
            maxlength="60"
          />
        </UFormGroup>

        <UFormGroup label="Category" size="lg" required>
          <CowSelectMenu
            v-model="category"
            :options="categories"
            placeholder="Select category"
            size="lg"
          />
        </UFormGroup>

        <label class="flex cursor-pointer items-start gap-2 text-sm">
          <input v-model="keepText" type="checkbox" class="mt-1" />
          <span>
            Keep this slide's words
            <span class="block text-xs text-gray-500 dark:text-[#9aa3b2]">
              Off by default, so last week's notice does not come back.
            </span>
          </span>
        </label>

        <p
          v-if="slide && losesPicture(slide)"
          class="text-xs text-amber-700 dark:text-amber-400"
        >
          Your own background picture is not kept. The template uses a dark
          background instead.
        </p>

        <p class="text-xs text-gray-500 dark:text-[#9aa3b2]">
          Your whole church can use it from Slide Templates, under Mine.
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <UButton label="Cancel" color="gray" variant="ghost" size="lg" @click="isOpen = false" />
          <UButton
            label="Save Template"
            icon="i-bx-save"
            size="lg"
            :loading="saving"
            :disabled="!name.trim() || !category"
            @click="saveTemplate"
          />
        </div>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import type { Slide, TemplateCategory } from "~/types"
import { designFromSlide, losesPicture } from "~/utils/templates/apply"

const props = defineProps<{
  slide: Slide | null
  modelValue: boolean
}>()
const emit = defineEmits(["update:modelValue", "saved"])

const toast = useToast()
const { createTemplate } = useTemplates()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
})

const categories: TemplateCategory[] = [
  "worship",
  "sermon",
  "announcement",
  "prayer",
  "general",
  "live",
]

const name = ref("")
const category = ref<TemplateCategory>("general")
const keepText = ref(false)
const saving = ref(false)

// What would be saved, drawn live so the church sees what it is keeping.
const design = computed(() =>
  props.slide ? designFromSlide(props.slide, { keepText: keepText.value }) : null
)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = props.slide?.name ?? ""
    category.value = "general"
    keepText.value = false
    usePosthogCapture("SAVE_AS_TEMPLATE_OPENED", {
      slideType: props.slide?.type,
      hasBoxes: !!design.value,
    })
  }
)

const saveTemplate = async () => {
  if (!design.value || saving.value) return
  saving.value = true
  try {
    await createTemplate({
      name: name.value.trim(),
      category: category.value,
      design: design.value,
    })
    usePosthogCapture("TEMPLATE_SAVED", {
      category: category.value,
      slideType: props.slide?.type,
      keptText: keepText.value,
      boxCount: design.value.boxes.length,
    })
    toast.add({ icon: "i-bx-check", title: "Template saved" })
    emit("saved")
    isOpen.value = false
  } catch (error) {
    usePosthogCapture("TEMPLATE_SAVE_FAILED", {
      error: error instanceof Error ? error.message : "unknown",
    })
    toast.add({
      icon: "i-bx-error",
      title: "Could not save the template",
      description: "Check your connection and try again.",
      color: "red",
    })
  } finally {
    saving.value = false
  }
}
</script>
