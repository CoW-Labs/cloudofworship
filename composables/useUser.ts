import { useAuthStore } from '~/store/auth'
import type { User, Church } from '~/store/auth'

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
        throw new Error(error.value?.message || 'Failed to update profile')
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
            recipients: emails.map((email) => ({ email: email.trim() })),
          },
          key: 'send-email-invitations',
        }
      )

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to send invitations')
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
        title: 'Error sending email',
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
   * Change user password
   */
  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    try {
      loading.value = true

      const { data, error } = await useAPIFetch('/user/change-password', {
        method: 'PUT',
        body: {
          currentPassword,
          newPassword,
        },
        key: 'change-password',
      })

      if (error.value) {
        throw new Error(error.value?.message || 'Failed to change password')
      }

      toast.add({
        icon: 'i-bx-check-circle',
        title: 'Password changed successfully',
        color: 'green',
      })

      return true
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast.add({
        icon: 'i-bx-error',
        title: 'Failed to change password',
        description: error.message,
        color: 'red',
      })
      return false
    } finally {
      loading.value = false
    }
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
    getCurrentUser,
    updatePreferences,
  }
}
