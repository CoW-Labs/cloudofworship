import posthog from "posthog-js";
import { useAuthStore } from "~/store/auth";
import { useAppStore } from "~/store/app";

const ignoredExceptionMessages = new Set([
  "Permissions check failed",
  "Script error.",
]);

const ignoredExceptionFragments = [
  "play() request was interrupted",
  "No internet connection",
  "Failed to get browser displays",
  "Auto-detect secondary display",
  "Transient activation is required",
  "Permission denied",
  "MetaMask extension not found",
  "Failed to fetch this Firebase app's measurement ID",
];

const getExceptionText = (event: any) => {
  const properties = event?.properties || {};
  const exceptionList = Array.isArray(properties.$exception_list)
    ? properties.$exception_list
    : [];
  const exceptionListText = exceptionList.flatMap((exception: any) => [
    exception?.type,
    exception?.value,
    exception?.message,
  ]);

  return [
    properties.$exception_message,
    properties.$exception_type,
    ...exceptionListText,
  ]
    .filter(Boolean)
    .join("\n");
};

const shouldSuppressExceptionEvent = (event: any) => {
  const message = event?.properties?.$exception_message;
  const exception = getExceptionText(event);
  return Boolean(
    (message && ignoredExceptionMessages.has(message)) ||
      (exception &&
        ignoredExceptionFragments.some((fragment) => exception.includes(fragment)))
  );
};

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
