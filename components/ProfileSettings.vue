<template>
  <div class="settings-ctn h-[100%]">
    <UFormGroup label="Full Name">
      <UInput
        class="border-0 shadow-none max-w-[250px]"
        input-class=" bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
        size="md"
        v-model="fullName"
      />
    </UFormGroup>
    <UFormGroup label="Email" class="mt-4">
      <UInput
        class="border-0 shadow-none max-w-[250px]"
        input-class=" bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
        size="md"
        v-model="email"
      />
    </UFormGroup>
    <UButton
      @click="updateProfile()"
      variant="outline"
      :disabled="
        email === authStore.user?.email && fullName === authStore.user?.fullname
      "
      class="mt-6 w-full max-w-[250px] justify-center"
    >
      Update Profile
    </UButton>
  </div>
</template>

<script setup lang="ts">
import type { Church, User } from "~/store/auth"
import { useAuthStore } from "~/store/auth"
const authStore = useAuthStore()
const toast = useToast()

const fullName = ref<string>(authStore.user?.fullname || "")
const email = ref<string>(authStore.user?.email || "")

const updateProfile = async () => {
  const { data, error } = await useAPIFetch("/user/update", {
    method: "PUT",
    body: {
      fullname: fullName.value,
      email: email.value,
    },
  })
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
