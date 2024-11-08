import posthog from 'posthog-js'
import { useAuthStore } from '~/store/auth'

export default defineNuxtPlugin(nuxtApp => {
  const auth = useAuthStore()
  // console.log(auth.user)
  // posthog.init('phc_sZj5IKRKRCd6Mv8GrthWQOlWu4ihmCFry3oQAIKrW9T',
  //   {
  //     api_host: 'https://us.i.posthog.com',
  //     person_profiles: 'identified_only'
  //   }
  // )
  // posthog.identify(
  //   auth.user?._id,
  //   {
  //     email: auth.user?.email,
  //     name: auth.user?.fullname,
  //   }
  // )

  if (!window.location.host.includes('127.0.0.1') && !window.location.host.includes('localhost')) {
    posthog.init('phc_sZj5IKRKRCd6Mv8GrthWQOlWu4ihmCFry3oQAIKrW9T',
      {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only'
      }
    )
    posthog.identify(
      auth.user?._id,
      {
        email: auth.user?.email,
        name: auth.user?.fullname,
      }
    )
  }
})