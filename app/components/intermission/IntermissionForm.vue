<template>
  <div class="intermission-form flex flex-col gap-4 text-gray-800 dark:text-[#F8F9FB]">
    <div class="flex flex-col gap-3" :class="{ 'sm:flex-row': !narrow }">
      <CowInput
        :model-value="local.heading"
        label="Heading"
        maxlength="60"
        class="flex-1"
        @update:model-value="update({ heading: $event })"
      />
      <CowInput
        :model-value="local.subtitle"
        label="Sub text"
        maxlength="70"
        class="flex-1"
        @update:model-value="update({ subtitle: $event })"
      />
    </div>

    <CowDropdown
      label="Text background"
      :model-value="textBackgroundLabels[local.textBackground]"
      :options="Object.values(textBackgroundLabels)"
      @update:model-value="onTextBackground"
    />

    <div>
      <p class="mb-2 text-xs text-gray-500 dark:text-[#9BA3B2]">
        Animation · hover to preview
      </p>
      <div
        class="grid gap-[8.5px]"
        :class="narrow ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4'"
      >
        <button
          v-for="variant in intermissionVariants"
          :key="variant.id"
          type="button"
          class="min-w-0 rounded-xl bg-white/70 p-2 text-left ring-2 transition-colors dark:bg-[#222838]"
          :class="
            local.variant === variant.id
              ? 'bg-white ring-primary-300 dark:bg-[#2B3140] dark:ring-[#E8D1F8]'
              : 'ring-transparent hover:bg-white dark:hover:bg-[#2B3140]'
          "
          :aria-pressed="local.variant === variant.id"
          @click="update({ variant: variant.id })"
          @mouseenter="previewing = variant.id"
          @mouseleave="stopPreview(variant.id)"
          @focus="previewing = variant.id"
          @blur="stopPreview(variant.id)"
        >
          <div
            class="relative w-full overflow-hidden rounded-lg"
            style="aspect-ratio: 16 / 9"
          >
            <IntermissionView
              :slide="previewSlide(variant.id)"
              :mode="previewing === variant.id ? 'preview' : undefined"
            />
          </div>
          <span class="mt-1.5 block truncate text-[12px] leading-4">
            {{ variant.name }}
          </span>
          <p
            class="text-[10px] leading-4 text-gray-500 dark:text-[#9BA3B2]"
            :class="{ truncate: !narrow }"
            :title="variant.best"
          >
            {{ variant.best }}
          </p>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IntermissionSlideData, Slide } from "~/types"
import { intermissionVariants } from "~/utils/intermission/engine"
import { intermissionModeKey } from "~/utils/intermission/context"

type IntermissionInput = Omit<IntermissionSlideData, "id">

const props = defineProps<{
  modelValue: IntermissionInput
  /** One card per row, for the narrow Quick Actions panel. */
  narrow?: boolean
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: IntermissionInput): void
}>()

// Thumbnails are still frames, even inside the animated editor. Only the one
// under the pointer (or keyboard focus) animates, so at most one runs at once.
provide(intermissionModeKey, "static")
const previewing = ref<string | null>(null)
const stopPreview = (id: string) => {
  if (previewing.value === id) previewing.value = null
}

// Seeded once: the parent keys this form by slide, so a prop echo of our own
// update never overwrites text the operator is still typing.
const local = reactive<IntermissionInput>({ ...props.modelValue })

const textBackgroundLabels: Record<IntermissionInput["textBackground"], string> =
  {
    auto: "Animation default",
    on: "Always on",
    off: "Off",
  }

const update = (patch: Partial<IntermissionInput>) => {
  Object.assign(local, patch)
  emit("update:modelValue", { ...local })
}

const onTextBackground = (label: string) => {
  const entry = Object.entries(textBackgroundLabels).find(
    ([, value]) => value === label
  )
  if (entry) update({ textBackground: entry[0] as IntermissionInput["textBackground"] })
}

const previewSlide = (variant: string) =>
  ({
    id: `intermission-preview-${variant}`,
    data: { id: variant, ...local, variant },
  }) as unknown as Slide
</script>
