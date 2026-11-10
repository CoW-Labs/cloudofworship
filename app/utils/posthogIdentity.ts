import posthog from "posthog-js"
import type { Church, User } from "~/store/auth"

/**
 * Tells PostHog who is signed in, along with their church and plan.
 *
 * Called from the auth store whenever the user or church changes, and once at
 * startup. Sign-in and sign-up move to the app without a page reload, so
 * identifying only at startup left a person's whole first session anonymous.
 *
 * Safe to call at any time: it does nothing until PostHog has been initialised
 * (never on localhost) and until there is a user. Calling it again with the same
 * details is skipped, and calling it again with a new plan updates the profile.
 */
let lastSent = ""

export const identifyPosthogUser = (
  user: User | null | undefined,
  church: Church | null | undefined,
  appVersion?: string
) => {
  if (!user?._id || !posthog.__loaded) return

  const properties = {
    email: user.email,
    name: user.fullname,
    role: user.role,
    church: church?.name,
    church_id: church?._id,
    signup_date: user.createdAt,
    subscription_plan: church?.subscriptionPlan,
    is_teams: church ? church.subscriptionPlan === "teams" : undefined,
    appVersion,
  }

  // The distinct id changes on sign-out (posthog.reset), so signing back in as
  // the same person is never mistaken for a repeat.
  const key = `${posthog.get_distinct_id()}|${user._id}|${JSON.stringify(properties)}`
  if (key === lastSent) return
  lastSent = key

  posthog.identify(user._id, properties)
}
