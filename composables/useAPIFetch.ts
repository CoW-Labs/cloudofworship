import { useFetch } from "#app";
import { useOnline } from "@vueuse/core";
import { useAuthStore } from "~/store/auth";
import { useAppStore } from "~/store/app";
import { useOnlineStatus } from "./useOnlineStatus";
import { useRequestCounter } from "./useRequestCounter";

type useFetchType = typeof useFetch;

// wrap useFetch with configuration needed to talk to our API
export const useAPIFetch: useFetchType = async (path, options = {}) => {
  const online = useOnline();
  const toast = useToast();
  const config = useRuntimeConfig();
  const appStore = useAppStore();
  const isDevEnvironment = config.public.BASE_URL?.includes("localhost");

  // const showOfflineToast = useDebounceFn((options: { title: string, color: string, icon: string }) => {
  //   toast.add(options)
  // }, 2000)

  const addErrorInDevEnvironment = (message: string) => {
    if (isDevEnvironment) {
      toast.add({
        title: `DEV ERROR: ${message}`,
        color: "red",
        icon: "i-bx-error",
      });
    }
  };

  const authStore = useAuthStore();
  const token = useCookie("token");
  options.baseURL = config.public.BASE_URL as string;
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${token.value}`,
  };

  const executeWithDelay = async () => {
    const delay = getDelayPromise();
    if (delay) {
      await delay;
    }
  };

  options.onRequest = async ({ request }) => {
    await executeWithDelay();
  };

  options.onResponseError = ({ response }) => {
    appStore.setSlidesLoading(false);
    if (response.status === 401 && !(path as string).includes("/auth")) {
      authStore.signOut();
      toast.add({
        title: "Your session has expired",
        color: "red",
        icon: "i-bx-error",
      });
    } else if (
      response.status === 500 &&
      (options.method === "POST" || options.method === "PUT")
    ) {
      addErrorInDevEnvironment(`${path}: Failed with 500`);
      // Track failed POST/PUT requests
      // console.log(response)
    }
    // console.log(response.status)
  };

  const { onBackOnline } = useOnlineStatus();

  const { getDelayPromise } = useRequestCounter();

  if (!online.value) {
    // Track failed POST/PUT/DELETE requests (Only track PUT requests that are not related to slides i.e slide updates)
    if (options.method === "POST" || (options.method === "PUT" && !(path as string).includes("/slides")) || options.method === 'DELETE') {
      const failedRequest = { path: path as string, options, timestamp: Date.now() };
      appStore.setFailedUploadRequests(failedRequest);

      // Set up retry when back online
      onBackOnline(async () => {
        try {
          const { data, error } = await useFetch(path, options);
          if (error.value) {
            console.error(`Failed to retry request to ${path}:`, error.value);
          } else {
            // Remove from failed requests if successful
            appStore.removeFailedUploadRequest(failedRequest);
            console.log(`Successfully retried request to ${path}`);
          }
        } catch (err) {
          console.error(`Error retrying request to ${path}:`, err);
        }
      });

      addErrorInDevEnvironment(`${path}: Failed, cause: offline`);
    }
    appStore.setSlidesLoading(false);
    console.error("No internet connection");
    return useFetch(path, options);
  }

  return useFetch(path, options);
};
