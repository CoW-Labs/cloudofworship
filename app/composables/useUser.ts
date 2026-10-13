import { useAuthStore } from '~/store/auth'
import type { User, Church } from '~/store/auth'

export type AccountCallResult = {
  ok: boolean
  message?: string
  code?: string
  data?: unknown
}

export default function useUser() {
  const authStore = useAuthStore()
  const toast = useToast()

  // Reactive states
  const loading = ref<boolean>(false)

  /**
   * Update user profile
   */
  const updateProfile = async (updateData: {
    fullname?: string
    email?: string
    [key: string]: any
  }): Promise<User | null> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch('/user/update', {
        method: 'PUT',
        body: updateData,
        key: 'update-user-profile',
      })

      if (error.value) {
        throw new Error(
          (error.value as any)?.data?.message ||
            error.value?.message ||
            'Failed to update profile'
        )
      }

      const updatedUser = data.value as unknown as User
      authStore.setUser(updatedUser)

      toast.add({
        icon: 'i-bx-check-circle',
        title: 'Profile updated successfully',
        color: 'green',
      })

      return updatedUser
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.add({
        icon: 'i-bx-alert-circle',
        title: 'Error updating profile',
        description: error.message,
        color: 'red',
      })
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Get user by ID
   */
  const getUserById = async (userId: string): Promise<User | null> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(`/user/${userId}`, {
        method: 'GET',
        key: `get-user-${userId}`,
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to fetch user')
      }

      return data.value as User
    } catch (error: any) {
      console.error('Error fetching user:', error)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Send email invitations to users
   */
  const sendEmailInvitations = async (
    churchId: string,
    emails: string[]
  ): Promise<boolean> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(
        `/church/${churchId}/emailinvite`,
        {
          method: 'POST',
          body: {
            churchId,
            recipients: emails.map((email) => ({ email: email?.trim() })),
          },
          key: 'send-email-invitations',
        }
      )

      if (error.value) {
        // `data.error` carries the API's own explanation (e.g. the Teams seat
        // limit); `message` is only the transport-level failure.
        const reason = (error.value as any)?.data?.error
        throw new Error(reason || error.value?.message || 'Failed to send invitations')
      }

      toast.add({
        icon: 'i-bx-mail-send',
        title: `Emails sent to ${emails.length} recipient(s)! 🎉`,
        color: 'green',
      })

      usePosthogCapture('INVITED_USERS_EMAIL_SENT')
      return true
    } catch (error: any) {
      console.error('Error sending email invitations:', error)
      toast.add({
        icon: 'i-bx-error',
        title: error?.message || 'Error sending email',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete user account
   */
  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch(`/user/${userId}`, {
        method: 'DELETE',
        key: `delete-user-${userId}`,
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to delete user')
      }

      toast.add({
        icon: 'i-tabler-trash',
        title: 'User deleted successfully',
      })

      return true
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to delete user',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * The three account-security calls below report back instead of toasting a
   * failure: the profile panel shows the API's own reason (wrong current
   * password, address already in use...) on the field it belongs to.
   */
  const accountCall = async (
    path: string,
    method: 'PUT' | 'POST',
    body: Record<string, unknown>
  ): Promise<AccountCallResult> => {
    loading.value = true
    try {
      // A fresh key per call: useFetch caches by key, and a retry after a
      // wrong password must hit the API again.
      const { data, error } = await useAPIFetch(path, {
        method,
        body,
        key: `${path}-${Date.now()}`,
      })

      if (error.value) {
        const apiError = (error.value as any)?.data
        return {
          ok: false,
          message:
            apiError?.message || error.value?.message || 'Something went wrong',
          code: apiError?.code,
        }
      }
      return { ok: true, data: data.value }
    } finally {
      loading.value = false
    }
  }

  /**
   * Change user password
   */
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<AccountCallResult> => {
    const result = await accountCall('/user/change-password', 'PUT', {
      currentPassword,
      newPassword,
    })
    if (result.ok) {
      toast.add({
        icon: 'i-bx-check-circle',
        title: 'Password changed successfully',
        color: 'green',
      })
    }
    return result
  }

  /**
   * Step 1 of changing a verified email: emails a code to the new address.
   */
  const requestEmailChange = (newEmail: string, currentPassword: string) =>
    accountCall('/user/email-change/request', 'POST', {
      newEmail,
      currentPassword,
    })

  /**
   * Step 2: the code proves the new inbox; on success the stored user is
   * replaced with the updated one.
   */
  const confirmEmailChange = async (token: string) => {
    const result = await accountCall('/user/email-change/confirm', 'POST', {
      token,
    })
    if (result.ok) {
      authStore.setUser(result.data as unknown as User)
      toast.add({
        icon: 'i-bx-check-circle',
        title: 'Email updated',
        color: 'green',
      })
    }
    return result
  }

  /**
   * Get current user
   */
  const getCurrentUser = (): User | null => {
    return authStore.user
  }

  /**
   * Update user preferences
   */
  const updatePreferences = async (preferences: Record<string, any>): Promise<boolean> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch('/user/preferences', {
        method: 'PUT',
        body: preferences,
        key: 'update-preferences',
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to update preferences')
      }

      toast.add({
        icon: 'i-bx-check-circle',
        title: 'Preferences updated',
        color: 'green',
      })

      return true
    } catch (error: any) {
      console.error('Error updating preferences:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to update preferences',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    updateProfile,
    getUserById,
    sendEmailInvitations,
    deleteUser,
    changePassword,
    requestEmailChange,
    confirmEmailChange,
    getCurrentUser,
    updatePreferences,
  }
}
