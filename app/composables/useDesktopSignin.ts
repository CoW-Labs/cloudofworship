import { useAuthStore } from "~/store/auth"
import type { LoginResponseT } from "~/types/api-responses"

/**
 * Signing in to the desktop app through the browser.
 *
 * The desktop webview cannot run Google (or any web) sign-in itself, so the
 * desktop app opens `/desktop-signin` in the operator's browser. They sign in
 * there as they would on the web; the web app then asks the API for a one-time
 * code and hands it back through a `cloudofworship://auth` link, or for the
 * operator to paste. The desktop app trades the code for a session.
 *
 * The code is bound to a PKCE challenge, so only the desktop app holding the
 * verifier can redeem it: a code read off a link or a screen is useless alone.
 */

export const DESKTOP_SIGNIN_SCHEME = "cloudofworship"

export type DesktopSigninIntent = "login" | "signup"

type PendingDesktopSignin = { state: string; verifier: string; startedAt: number }
type DesktopHandoff = {
  state: string
  challenge: string
  intent: DesktopSigninIntent
  startedAt: number
}

// Desktop: localStorage, so an attempt survives the OS relaunching the app to
// deliver the link. Web: sessionStorage, so it follows the operator through
// sign-in (and the Google redirect) in this tab only.
const PENDING_KEY = "cow_desktop_signin_pending"
const HANDOFF_KEY = "cow_desktop_signin_handoff"
// Matches the lifetime of an abandoned attempt, not of the code (5 minutes).
const ATTEMPT_TTL_MS = 30 * 60 * 1000

const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)))

const s256 = async (verifier: string) =>
  base64url(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
    )
  )

const readJSON = <T>(storage: Storage, key: string): T | null => {
  try {
    const value = JSON.parse(storage.getItem(key) || "null")
    if (!value || Date.now() - value.startedAt > ATTEMPT_TTL_MS) {
      storage.removeItem(key)
      return null
    }
    return value
  } catch {
    return null
  }
}

const writeJSON = (storage: Storage, key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: the paste-a-code path still has the in-memory copy.
  }
}

const removeKey = (storage: Storage, key: string) => {
  try {
    storage.removeItem(key)
  } catch {}
}

/* ─── Web side ─────────────────────────────────────────────────────────── */

/** Remember a handoff from the query so it survives the trip through sign-in. */
export const rememberDesktopHandoff = (query: Record<string, any>) => {
  const { state, challenge, intent } = query
  if (!STATE_PATTERN.test(state || "") || !CHALLENGE_PATTERN.test(challenge || "")) {
    return readDesktopHandoff()
  }

  const handoff: DesktopHandoff = {
    state,
    challenge,
    intent: intent === "signup" ? "signup" : "login",
    startedAt: Date.now(),
  }
  writeJSON(sessionStorage, HANDOFF_KEY, handoff)
  return handoff
}

export const readDesktopHandoff = () =>
  import.meta.client ? readJSON<DesktopHandoff>(sessionStorage, HANDOFF_KEY) : null

export const clearDesktopHandoff = () => removeKey(sessionStorage, HANDOFF_KEY)

/** Ask the API for a one-time code for the signed-in web user. */
export const issueDesktopSigninCode = async (handoff: DesktopHandoff) => {
  const { data, error } = await useAPIFetch<{ code: string; expiresAt: string }>(
    "/auth/desktop/code",
    {
      method: "POST",
      body: { state: handoff.state, challenge: handoff.challenge },
    }
  )

  if (error.value || !data.value?.code) {
    throw new Error(
      (error.value as any)?.data?.message ||
        "We couldn't create a sign-in code. Please try again."
    )
  }

  return {
    code: data.value.code,
    link: `${DESKTOP_SIGNIN_SCHEME}://auth?code=${encodeURIComponent(
      data.value.code
    )}&state=${encodeURIComponent(handoff.state)}`,
  }
}

/* ─── Desktop side ─────────────────────────────────────────────────────── */

/**
 * The web app to sign in on. A dev build signs in on its own dev server, so
 * the handoff exercises the same API; a packaged build (served from
 * `tauri://localhost` or `http://tauri.localhost`) uses production.
 */
const webAppOrigin = () => {
  const { origin } = window.location
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin
  return useRuntimeConfig().public.APP_URL as string
}

