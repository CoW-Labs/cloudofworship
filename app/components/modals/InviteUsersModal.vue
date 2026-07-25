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
      @close="emit('close')"
    >
      <div
        class="invite-card rounded-2xl bg-white dark:bg-[#171d2b] border border-white/80 dark:border-[#202838] overflow-hidden"
      >
        <!-- HEADER -->
        <div
          class="flex items-center justify-between gap-3 px-5 py-4"
        >
          <h2
            class="font-semibold text-base truncate text-gray-900 dark:text-white"
          >
            Invite people to {{ authStore.church?.type }} Media
          </h2>
          <div class="actions flex items-center gap-2 shrink-0">
            <CowButton
              variant="secondary"
              size="2xs"
              class="!px-3 !py-1.5 text-xs gap-1.5"
              @click="copyToClipboard"
            >
              <CopyIcon class="w-3.5 h-3.5" />
              {{ copied ? "Copied!" : "Copy invite link" }}
            </CowButton>

            <button
              class="grid h-8 w-8 place-items-center rounded-lg leading-none transition-colors hover:bg-gray-100 dark:hover:bg-[#222938]"
              aria-label="Close invite modal"
              @click="closeModal"
            >
              <CloseIcon
                class="block h-4 w-4 text-gray-600 dark:text-[#a7afbd]"
              />
            </button>
          </div>
        </div>

        <!-- BODY -->
        <div class="invite-content p-5">
          <div class="flex invite-input items-start gap-2">
            <CowInput
              class="flex-1"
              label="Email addresses"
              v-model="emailInput"
              @keyup.enter="sendEmailInvite"
            />
            <CowButton
              variant="primary"
              size="lg"
              :loading="loading"
              class="shrink-0"
              @click="sendEmailInvite"
            >
              Send Invite
            </CowButton>
          </div>
          <p class="text-xs text-gray-400 dark:text-[#9aa3b2] mt-2">
            Use commas to separate email addresses
          </p>

          <div class="members flex-col flex gap-4 mt-6">
            <div
              v-for="(member, index) in authStore.church?.users"
              :key="member?.fullname"
              class="member flex items-center justify-between"
            >
              <div class="photo-name flex gap-4 items-center font-medium">
                <UAvatar
                  :src="member?.avatar"
                  :text="member?.fullname?.split(' ')?.[0]?.[0]"
                  size="sm"
                  :ui="{
                    rounded: 'rounded-full',
                    text: `text-[${member?.theme}] dark:text-[${member?.theme}] font-semibold`,
                  }"
                  :class="`border-[${member?.theme}] bg-[${member?.theme}20] dark:bg-[${member?.theme}20]`"
                />
                {{ member?.fullname }}
              </div>
              <div class="role text-sm text-gray-500 dark:text-[#9aa3b2]">
                {{ index === 0 ? "Admin" : "Member" }}
              </div>
            </div>
          </div>

          <!-- PROMO BANNER -->
          <div
            class="promo p-6 mt-8 flex justify-center gap-6 bg-primary-100 dark:bg-primary-950 rounded-2xl text-primary-900 relative overflow-hidden"
          >
            <IconWrapper
              name="i-tabler-rocket"
              size="24"
              class="absolute opacity-10 -bottom-3 -left-3"
            />
            <div
              class="texts-action text-center max-w-[300px] dark:text-primary"
            >
              <h2 class="text-md font-semibold">The more, the merrier.</h2>
              <p class="text-sm mt-1">
                Invite more people to try out Cloud of Worship.
              </p>
            </div>
          </div>
        </div>
      </div>
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
const loading = ref<boolean>(false)
const copied = ref<boolean>(false)

watch(
  () => props.visible,
  () => {
    visible.value = props.visible
  }
)

const closeModal = () => {
  visible.value = false
  emit("close")
}

const copyToClipboard = () => {
  const input = document.createElement("input")
  input.value = `http://${location.host}/signup/${authStore.user?.churchId}`
  document.body.appendChild(input)
  input.select()
  document.execCommand("copy")
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
  document.body.removeChild(input)
}

const sendEmailInvite = async () => {
  loading.value = true
  const { data, error } = await useAPIFetch(
    `/church/${authStore.user?.churchId}/emailinvite`,
    {
      method: "POST",
      body: {
        churchId: authStore.user?.churchId,
        recipients: emailInput.value
          .split(",")
          ?.map((email) => ({ email: email?.trim() })),
      },
    }
  )
  if (error.value) {
    useToast().add({
      title: "Error sending email.",
      color: "red",
      icon: "i-bx-error",
    })
  } else {
    useToast().add({
      title: `Emails sent to ${
        emailInput.value?.split(",").length
      } recipients! 🎉`,
      color: "green",
    })
    usePosthogCapture("INVITED_USERS_EMAIL_SENT")
    emit("close")
  }
  loading.value = false
}
</script>
