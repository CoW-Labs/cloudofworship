import posthog from "posthog-js";
import { useAuthStore } from "~/store/auth";
import { useAppStore } from "~/store/app";
import { shouldSuppressExceptionEvent } from "~/utils/errorFilters";
import useAppVersion from "~/composables/useAppVersion";
import { useTauri } from "~/composables/useTauri";

export default defineNuxtPlugin(nuxtApp => {
  const auth = useAuthStore();
  const appStore = useAppStore();

  if (
    !window.location.host.includes("127.0.0.1") &&
    !window.location.host.includes("localhost:30") // 3000, 3001 etc
  ) {
    posthog.init("phc_sZj5IKRKRCd6Mv8GrthWQOlWu4ihmCFry3oQAIKrW9T", {
      api_host: "https://intel.cloudofworship.com",
      person_profiles: "identified_only",
      enable_recording_console_log: true,
      before_send: (event) => {
        if (shouldSuppressExceptionEvent(event)) {
          return null
        }
        return event
      },
    });
    // Stamped on every event, so a failure can be traced to the build that
    // produced it. `$app_version` is only populated by the mobile SDKs.
    posthog.register({
      app_version: useAppVersion().appVersion,
      app_platform: useTauri().isTauri ? "desktop" : "web",
    });
    posthog.identify(auth.user?._id, {
      email: auth.user?.email,
      name: auth.user?.fullname,
      role: auth.user?.role,
      church: auth.church?.name,
      church_id: auth.church?._id,
      signup_date: auth.user?.createdAt,
      subscription_plan: auth.church?.subscriptionPlan,
      is_teams: auth.church?.subscriptionPlan === "teams",
      appVersion: appStore.currentState.settings.appVersion,
    });
    nuxtApp.provide("posthog", posthog);
  }
});