export const useDesktopSignin = () => {
  const toast = useToast()
  const authStore = useAuthStore()
  const { token } = useAuthToken()
  const { appVersion } = useAppVersion()

  // Shared so login, signup and the auth layout's link listener agree.
  const pending = useState<PendingDesktopSignin | null>(
    "desktop-signin-pending",
    () => (import.meta.client ? readJSON(localStorage, PENDING_KEY) : null)
  )
  const intent = useState<DesktopSigninIntent>("desktop-signin-intent", () => "login")
  const redeeming = useState<boolean>("desktop-signin-redeeming", () => false)
  const redeemError = useState<string>("desktop-signin-error", () => "")

  const browserUrl = async () => {
    const attempt = pending.value
    if (!attempt) return ""
    const params = new URLSearchParams({
      state: attempt.state,
      challenge: await s256(attempt.verifier),
      intent: intent.value,
    })
    return `${webAppOrigin()}/desktop-signin?${params}`
  }

  const openBrowser = async () => {
    const url = await browserUrl()
    if (url) await useOpenExternal(url)
  }

  const start = async (startIntent: DesktopSigninIntent) => {
    const attempt = { state: randomToken(), verifier: randomToken(), startedAt: Date.now() }
    pending.value = attempt
    intent.value = startIntent
    redeemError.value = ""
    writeJSON(localStorage, PENDING_KEY, attempt)

    usePosthogCapture("LOGIN_ATTEMPTED", { method: "desktop_browser", intent: startIntent })
    await openBrowser()
  }

  const cancel = () => {
    pending.value = null
    redeemError.value = ""
    removeKey(localStorage, PENDING_KEY)
  }

  const finishSignIn = (response: LoginResponseT) => {
    const user = response.data?.user
    token.value = response.token
    authStore.setUser(user!!)
    cancel()

    usePosthogCapture("LOGIN_SUCCESSFUL", {
      method: "desktop_browser",
      userId: user?._id,
      email: user?.email,
      emailVerified: user?.emailVerified,
    })

    if (user?.emailVerified) {
      navigateTo(user.churchId ? "/" : "/signup?registerChurch=1")
    } else {
      toast.add({
        title: "Please verify your email to proceed",
        icon: "i-bx-circle",
        color: "primary",
      })
      navigateTo("/verify")
    }
  }

  /**
   * Redeem a code from a `cloudofworship://auth` link, or one the operator
   * pasted (either the bare code or the whole link).
   */
  const redeem = async (input: string) => {
    const attempt = pending.value
    if (!attempt || redeeming.value) return

    let code = input.trim()
    let state = attempt.state
    if (code.startsWith(`${DESKTOP_SIGNIN_SCHEME}:`)) {
      const url = new URL(code)
      code = url.searchParams.get("code") || ""
      state = url.searchParams.get("state") || ""
    }

    if (!code || state !== attempt.state) {
      redeemError.value =
        "That code is from an earlier sign-in. Open the browser again to get a new one."
      return
    }

    redeeming.value = true
    redeemError.value = ""
    try {
      const { data, error } = await useAPIFetch<LoginResponseT>("/auth/desktop/exchange", {
        method: "POST",
        body: { code, verifier: attempt.verifier, state: attempt.state, appVersion },
      })

      if (error.value || !data.value?.token) {
        const reason = (error.value as any)?.data?.message
        usePosthogCapture("LOGIN_FAILED", { method: "desktop_browser", error: reason })
        redeemError.value = reason || "Something went wrong"
        return
      }

      finishSignIn(data.value)
    } finally {
      redeeming.value = false
    }
  }

  /**
   * Deliver `cloudofworship://auth` links to `redeem`: ones that arrive while
   * the app runs, and the one the OS launched the app with.
   */
  const listenForLinks = async () => {
    const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link")

    const handle = (urls: string[] | null) => {
      const link = urls?.find((url) => url.startsWith(`${DESKTOP_SIGNIN_SCHEME}://auth`))
      // No attempt in flight means a stale launch URL; there is nothing to do.
      if (link && pending.value) void redeem(link)
    }

    const unlisten = await onOpenUrl(handle)
    handle(await getCurrent())
    return unlisten
  }

  return {
    pending,
    redeeming,
    redeemError,
    start,
    cancel,
    openBrowser,
    redeem,
    listenForLinks,
  }
}
