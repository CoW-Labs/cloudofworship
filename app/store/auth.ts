import { defineStore } from 'pinia'
import { useAppStore } from './app'
import posthog from 'posthog-js'
import type { SubscriptionDetails } from '~/types'


export interface User {
  _id: string
  fullname: string
  email: string
  phone?: string
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
  logo?: string
  branch?: string
  isNotAChurch?: boolean
  howYouFoundUs?: string
  createdAt: string
  updatedAt: string
  userIds?: string[]
  users: User[]
  storageUsed?: number
  subscriptionPlan: 'free' | 'teams'
  trialEligible: boolean
  // True when the church has held a real (non-trial) Teams subscription at any
  // point. Set by GET /church/:churchId.
  hadTeamsBefore?: boolean
}

export const useAuthStore = defineStore('auth', {

  state: () => {
    return {
      user: null as User | null,
      church: null as Church | null,
      token: null as string | null, // Store token for Tauri
      // When `church` (and so `subscriptionPlan`) was last confirmed by the
      // API. The plan is cached to localStorage and read on every gate check,
      // including offline, so it needs an age: see PLAN_GRACE_PERIOD_MS in
      // useSubscription. Null means "cached by a build that predates this
      // field", which is treated as unverified.
      planVerifiedAt: null as number | null,
      subscriptionDetails: null as SubscriptionDetails | null, // Cached subscription details
      subscriptionDetailsLastFetched: null as number | null // Timestamp of last fetch
    }
  },
  actions: {
    setUser(user: User) {
      const isDifferentUser = this.user?._id !== user._id
      const isDifferentChurch = this.church?._id && this.church._id !== user.churchId

      this.user = user

      if (isDifferentUser || isDifferentChurch) {
        this.church = null
        this.planVerifiedAt = null
        this.subscriptionDetails = null
        this.subscriptionDetailsLastFetched = null
      }
    },
    /**
     * Stores the church and stamps the plan as freshly verified.
     *
     * Every caller is either a direct read of GET /church or a server-confirmed
     * billing activation, so reaching here always means the API has just told
     * us what the plan is. Nothing client-side may call this to assert a plan
     * of its own.
     */
    setChurch(church: Church) {
      this.church = church
      this.planVerifiedAt = Date.now()
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

      this.token = null

      if (!isTauri) {
        const cookie = useCookie('token')
        cookie.value = undefined
      }

      this.user = null
      this.church = null
      this.planVerifiedAt = null
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
