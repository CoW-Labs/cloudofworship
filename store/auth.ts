import { defineStore } from 'pinia'
import { useAppStore } from './app'
import posthog from 'posthog-js'


export interface User {
  _id: string
  fullname: string
  email: string
  role: string
  avatar: string
  theme: string
  createdAt: string
  updatedAt: string
  churchId: string
  emailVerified?: boolean
  subscription?: {
    plan: 'free' | 'teams'
    startDate: string
    endDate: string | null
  }
}

export interface Church {
  _id: string
  name: string
  type: string
  address: string
  pastor: string
  userIds?: string[]
  users: User[]
  storageUsed?: number
  subscriptionPlan: 'free' | 'teams'
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    return {
      user: null as User | null,
      church: null as Church | null,
      token: null as string | null // Store token for Tauri
    }
  },
  actions: {
    setUser(user: User) {
      this.user = user
    },
    setChurch(church: Church) {
      this.church = church
    },
    setToken(token: string | null) {
      this.token = token
    },
    signOut() {
      const appStore = useAppStore()
      const { isTauri } = useTauri()

      // Clear token based on environment
      if (isTauri) {
        this.token = null
      } else {
        const cookie = useCookie('token')
        cookie.value = undefined
      }

      this.user = null
      this.church = null
      navigateTo('/login')
      setTimeout(() => {
        appStore.signOut()
      }, 1000)
      posthog.reset()
    }
  },
  persist: {
    storage: piniaPluginPersistedstate.localStorage(),
  }
}) 