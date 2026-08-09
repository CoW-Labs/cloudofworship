<template>
  <div class="settings-ctn h-[100%] max-w-[380px] flex flex-col gap-4 p-1">
    <CowInput v-model="fullName" label="Full name" />
    <CowInput v-model="email" label="Email" type="email" />

    <CowButton
      variant="primary"
      block
      class="mt-2"
      :disabled="
        email === authStore.user?.email && fullName === authStore.user?.fullname
      "
      :loading="loading"
      @click="updateProfile()"
    >
      Update Profile
    </CowButton>
  </div>
</template>

<script setup lang="ts">
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"
const authStore = useAuthStore()
const toast = useToast()

const fullName = ref<string>(authStore.user?.fullname || "")
const email = ref<string>(authStore.user?.email || "")
const loading = ref<boolean>(false)

const updateProfile = async () => {
  loading.value = true
  const { data, error } = await useAPIFetch("/user/update", {
    method: "PUT",
    body: {
      fullname: fullName.value,
      email: email.value,
    },
  })
  loading.value = false

  if (error.value) {
    toast.add({
      color: "red",
      title: "Error updating profile",
      icon: "i-bx-alert-circle",
    })
  } else {
    authStore.setUser(data.value as unknown as User)
    toast.add({
      color: "green",
      title: "Profile updated",
      icon: "i-bx-check-circle",
    })
  }
}
</script>
