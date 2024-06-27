<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        base: 'min-w-[700px]',
      }"
      @close="emit('close')"
    >
      <UCard
        :ui="{
          ring: '',
          divide: 'divide-y divide-gray-100 dark:divide-gray-800',
        }"
      >
        <template #header>
          <div class="flex justify-between items-center">
            <h2 class="font-semibold text-md truncate">
              Projects and Schedule
            </h2>
            <div class="actions flex items-center gap-2">
              <UButton
                icon="i-bx-search"
                color="primary"
                :variant="searchVisible ? 'outline' : 'ghost'"
                @click="searchVisible = !searchVisible"
                >Search</UButton
              >

              <UButton
                icon="i-mdi-close"
                variant="ghost"
                @click="
                  () => {
                    visible = false
                    emit('close')
                  }
                "
              ></UButton>
            </div>
          </div>
        </template>
        <div class="search-and-add-content">
          <Transition name="fade-sm">
            <div v-if="searchVisible" class="flex search-input gap-2 mb-4">
              <UFormGroup size="lg" class="w-[100%]">
                <UInput
                  icon="i-bx-search"
                  placeholder="Search for schedules"
                  v-model="emailInput"
                />
              </UFormGroup>
            </div>
          </Transition>
          <UButton
            block
            class="h-[170px] bg-primary-100 border border-primary-100 hover:bg-primary-100 hover:border-primary-500 transition-all flex-col gap-4 text-primary-500"
          >
            <PlusIcon />
            <div>New Schedule</div>
          </UButton>

          <div class="schedules-ctn mt-6">
            <p class="text-sm text-gray-400">Recent schedules</p>

            <div class="schedules flex-col flex gap-4 mt-4">
              <ScheduleCard v-for="i in 4" :key="i" />
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Emitter } from "mitt"
import { useAppStore } from "~/store/app"
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"

const appStore = useAppStore()
const authStore = useAuthStore()
const emit = defineEmits(["close"])

const props = defineProps<{
  visible: boolean
}>()

const visible = ref<boolean>(props.visible)
const searchVisible = ref<boolean>(false)
const emailInput = ref<string>("")
const loading = ref<boolean>(false)
const copied = ref<boolean>(false)

watch(
  () => props.visible,
  () => {
    visible.value = props.visible
  }
)
</script>
