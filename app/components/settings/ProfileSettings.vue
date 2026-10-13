<template>
  <div
    class="settings-ctn h-[100%] overflow-y-auto mb-[2.5%] p-1 pb-[15%] flex flex-col gap-8"
  >
    <!-- PROFILE -->
    <SettingsGroup title="Profile">
      <div class="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div class="flex min-w-0 flex-1 flex-col gap-3">
          <CowInput
            v-model="fullName"
            label="Full name"
            autocomplete="name"
            :error="nameError"
            @keyup.enter="save"
          />

          <CowPhoneInput
            v-model="phone"
            label="Phone number"
            :error="phoneError"
          />

          <!-- EMAIL -->
          <ProfileEmailChange />

          <CowButton
            block
            class="mt-2"
            :loading="saving"
            :disabled="!dirty"
            @click="save"
          >
            Save profile
          </CowButton>
        </div>

        <SettingsImageUpload
          class="w-full sm:w-[230px] sm:shrink-0"
          vertical
          :src="authStore.user?.avatar"
          :fallback-text="authStore.user?.fullname?.[0]"
          noun="photo"
          :max-bytes="AVATAR_MAX_BYTES"
          :uploading="photoBusy"
          @upload="uploadPhoto"
          @remove="removePhoto"
        />
      </div>
    </SettingsGroup>

    <!-- CHURCH -->
    <ProfileChurchSection />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"

const authStore = useAuthStore()
const toast = useToast()
const { updateProfile } = useUser()

// A profile photo renders at avatar size everywhere, so a megabyte is plenty.
const AVATAR_MAX_BYTES = 1024 * 1024

const fullName = ref<string>(authStore.user?.fullname || "")
// Kept in the international "+2348123456789" form CowPhoneInput produces.
const phone = ref<string>(authStore.user?.phone || "")
const nameError = ref("")
const phoneError = ref("")
const saving = ref(false)
const photoBusy = ref(false)

const dirty = computed(
  () =>
    fullName.value.trim() !== (authStore.user?.fullname || "") ||
    phone.value !== (authStore.user?.phone || "")
)

const save = async () => {
  nameError.value = ""
  phoneError.value = ""
  if (fullName.value.trim().length < 2) {
    nameError.value = "Please enter your full name."
    return
  }
  // The phone number is optional, but a half-typed one is not worth saving.
  // A number saved earlier in another format is left alone unless it is edited.
  const phoneChanged = phone.value !== (authStore.user?.phone || "")
  if (phoneChanged && phone.value && !/^\+\d{8,15}$/.test(phone.value)) {
    phoneError.value = "Enter a valid phone number."
    return
  }

  saving.value = true
  const updated = await updateProfile({
    fullname: fullName.value.trim(),
    phone: phone.value,
  })
  saving.value = false

  if (updated) {
    fullName.value = updated.fullname
    phone.value = updated.phone || ""
  }
}

const uploadPhoto = async (file: File) => {
  photoBusy.value = true
  try {
    const compressed = await useCompressedImage(file)
    const uploaded = await useUploadImage(compressed)
    await updateProfile({ avatar: uploaded.file.url })
  } catch (error: any) {
    toast.add({
      title: "Could not upload the photo",
      description: error?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } finally {
    photoBusy.value = false
  }
}

const removePhoto = async () => {
  photoBusy.value = true
  await updateProfile({ avatar: "" })
  photoBusy.value = false
}
</script>
