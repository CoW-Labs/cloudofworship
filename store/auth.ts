import { defineStore } from 'pinia'
import { useAppStore } from './app'
import posthog from 'posthog-js'
import type { SubscriptionDetails } from '~/types'


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
      token: null as string | null, // Store token for Tauri
      subscriptionDetails: null as SubscriptionDetails | null, // Cached subscription details
      subscriptionDetailsLastFetched: null as number | null // Timestamp of last fetch
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
    setSubscriptionDetails(details: SubscriptionDetails) {
      this.subscriptionDetails = details
      this.subscriptionDetailsLastFetched = Date.now()
    },
    clearSubscriptionDetails() {
      this.subscriptionDetails = null
      this.subscriptionDetailsLastFetched = null
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
      this.subscriptionDetails = null
      this.subscriptionDetailsLastFetched = null
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