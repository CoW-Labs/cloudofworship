import { defineStore } from 'pinia'

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
}

export interface Church {
  _id: string
  name: string
  type: string
  address: string
  pastor: string
  userIds?: string[]
  users: User[]
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    return {
      user: null as User | null,
      church: null as Church | null
    }
  },
  actions: {
    setUser(user: User) {
      this.user = user
    },
    setChurch(church: Church) {
      this.church = church
    },
    signOut() {
      const cookie = useCookie('token')
      cookie.value = undefined
      this.user = null
      this.church = null
      navigateTo('/login')
    }
  },
  persist: {
    storage: persistedState.localStorage
  }
}) 