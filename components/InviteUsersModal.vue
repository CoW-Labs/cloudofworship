<template>
  <div class="flex">
    <UModal
      v-model="visible"
      :ui="{
        base: 'min-w-[600px]',
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
              Invite people to {{ authStore.church?.type }} Media
            </h2>
            <div class="actions flex items-center gap-2">
              <UButton
                icon="i-bx-link"
                variant="ghost"
                @click="copyToClipboard"
                >{{ copied ? "Copied!" : "Copy link" }}</UButton
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
        <div class="invite-content">
          <div class="flex invite-input gap-2 mb-2">
            <UFormGroup size="lg" class="w-[100%]">
              <UInput placeholder="member@mail.com" v-model="emailInput" />
            </UFormGroup>
            <UButton class="px-4"> Send Invite </UButton>
          </div>
          <div class="members flex-col flex gap-4 mt-6">
            <div
              v-for="(member, index) in authStore.church?.users"
              class="member flex items-center justify-between"
            >
              <div class="photo-name flex gap-4 items-center font-medium">
                <UAvatar
                  :alt="member?.fullname?.split(' ')?.[0]"
                  size="sm"
                  class="border-primary-500"
                  :ui="{
                    background: 'bg-primary-100 ring-0',
                    wrapper: 'bg-red-500',
                  }"
                />
                {{ member?.fullname }}
              </div>
              <div class="role text-sm">
                {{ index === 0 ? "Admin" : "Member" }}
              </div>
            </div>
          </div>
        </div>
        <div
          class="h-[88%] p-4 py-6 mt-8 flex justify-center gap-6 bg-primary-100 rounded-lg text-primary-900 relative overflow-hidden"
        >
          <!-- <IconWrapper name="i-tabler-rocket" size="16" /> -->
          <IconWrapper
            name="i-tabler-rocket"
            size="24"
            class="absolute opacity-10 -bottom-3 -left-3"
          />
          <div class="texts-action text-center max-w-[300px]">
            <div>
              <h2 class="text-md font-semibold">The more, the merrier.</h2>
              <p class="text-sm mt-1 mb-2">
                Invite more people to try out Cloud of Worshippers.
              </p>
            </div>
            <!-- <div class="btn-row flex gap-2 justify-center">
              <UButton icon="i-bx-share-alt" class="mt-2 text-primary-100">
                Share
              </UButton>
            </div> -->
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
const emailInput = ref<string>("")
const members = ref<User[]>([
  { fullname: "Favour Felix", role: "owner" },
  { fullname: "Inioluwa Adeniyi", role: "owner" },
])
const copied = ref<boolean>(false)

watch(
  () => props.visible,
  () => {
    visible.value = props.visible
  }
)

const copyToClipboard = () => {
  const input = document.createElement("input")
  input.value = `http://${location.host}/signup/${authStore.user?.churchId}`
  document.body.appendChild(input)
  input.select()
  document.execCommand("copy")
  copied.value = true
  setTimeout(() => {
    copied.value = null
  }, 2000)
  document.body.removeChild(input)
}
</script>
