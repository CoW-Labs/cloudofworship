<template>
  <div class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%]">
    <SettingsGroup
      title="Default Slide Background"
      note="These settings ONLY apply to new slides."
    >
      <div class="rounded-2xl bg-[#f1f3f6] dark:bg-[#1b212e] p-2">
        <UTabs
          :items="slideBackgroundTabs"
          v-model:model-value="activeSlideBackgroundTab"
        />
        <Transition name="fade">
          <div class="tab-content mt-2">
            <BgVideoSelection
              v-if="activeSlideBackgroundTab === 0"
              settings-page
              :value="
                appStore.currentState.settings.defaultBackground.default
                  ?.background
              "
              @select="
                appStore.setDefaultSlideBackground(
                  backgroundTypes.video,
                  $event.video,
                  $event.key
                )
              "
            />
            <BgImageSelection
              v-else-if="activeSlideBackgroundTab === 1"
              settings-page
              :value="
                appStore.currentState.settings.defaultBackground.default
                  ?.background
              "
              @select="
                appStore.setDefaultSlideBackground(
                  backgroundTypes.image,
                  $event.image,
                  null
                )
              "
            />
            <BgColorSelection
              v-else-if="activeSlideBackgroundTab === 2"
              :count="12"
              :value="
                appStore.currentState.settings.defaultBackground.default
                  ?.background
              "
              @select="
                appStore.setDefaultSlideBackground(
                  backgroundTypes.solid,
                  $event.color,
                  null
                )
              "
            />
            <BgGradientSelection
              v-else-if="activeSlideBackgroundTab === 3"
              :count="12"
              :value="
                appStore.currentState.settings.defaultBackground.default
                  ?.background
              "
              @select="
                appStore.setDefaultSlideBackground(
                  backgroundTypes.gradient,
                  $event.gradient,
                  null
                )
              "
            />
          </div>
        </Transition>
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

const appStore = useAppStore()

const slideBackgroundTabs = [
  { label: "Video", icon: "i-bx-video" },
  { label: "Image", icon: "i-bx-image" },
  { label: "Color", icon: "i-bx-paint" },
  { label: "Gradient", icon: "i-mdi-gradient-horizontal" },
]
const activeSlideBackgroundTab = ref<number>(0)

// Set default activeSlideBackgroundTab
switch (
  appStore.currentState.settings.defaultBackground.default?.backgroundType
) {
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
</style>
