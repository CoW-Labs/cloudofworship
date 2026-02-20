<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Save as Template</h3>
          <UButton
            icon="i-bx-x"
            color="gray"
            variant="ghost"
            @click="isOpen = false"
          />
        </div>
      </template>

      <!-- Superadmin Check -->
      <div v-if="!isSuperAdmin" class="space-y-4">
        <div
          class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4"
        >
          <div class="flex items-start gap-3">
            <IconWrapper
              name="i-bx-info-circle"
              size="5"
              class="text-amber-600 dark:text-amber-400 mt-0.5"
            />
            <div>
              <h4 class="font-semibold text-amber-900 dark:text-amber-100">
                Superadmin Access Required
              </h4>
              <p class="text-sm text-amber-800 dark:text-amber-200 mt-1">
                Only superadmin users can create templates. Please contact your
                administrator if you need to create templates.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="space-y-4">
        <!-- Template Name -->
        <UFormGroup label="Template Name" size="lg" required>
          <UInput
            v-model="templateData.name"
            placeholder="e.g., Welcome Slide, Prayer Template"
          />
        </UFormGroup>

        <!-- Description -->
        <UFormGroup label="Description" size="lg" help="Optional">
          <UTextarea
            v-model="templateData.description"
            placeholder="Brief description of this template"
            :rows="3"
            variant="none"
            color="gray"
            autoresize
          />
        </UFormGroup>

        <!-- Category -->
        <UFormGroup label="Category" size="lg" required>
          <USelectMenu
            v-model="templateData.category"
            :options="categories"
            placeholder="Select category"
            size="lg"
          />
        </UFormGroup>

        <!-- Info Banner -->
        <div
          class="active-alert rounded-md bg-primary-100 dark:bg-primary-900 p-4"
        >
          <div
            class="text-sm text-primary-500 font-semibold flex items-center gap-2"
          >
            <IconWrapper name="i-bx-info-circle" size="4"></IconWrapper>
            Note
          </div>
          <p class="mt-2 text-sm">
            Templates are <span class="font-bold">public by default</span> and
            will be available to all users. Create reusable slide designs that
            help your community.
          </p>
        </div>
        <div class="flex justify-end gap-2 pt-8">
          <UButton
            label="Cancel"
            color="gray"
            variant="ghost"
            size="lg"
            @click="isOpen = false"
          />
          <UButton
            v-if="isSuperAdmin"
            label="Save Template"
            icon="i-bx-save"
            size="lg"
            :loading="saving"
            :disabled="!templateData.name || !templateData.category"
            @click="saveTemplate"
          />
        </div>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import type { Slide } from "~/types"
import { useTemplateStore } from "~/store/template"
import { useAuthStore } from "~/store/auth"

const props = defineProps<{
  slide: Slide | null
  modelValue: boolean
}>()

const emit = defineEmits(["update:modelValue", "saved"])

const toast = useToast()
const templateStore = useTemplateStore()
const authStore = useAuthStore()
const { createTemplate } = useTemplates()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
})

const isSuperAdmin = computed(() => authStore.user?.role === "superadmin")

const categories = ["general", "worship", "sermon", "announcement", "prayer"]

const templateData = ref({
  name: "",
  description: "",
  category: "general",
})

const saving = ref(false)

// Reset form when slide changes
watch(
  () => props.slide,
  (newSlide) => {
    if (newSlide) {
      templateData.value.name = `${newSlide.name} Template`
    }
  }
)

const saveTemplate = async () => {
  if (
    !props.slide ||
    !templateData.value.name ||
    !templateData.value.category
  ) {
    return
  }

  saving.value = true

  try {
    const template = await createTemplate({
      slideId: props.slide._id || props.slide.id,
      name: templateData.value.name,
      description: templateData.value.description,
      category: templateData.value.category,
    })

    if (template) {
      templateStore.addTemplate(template)
      toast.add({
        icon: "i-bx-check",
        title: "Template saved successfully",
        color: "green",
      })

      // Reset form
      templateData.value = {
        name: "",
        description: "",
        category: "general",
      }

      emit("saved")
      isOpen.value = false
    }
  } catch (error) {
    console.error("Failed to save template:", error)
    toast.add({
      icon: "i-bx-error",
      title: "Failed to save template",
      color: "red",
    })
  } finally {
    saving.value = false
  }
}

// Reset form when modal closes
watch(isOpen, (value) => {
  if (!value) {
    templateData.value = {
      name: "",
      description: "",
      category: "general",
    }
  }
})
</script>
