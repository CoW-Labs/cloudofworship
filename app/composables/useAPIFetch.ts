import { useFetch } from "#app";
import type { AsyncDataRequestStatus } from "#app";
import type { Ref } from "vue";
import { useOnline } from "@vueuse/core";
import { useAuthStore } from "~/store/auth";
import { useAppStore } from "~/store/app";
import { useOnlineStatus } from "./useOnlineStatus";
import { useRequestCounter } from "./useRequestCounter";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type APIFetchResult<ResT = any, ErrorT = any> = {
  data: Ref<ResT | null | undefined>;
  error: Ref<ErrorT | null | undefined>;
  pending: Ref<boolean>;
  refresh: (...args: any[]) => Promise<void>;
  execute: (...args: any[]) => Promise<void>;
  clear: () => void;
  status: Ref<AsyncDataRequestStatus>;
};

// wrap useFetch with configuration needed to talk to our API
export const useAPIFetch = async <ResT = any, ErrorT = any>(
  path: any,
  options: any = {}
): Promise<APIFetchResult<ResT, ErrorT>> => {
  const online = useOnline();
  const toast = useToast();
  const config = useRuntimeConfig();
  const appStore = useAppStore();
  const isDevEnvironment = config.public.BASE_URL?.includes("localhost");

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
  const { getToken } = useAuthToken();
  const tokenValue = getToken();
  const method = String((options as any).method || "GET").toUpperCase();
  const isMutation = mutationMethods.has(method);
  options.baseURL = config.public.BASE_URL as string;
  options.headers = {
    ...options.headers,
    Authorization: `Bearer ${tokenValue}`,
    ...(config.public.NODE_ENV === 'development' ? { "x-dev-token": config.public.DEV_TOKEN } : {})
  };

  // Unique key per GET call so Nuxt never returns a stale cached response.
  // Mutations are handled with $fetch below, outside Nuxt async-data caching.
  if (!isMutation) {
    options.key = `${String(path)}-${Date.now()}`;
  }

  const { getDelayPromise } = useRequestCounter();

  const executeWithDelay = async () => {
    const delay = getDelayPromise();
    if (delay) {
      await delay;
    }
  };

  const handleRequestError = (error: any) => {
    appStore.setSlidesLoading(false);
    console.error(`[${method}] "${path}": <no response> ${error?.message}`);
  };

  const handleResponseError = (response: any) => {
    appStore.setSlidesLoading(false);
    const status = response?.status || response?.statusCode;

    if (status === 401 && !(path as string).includes("/auth")) {
      authStore.signOut();
      toast.add({
        title: "Your session has expired",
        color: "red",
        icon: "i-bx-error",
      });
    } else if (status === 403) {
      // Permission denied — the token is valid but access is revoked for this resource
      console.warn(`[API 403] Access forbidden: ${path}`);
      addErrorInDevEnvironment(`${path}: 403 Forbidden`);
    } else if (status === 404) {
      // Resource not found — log so we can identify stale IDs
      console.warn(`[API 404] Resource not found: ${path}`);
      addErrorInDevEnvironment(`${path}: 404 Not Found`);
    } else if (
      status === 500 &&
      (method === "POST" || method === "PUT")
    ) {
      addErrorInDevEnvironment(`${path}: Failed with 500`);
    }
  };

  const getRetryOptions = () => {
    const retryOptions = { ...(options as any) };
    delete retryOptions.key;
    delete retryOptions.dedupe;
    delete retryOptions.watch;
    delete retryOptions.onRequest;
    delete retryOptions.onRequestError;
    delete retryOptions.onResponseError;
    return retryOptions;
  };

  options.onRequest = async () => {
    await executeWithDelay();
  };

  options.onRequestError = ({ error }: { error: any }) => {
    handleRequestError(error);
  };

  options.onResponseError = ({ response }: { response: any }) => {
    handleResponseError(response);
  };

  const { onBackOnline } = useOnlineStatus();

  if (!online.value) {
    // Track failed mutation requests. Slide PUTs are intentionally skipped because
    // they are high-frequency edits and are already reconciled by realtime state.
    if (
      method === "POST" ||
      method === "PATCH" ||
      (method === "PUT" && !(path as string).includes("/slides")) ||
      method === "DELETE"
    ) {
      const retryOptions = getRetryOptions();
      const failedRequest = { path: path as string, options: retryOptions, timestamp: Date.now() };
      appStore.setFailedUploadRequests(failedRequest);

      // Set up retry when back online
      onBackOnline(async () => {
        try {
          const { error } = await useAPIFetch(path, retryOptions);
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

    // Return a stub response so callers don't hit the network at all.
    // Set a meaningful error so callers don't mistake this for a success.
    const data = ref<ResT | null>(null) as Ref<ResT | null | undefined>;
    const error = ref<ErrorT | null>(new Error('No internet connection') as ErrorT) as Ref<ErrorT | null | undefined>;
    const pending = ref(false);
    const status = ref<AsyncDataRequestStatus>("error");
    const execute = () => Promise.resolve();
    const clear = () => {
      data.value = null;
      error.value = null;
      pending.value = false;
      status.value = "idle";
    };

    return { data, error, pending, refresh: execute, execute, clear, status };
  }

  if (isMutation) {
    const data = ref<ResT | null>(null) as Ref<ResT | null | undefined>;
    const error = ref<ErrorT | null>(null) as Ref<ErrorT | null | undefined>;
    const pending = ref(false);
    const status = ref<AsyncDataRequestStatus>("idle");

    const clear = () => {
      data.value = null;
      error.value = null;
      pending.value = false;
      status.value = "idle";
    };

    const executeMutation = async () => {
      pending.value = true;
      error.value = null;
      status.value = "pending";

      const mutationOptions = getRetryOptions();

      try {
        await executeWithDelay();
        data.value = await $fetch<ResT>(path as string, mutationOptions);
        status.value = "success";
      } catch (err: any) {
        error.value = err as ErrorT;
        status.value = "error";
        const response = err?.response || err;
        const responseStatus = response?.status || response?.statusCode;

        if (responseStatus) {
          handleResponseError(response);
        } else {
          handleRequestError(err);
        }
      } finally {
        pending.value = false;
      }
    };

    await executeMutation();

    return {
      data,
      error,
      pending,
      refresh: executeMutation,
      execute: executeMutation,
      clear,
      status,
    };
  }

  return useFetch<ResT, ErrorT>(path, options) as unknown as APIFetchResult<ResT, ErrorT>;
};
