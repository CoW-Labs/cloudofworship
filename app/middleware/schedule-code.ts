import {
  SCHEDULE_CODE_LENGTH,
  normalizeScheduleCode,
} from "~/utils/scheduleCode"

/**
 * Guards `/livestream/:code` and `/stagestream/:code`. Looks the code up before
 * the page exists, so the page can open its socket with a real schedule id, and
 * a code that does not resolve lands back on the entry form with a reason
 * rather than a black screen waiting for a stream that will never come.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  const base = to.path.startsWith("/stagestream") ? "/stagestream" : "/livestream"
  const { resolve } = useScheduleCodeLookup()
  const result = await resolve(to.params.code)

  if (result.status === "found") return

  // Hand the failed code back to the form so it can be corrected in place, but
  // only when it could have been one: a chopped-up fragment of a longer string
  // is no help to edit.
  const attempted = normalizeScheduleCode(to.params.code)
  return navigateTo({
    path: base,
    query: {
      code:
        attempted && attempted.length <= SCHEDULE_CODE_LENGTH
          ? attempted
          : undefined,
      reason: result.status,
    },
  })
})
