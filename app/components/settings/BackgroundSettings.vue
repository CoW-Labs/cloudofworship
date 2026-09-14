<template>
  <div class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%]">
    <SettingsGroup
      title="Default Slide Background"
      note="These settings ONLY apply to new slides."
    >
      <div class="flex flex-wrap gap-1.5 rounded-2xl bg-[#f1f3f6] dark:bg-[#1b212e] p-1.5">
        <button
          v-for="group in slideBackgroundGroups"
          :key="group.key"
          type="button"
          class="group-pill"
          :class="{ 'group-pill--active': activeGroupKey === group.key }"
          @click="activeGroupKey = group.key"
        >
          <UIcon :name="group.icon" class="w-4 h-4" />
          <span>{{ group.label }}</span>
          <span
            v-if="group.key !== 'default' && isGroupCustomised(group.key)"
            class="group-pill__dot"
            title="Using its own background"
          />
        </button>
      </div>

      <p class="px-1 text-xs leading-relaxed text-gray-500 dark:text-[#9aa3b2]">
        {{ activeGroup.description }}
      </p>

      <SettingsRow
        v-if="activeGroupKey !== 'default'"
        :label="`Give ${activeGroup.label} slides their own background`"
        description="Turn off to follow the background set under “All slides”."
      >
        <CowToggle
          bare
          :label="`Give ${activeGroup.label} slides their own background`"
          :model-value="isGroupCustomised(activeGroupKey)"
          @update:model-value="onToggleGroupOverride"
        />
      </SettingsRow>

      <Transition name="fade-sm">
        <div
          v-if="isEditable"
          class="rounded-2xl bg-[#f1f3f6] dark:bg-[#1b212e] p-2"
        >
          <UTabs
            :items="slideBackgroundTabs"
            v-model:model-value="activeSlideBackgroundTab"
          />
          <Transition name="fade">
            <div class="tab-content mt-2">
              <BgVideoSelection
                v-if="activeSlideBackgroundTab === 0"
                settings-page
                :value="activeBackground?.background"
                :value-key="activeBackground?.backgroundVideoKey"
                @select="
                  setBackground(backgroundTypes.video, $event.video, $event.key)
                "
              />
              <BgImageSelection
                v-else-if="activeSlideBackgroundTab === 1"
                settings-page
                :value="activeBackground?.background"
                :value-key="activeBackground?.backgroundImageKey"
                @select="
                  setBackground(
                    backgroundTypes.image,
                    $event.image,
                    null,
                    $event.key
                  )
                "
              />
              <BgColorSelection
                v-else-if="activeSlideBackgroundTab === 2"
                :count="12"
                :value="activeBackground?.background"
                @select="setBackground(backgroundTypes.solid, $event.color)"
              />
              <BgGradientSelection
                v-else-if="activeSlideBackgroundTab === 3"
                :count="12"
                :value="activeBackground?.background"
                @select="
                  setBackground(backgroundTypes.gradient, $event.gradient)
                "
              />
            </div>
          </Transition>
        </div>
      </Transition>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
import type { SlideBackgroundKey } from "~/types"

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const slideBackgroundTabs = [
  { label: "Video", icon: "i-bx-video" },
  { label: "Image", icon: "i-bx-image" },
  { label: "Color", icon: "i-bx-paint" },
  { label: "Gradient", icon: "i-mdi-gradient-horizontal" },
]
const activeSlideBackgroundTab = ref<number>(0)
const activeGroupKey = ref<SlideBackgroundKey>("default")

const activeGroup = computed(
  () =>
    slideBackgroundGroups.find((group) => group.key === activeGroupKey.value) ||
    slideBackgroundGroups[0]!
)

const defaultBackground = computed(
  () => currentState.value.settings.defaultBackground
)

/** The entry being edited — for a per-type group, only once it is customised. */
const activeBackground = computed(() =>
  activeGroupKey.value === "default"
    ? defaultBackground.value?.default
    : defaultBackground.value?.[activeGroupKey.value]
)

// A per-slide-type group only overrides the app-wide default once the user has
// picked a background for it; the entries themselves ship with seeded values.
const isGroupCustomised = (key: SlideBackgroundKey) =>
  key === "default"
    ? true
    : Boolean(defaultBackground.value?.[key]?.custom)

const isEditable = computed(
  () => activeGroupKey.value === "default" || isGroupCustomised(activeGroupKey.value)
)

const setBackground = (
  type: string,
  background: string,
  backgroundVideoKey: string | null = null,
  backgroundImageKey: string | null = null
) => {
  appStore.setDefaultSlideBackground(
    type,
    background,
    backgroundVideoKey,
    backgroundImageKey,
    activeGroupKey.value
  )
}

const onToggleGroupOverride = (enabled: boolean) => {
  const key = activeGroupKey.value
  if (key === "default") return

  if (!enabled) {
    appStore.clearDefaultSlideBackground(key)
    return
  }

  appStore.enableDefaultSlideBackground(key)
}

// Point the tabs at whichever media type the selected group is already using.
const syncActiveTab = () => {
  switch (activeBackground.value?.backgroundType) {
    case backgroundTypes.video:
      activeSlideBackgroundTab.value = 0
      break
    case backgroundTypes.image:
      activeSlideBackgroundTab.value = 1
      break
    case backgroundTypes.solid:
      activeSlideBackgroundTab.value = 2
      break
    case backgroundTypes.gradient:
      activeSlideBackgroundTab.value = 3
      break
  }
}

syncActiveTab()
watch(activeGroupKey, syncActiveTab)
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-sm-enter-active,
.fade-sm-leave-active {
  transition: opacity 0.2s ease;
}
.fade-sm-enter-from,
.fade-sm-leave-to {
  opacity: 0;
}

.group-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 0.75rem;
  padding: 0.4rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.group-pill:hover {
  background-color: rgba(255, 255, 255, 0.6);
}

.group-pill--active {
  background-color: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.group-pill__dot {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 9999px;
  background-color: rgb(var(--color-primary-500, 147 51 234));
}

html.dark .group-pill {
  color: #9aa3b2;
}

html.dark .group-pill:hover {
  background-color: rgba(148, 163, 184, 0.12);
}

html.dark .group-pill--active {
  background-color: #131a27;
  color: #f8fafc;
}
</style>
