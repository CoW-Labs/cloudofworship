<template>
  <div
    class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%] flex flex-col gap-8"
  >
    <SettingsGroup
      title="Blank Screen"
      note="Shown on the live output whenever no slide is live. Leave it completely blank, or project a custom video/image background."
    >
      <SettingsRow
        label="Use a video / image background"
        description="Turn off to leave the screen completely blank. Turn on to project a custom video or image while idle."
      >
        <CowToggle
          bare
          label="Use a video / image background"
          :model-value="isMediaMode"
          @update:model-value="onToggleMode"
        />
      </SettingsRow>

      <!-- Media picker (only when media mode is enabled) -->
      <Transition name="fade-sm">
        <div
          v-if="isMediaMode"
          class="rounded-2xl bg-[#f1f3f6] dark:bg-[#1b212e] p-2"
        >
          <UTabs
            :items="mediaTabs"
            v-model:model-value="activeMediaTab"
          />
          <Transition name="fade">
            <div class="tab-content mt-2">
              <BgVideoSelection
                v-if="activeMediaTab === 0"
                settings-page
                :value="intermission?.background"
                @select="
                  appStore.setIntermissionSettings({
                    mode: 'media',
                    backgroundType: backgroundTypes.video,
                    background: $event.video,
                    backgroundVideoKey: $event.key,
                    backgroundImageKey: null,
                  })
                "
              />
              <BgImageSelection
                v-else-if="activeMediaTab === 1"
                settings-page
                :value="intermission?.background"
                @select="
                  appStore.setIntermissionSettings({
                    mode: 'media',
                    backgroundType: backgroundTypes.image,
                    background: $event.image,
                    backgroundVideoKey: null,
                    backgroundImageKey: $event.key || null,
                  })
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

const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)

const intermission = computed(() => currentState.value.settings.intermission)
const isMediaMode = computed(() => intermission.value?.mode === "media")

const mediaTabs = [
  { label: "Video", icon: "i-bx-video" },
  { label: "Image", icon: "i-bx-image" },
]
// Default the picker tab to whatever is already chosen.
const activeMediaTab = ref<number>(
  intermission.value?.backgroundType === backgroundTypes.image ? 1 : 0
)

const onToggleMode = (value: boolean) => {
  appStore.setIntermissionSettings({ mode: value ? "media" : "default" })
}
</script>
