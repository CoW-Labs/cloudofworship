import { useFetch } from "#app";
import { UseFetchOptions, useOnline, useDebounceFn } from "@vueuse/core";
import { useAuthStore } from "~/store/auth";
import { useAppStore } from "~/store/app";

type useFetchType = typeof useFetch;
const lastSlidesRequest = null

// wrap useFetch with configuration needed to talk to our API
export const useAPIFetch: useFetchType = (path, options = {}) => {
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

  options.onRequest = ({ request }) => {
    // console.log(request)
    // console.log(options.body)
  };

  options.onResponseError = ({ response }) => {
    appStore.setSlidesLoading(false);
    if (response.status === 401 && !path.includes("/auth")) {
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

  if (!online.value) {
    // Track failed POST/PUT requests
    if (options.method === "POST" || options.method === "PUT") {
      appStore.setFailedUploadRequests({ path: path as string, options });
      addErrorInDevEnvironment(`, ${path}: Failed, cause: offline`);
    }
    appStore.setSlidesLoading(false);
    throw new Error("No internet connection");
  }

  return useFetch(path, options);
};
