import {
  isScheduleCode,
  isScheduleObjectId,
  normalizeScheduleCode,
} from "~/utils/scheduleCode"

export type ScheduleLookup =
  | { status: "found"; id: string }
  | { status: "not-found" }
  | { status: "rate-limited" }
  | { status: "unreachable" }

/**
 * Turns what is in a public viewer URL (`/livestream/:code`, `/stagestream/:code`)
 * into the schedule id the viewer's socket joins.
 *
 * The viewer pages are opened by people with no account, so this calls the
 * public `GET /schedule-code/:code` with plain `$fetch`. `useAPIFetch` is not
 * an option: it attaches a token, queues writes and signs the user out on a 401,
 * none of which belongs to a stranger's browser tab.
 *
 * An ObjectId in the URL is accepted as-is, so links shared before codes
 * existed keep working.
 */
export default function useScheduleCodeLookup() {
  const config = useRuntimeConfig()
  // code -> schedule id, filled by the route middleware so the page that
  // renders next does not look it up a second time.
  const resolvedIds = useState<Record<string, string>>(
    "resolved-schedule-ids",
    () => ({})
  )

  const resolve = async (param: unknown): Promise<ScheduleLookup> => {
    const raw = String(param ?? "")
    if (isScheduleObjectId(raw)) return { status: "found", id: raw }

    const code = normalizeScheduleCode(raw)
    if (!isScheduleCode(code)) return { status: "not-found" }
    // The entry form resolves the code before navigating; the middleware then
    // finds it here instead of asking the API again.
    const cached = resolvedIds.value[code]
    if (cached) return { status: "found", id: cached }

    try {
      const schedule = await $fetch<{ _id: string }>(
        `/schedule-code/${code}`,
        {
          baseURL: config.public.BASE_URL as string,
          headers:
            config.public.NODE_ENV === "development"
              ? { "x-dev-token": config.public.DEV_TOKEN as string }
              : undefined,
        }
      )
      resolvedIds.value[code] = schedule._id
      return { status: "found", id: schedule._id }
    } catch (error: any) {
      const status = error?.statusCode ?? error?.response?.status
      if (status === 404) return { status: "not-found" }
      // The lookup is rate-limited per IP to stop anyone walking the codes.
      if (status === 429) return { status: "rate-limited" }
      return { status: "unreachable" }
    }
  }

  /** The schedule id for a URL param already resolved by the middleware. */
  const resolvedId = (param: unknown): string => {
    const raw = String(param ?? "")
    if (isScheduleObjectId(raw)) return raw
    return resolvedIds.value[normalizeScheduleCode(raw)] ?? raw
  }

  return { resolve, resolvedId }
}
