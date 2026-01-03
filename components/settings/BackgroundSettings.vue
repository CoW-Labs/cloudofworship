<template>
  <div class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] pb-[15%]">
    <!-- SLIDE BACKGROUNDS -->
    <div class="settings-group">
      <!-- <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">

          <div class="text-primary">Settings ONLY apply to new slides</div>
        </h3>
      </div> -->
      <UForm :state="{}">
        <UFormGroup label="Set default slide background" class="px-2 py-3">
          <UTabs
            :items="slideBackgroundTabs"
            v-model:model-value="activeSlideBackgroundTab"
          />
          <Transition class="fade">
            <div class="tab-content">
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
            </div>
          </Transition>
        </UFormGroup>
      </UForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"

const appStore = useAppStore()

const slideBackgroundTabs = [
  { label: "Video", icon: "i-bx-video" },
  { label: "Image", icon: "i-bx-image" },
  { label: "Color", icon: "i-bx-paint" },
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
