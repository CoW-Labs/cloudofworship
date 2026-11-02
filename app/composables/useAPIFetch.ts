import type { AsyncDataRequestStatus } from "#app";
import type { Ref } from "vue";
import { useAuthStore } from "~/store/auth";
import { useAppStore } from "~/store/app";
import { isNetworkError } from "~/utils/apiErrors";

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Writes made while the browser reports offline, replayed one at a time in
// the order they were made once it is back. Memory only: a reload starts
// clean instead of replaying an earlier session's writes, possibly under
// another account. Each entry is sent until the server answers, then dropped.
type QueuedRequest = { path: string; options: any; userId?: string };
const offlineQueue: QueuedRequest[] = [];

// While the browser still reports online but the replay cannot get through
// (flaky venue wifi), try again on this cadence until the queue drains.
const OFFLINE_RETRY_MS = 30_000;
let drainInFlight: Promise<void> | null = null;
let drainRetryTimer: ReturnType<typeof setTimeout> | null = null;
let drainTriggerInstalled = false;

const isOffline = () =>
  typeof navigator !== "undefined" && navigator.onLine === false;

// Slide PUTs are replayed by useSlideResync from IndexedDB. File uploads have
// their own retries and re-upload sweep; replaying one here would store an
// extra copy that no slide points at.
const isQueueable = (method: string, path: string) =>
  !/\/files(\/|$)/.test(path) &&
  !(method === "PUT" && path.includes("/slides"));

const armDrainRetry = () => {
  if (drainRetryTimer) return;
  drainRetryTimer = setTimeout(() => {
    drainRetryTimer = null;
    void drainOfflineQueue();
  }, OFFLINE_RETRY_MS);
};

const drainOfflineQueue = (): Promise<void> => {
  if (drainInFlight) return drainInFlight;

  drainInFlight = (async () => {
    if (drainRetryTimer) clearTimeout(drainRetryTimer);
    drainRetryTimer = null;

    while (offlineQueue.length) {
      // The next "online" event drains again.
      if (isOffline()) return;

      const request = offlineQueue[0]!;
      if (request.userId !== useAuthStore().user?._id) {
        offlineQueue.shift();
        continue;
      }

      try {
        const { error } = await useAPIFetch(request.path, {
          ...request.options,
          offlineReplay: true,
        });
        if (error.value && isNetworkError(error.value)) {
          armDrainRetry();
          return;
        }
        if (error.value) {
          console.error(`Queued request to ${request.path} was rejected:`, error.value);
        }
      } catch (err) {
        console.error(`Error replaying queued request to ${request.path}:`, err);
        armDrainRetry();
        return;
      }
      offlineQueue.shift();
    }
  })().finally(() => {
    drainInFlight = null;
  });

  return drainInFlight;
};

const installDrainTrigger = () => {
  if (drainTriggerInstalled || typeof window === "undefined") return;
  drainTriggerInstalled = true;
  const nuxtApp = useNuxtApp();
  window.addEventListener("online", () => {
    void nuxtApp.runWithContext(() => drainOfflineQueue());
  });
};

// Without a timeout, a GET on a lossy connection hangs until the browser gives
// up (minutes) while navigator.onLine still reports online. ofetch retries a
// timed-out GET once, so the worst case is twice this. Callers can pass their
// own `timeout`.
const DEFAULT_GET_TIMEOUT_MS = 20_000;

type APIFetchResult<ResT = any, ErrorT = any> = {
  data: Ref<ResT | null | undefined>;
  error: Ref<ErrorT | null | undefined>;
  pending: Ref<boolean>;
  refresh: (...args: any[]) => Promise<void>;
  execute: (...args: any[]) => Promise<void>;
  clear: () => void;
  status: Ref<AsyncDataRequestStatus>;
};

// wrap $fetch with auth headers, offline queuing, and error handling needed to talk to our API
export const useAPIFetch = async <ResT = any, ErrorT = any>(
  path: any,
  options: any = {}
): Promise<APIFetchResult<ResT, ErrorT>> => {
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
    delete retryOptions.offlineReplay;
    return retryOptions;
  };

  options.onRequestError = ({ error }: { error: any }) => {
    handleRequestError(error);
  };

  options.onResponseError = ({ response }: { response: any }) => {
    handleResponseError(response);
  };

  if (isOffline()) {
    // A replay that finds the connection gone again stays at the head of the
    // queue; it is not queued a second time.
    if (isMutation && !options.offlineReplay && isQueueable(method, path as string)) {
      offlineQueue.push({
        path: path as string,
        options: getRetryOptions(),
        userId: authStore.user?._id,
      });
      installDrainTrigger();
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

  // Use $fetch directly instead of useFetch to avoid Nuxt's "useFetch called after mount"
  // warning. This composable is frequently called inside lifecycle hooks and async event
  // handlers where useFetch is not allowed. Since we generate unique keys (Date.now) the
  // Nuxt dedup/cache layer was already a no-op, so the behaviour is identical.
  const fetchData = ref<ResT | null>(null) as Ref<ResT | null | undefined>;
  const fetchError = ref<ErrorT | null>(null) as Ref<ErrorT | null | undefined>;
  const fetchPending = ref(false);
  const fetchStatus = ref<AsyncDataRequestStatus>("idle");

  const fetchOptions = { timeout: DEFAULT_GET_TIMEOUT_MS, ...options };
  delete fetchOptions.key;
  delete fetchOptions.dedupe;
  delete fetchOptions.watch;

  const clear = () => {
    fetchData.value = null;
    fetchError.value = null;
    fetchPending.value = false;
    fetchStatus.value = "idle";
  };

  const executeGet = async () => {
    fetchPending.value = true;
    fetchError.value = null;
    fetchStatus.value = "pending";

    try {
      fetchData.value = await $fetch<ResT>(path as string, fetchOptions);
      fetchStatus.value = "success";
    } catch (err: any) {
      fetchError.value = err as ErrorT;
      fetchStatus.value = "error";
      const response = err?.response || err;
      const responseStatus = response?.status || response?.statusCode;

      if (responseStatus) {
        handleResponseError(response);
      } else {
        handleRequestError(err);
      }
    } finally {
      fetchPending.value = false;
    }
  };

  await executeGet();

  return {
    data: fetchData,
    error: fetchError,
    pending: fetchPending,
    refresh: executeGet,
    execute: executeGet,
    clear,
    status: fetchStatus,
  };
};
