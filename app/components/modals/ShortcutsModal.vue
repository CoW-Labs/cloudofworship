<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        rounded: 'rounded-2xl',
        background: 'bg-transparent dark:bg-transparent',
        ring: '',
        shadow: 'shadow-none',
        width: 'w-[94vw] sm:max-w-[600px]',
        overlay: { background: 'bg-gray-900/50 backdrop-blur-sm' },
      }"
    >
      <div
        class="shortcuts-card rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden"
      >
        <!-- HEADER -->
        <div class="flex items-center justify-between gap-3 px-5 py-4">
          <div class="text-and-link">
            <h2 class="font-semibold text-base text-gray-900 dark:text-white">
              Shortcuts & Hotkeys
            </h2>
            <p class="text-sm text-gray-400 dark:text-[#9aa3b2] mt-0.5">
              Speed up your workflow, get full Ctrl.
            </p>
          </div>
          <button
            class="grid h-8 w-8 place-items-center rounded-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#222938] shrink-0"
            aria-label="Close shortcuts modal"
            @click="visible = false"
          >
            <CloseIcon class="block h-4 w-4 text-gray-600 dark:text-[#a7afbd]" />
          </button>
        </div>

        <!-- BODY -->
        <div class="shortcuts-content px-5 pb-5 max-h-[70vh] overflow-y-auto">
          <div
            v-for="group in groupedShortcuts"
            :key="group.scope"
            class="mb-4 last:mb-0"
          >
            <h3
              class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-[#6b7386] px-1 pb-2"
            >
              {{ group.heading }}
            </h3>
            <ul class="flex flex-col gap-2">
              <li
                class="stuff flex items-center gap-4 rounded-2xl px-4 py-3 bg-white dark:bg-[#131a27] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] dark:shadow-[inset_0_0_0_1px_rgba(148,163,184,0.07)]"
                v-for="shortcut in group.items"
                :key="shortcut.id"
              >
                <div class="col min-w-[110px] whitespace-nowrap flex gap-1">
                  <span
                    v-for="(key, index) in shortcut.keys"
                    :key="`${shortcut.id}-${index}`"
                    class="text-sm mono font-bold bg-gray-100 dark:bg-[#222938] text-gray-500 dark:text-[#9aa3b2] inline-grid place-items-center p-1 px-2 min-w-[30px] rounded-md"
                  >
                    {{ key }}
                  </span>
                </div>
                <div class="col text-sm text-gray-700 dark:text-[#c5cbd6]">
                  {{ shortcut.label }}
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import {
  scopeHeadings,
  shortcuts as shortcutRegistry,
  type ShortcutScope,
} from "~/utils/shortcuts"

const visible = ref<boolean>(false)

defineProps<{
  visible: Boolean
}>()

const emitter = useNuxtApp().$emitter as Emitter<any>

// Rendered straight off the registry in ~/utils/shortcuts, so this sheet can't
// fall out of step with the keys that are actually bound.
const scopeOrder: ShortcutScope[] = [
  "global",
  "schedule",
  "slide",
  "editor",
  "live",
]

const groupedShortcuts = computed(() =>
  scopeOrder
    .map((scope) => ({
      scope,
      heading: scopeHeadings[scope],
      items: shortcutRegistry
        .filter((shortcut) => shortcut.scope === scope && !shortcut.hidden)
        .map((shortcut) => ({
          id: shortcut.id,
          label: shortcut.label,
          keys: useShortcutLabel(shortcut.combo),
        })),
    }))
    .filter((group) => group.items.length > 0)
)

emitter.on("open-shortcuts", () => {
  visible.value = true
})
</script>
