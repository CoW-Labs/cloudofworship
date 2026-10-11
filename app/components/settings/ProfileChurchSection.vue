<template>
  <SettingsGroup
    v-if="church"
    title="Church"
    :note="
      canEdit
        ? 'These details show up around the app for everyone on your team.'
        : 'Only a church admin can change these details.'
    "
  >
    <div
      v-if="canEdit"
      class="flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:gap-6"
    >
      <form
        class="flex min-w-0 flex-1 flex-col gap-3"
        @submit.prevent="save"
      >
        <CowInput v-model="name" label="Church name" :error="nameError" />
        <CowInput v-model="pastor" label="Pastor" :error="pastorError" />
        <CowInput v-model="address" label="Address" />
        <CowInput
          v-model="churchEmail"
          label="Church email"
          type="email"
          :error="emailError"
        />
        <CowButton
          type="submit"
          block
          class="mt-2"
          :loading="saving"
          :disabled="!dirty"
        >
          Save church details
        </CowButton>
      </form>

      <SettingsImageUpload
        class="w-full sm:w-[230px] sm:shrink-0"
        vertical
        :src="church.logo"
        :fallback-text="church.name?.[0]"
        noun="logo"
        shape="square"
        remove-label="Use default logo"
        :removable="!!church.logoIsCustom"
        :uploading="logoBusy"
        hint="PNG, JPG or WebP, up to 10 MB. Square logos look best."
        @upload="uploadLogo"
        @remove="resetLogo"
      />
    </div>

    <template v-else>
      <SettingsRow label="Church name" :description="church.name" />
      <SettingsRow v-if="church.pastor" label="Pastor" :description="church.pastor" />
      <SettingsRow v-if="church.address" label="Address" :description="church.address" />
    </template>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/store/auth"

const authStore = useAuthStore()
const { fetchChurch, updateChurch } = useChurch()
const toast = useToast()

const church = computed(() => authStore.church)
const canEdit = computed(() =>
  ["admin", "superadmin"].includes(authStore.user?.role ?? "")
)

const name = ref("")
const pastor = ref("")
const address = ref("")
const churchEmail = ref("")
const nameError = ref("")
const pastorError = ref("")
const emailError = ref("")
const saving = ref(false)
const logoBusy = ref(false)

// Mirrors the API's own length rules so the common mistakes are caught before
// a round trip; the API still has the final say.
const MIN_NAME = 4
const MIN_PASTOR = 2

const fillFromChurch = () => {
  name.value = church.value?.name ?? ""
  pastor.value = church.value?.pastor ?? ""
  address.value = church.value?.address ?? ""
  churchEmail.value = church.value?.email ?? ""
}

const dirty = computed(
  () =>
    name.value.trim() !== (church.value?.name ?? "") ||
    pastor.value.trim() !== (church.value?.pastor ?? "") ||
    address.value.trim() !== (church.value?.address ?? "") ||
    churchEmail.value.trim() !== (church.value?.email ?? "")
)

const save = async () => {
  nameError.value = ""
  pastorError.value = ""
  emailError.value = ""

  if (name.value.trim().length < MIN_NAME) {
    nameError.value = "Enter a valid church name."
    return
  }
  if (pastor.value.trim().length < MIN_PASTOR) {
    pastorError.value = "Enter a valid pastor name."
    return
  }
  if (churchEmail.value.trim() && !useValidEmail(churchEmail.value.trim())) {
    emailError.value = "Enter a valid email address."
    return
  }

  saving.value = true
  const updated = await updateChurch(church.value!._id, {
    name: name.value.trim(),
    pastor: pastor.value.trim(),
    address: address.value.trim(),
    email: churchEmail.value.trim(),
  })
  saving.value = false

  if (updated) fillFromChurch()
}

const uploadLogo = async (file: File) => {
  logoBusy.value = true
  try {
    const compressed = await useCompressedImage(file)
    const uploaded = await useUploadImage(compressed)
    await updateChurch(church.value!._id, { logo: uploaded.file.url })
  } catch (error: any) {
    toast.add({
      title: "Could not upload the logo",
      description: error?.message,
      color: "red",
      icon: "i-bx-error",
    })
  } finally {
    logoBusy.value = false
  }
}

const resetLogo = async () => {
  logoBusy.value = true
  await updateChurch(church.value!._id, { logo: null })
  logoBusy.value = false
}

onMounted(async () => {
  if (!church.value && authStore.user?.churchId) {
    await fetchChurch(undefined, false)
  }
  fillFromChurch()
})
</script>
