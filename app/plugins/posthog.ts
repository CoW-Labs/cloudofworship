import posthog from "posthog-js";
import { useAuthStore } from "~/store/auth";
import { useAppStore } from "~/store/app";

export default defineNuxtPlugin(nuxtApp => {
  const auth = useAuthStore();
  const appStore = useAppStore();

  if (
    !window.location.host.includes("127.0.0.1") &&
    !window.location.host.includes("localhost:30") // 3000, 3001 etc
  ) {
    posthog.init("phc_sZj5IKRKRCd6Mv8GrthWQOlWu4ihmCFry3oQAIKrW9T", {
      api_host: "https://us.i.posthog.com",
      person_profiles: "identified_only",
    });
    posthog.identify(auth.user?._id, {
      email: auth.user?.email,
      name: auth.user?.fullname,
      role: auth.user?.role,
      church: auth.church?.name,
      church_id: auth.church?._id,
      appVersion: appStore.currentState.settings.appVersion,
    });
    nuxtApp.provide("posthog", posthog);
  }
});
