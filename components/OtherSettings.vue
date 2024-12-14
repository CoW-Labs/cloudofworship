<template>
  <div class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] pb-[15%]">
    <!-- ALERT SETTINGS -->
    <div class="settings-group">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-md font-semibold">Alert Settings</h3>
      </div>
      <UForm>
        <UFormGroup label="Set default alert limit">
          <div
            class="flex px-0 items-center gap-2 font-semibold max-w-[200px] mt-2"
          >
            <span class="text-sm whitespace-nowrap">5</span>
            <URange
              :model-value="currentState.settings.transitionInterval"
              min="5"
              max="30"
              step="1"
              @change="
                appStore.setAppSettings({
                  ...appStore.currentState.settings,
                  alertLimit: $event,
                })
              "
            />
            <span class="text-sm whitespace-nowrap"> 30</span>
          </div>
          <div class="text-xs mt-2 text-gray-500">
            Current Alert Limit:
            {{ currentState.settings.alertLimit }} alerts
          </div>
        </UFormGroup>
      </UForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from "~/store/app"
const appStore = useAppStore()
const { currentState } = storeToRefs(appStore)
</script>
