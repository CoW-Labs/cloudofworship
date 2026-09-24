/**
 * Google sign-in on the web: a popup, falling back to a redirect.
 *
 * The desktop app does not sign in with Google itself; it hands off to the
 * browser instead (see useDesktopSignin).
 */
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type UserCredential,
} from "firebase/auth"

/** Thrown when we hand off to signInWithRedirect: the page is about to unload. */
export const GOOGLE_AUTH_REDIRECT_PENDING = "auth/redirect-pending"

/** Firebase codes that mean "the person backed out", not "something broke". */
const CANCELLED_CODES = [
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]

/** Firebase codes where the popup never had a chance — retry via redirect. */
const POPUP_UNAVAILABLE_CODES = [
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/internal-error",
]

/**
 * A popup that dies in under this long was killed by the browser (mobile
 * Safari, an in-app webview, storage partitioning) rather than closed by hand.
 * Firebase reports both as auth/popup-closed-by-user, so timing is the only
 * signal we get.
 */
const POPUP_KILLED_THRESHOLD_MS = 1500

export const isGoogleAuthRedirectPending = (error: any): boolean =>
  error?.code === GOOGLE_AUTH_REDIRECT_PENDING

export const isGoogleAuthCancelled = (error: any): boolean =>
  CANCELLED_CODES.includes(error?.code)

export default function useTauriGoogleAuth() {
  const { isTauri } = useTauri()

  const handleGoogleSignIn = async (): Promise<UserCredential> => {
    const auth = useFirebaseAuth()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account'
    })

    return await webSignIn(auth, provider)
  }

  /**
   * Web sign-in. Popups are the nicer flow on desktop, but they are unreliable
   * on mobile browsers, in installed PWAs, and inside in-app webviews, so those
   * go straight to redirect and anything that kills a popup falls back to it.
   */
  const webSignIn = async (
    auth: ReturnType<typeof useFirebaseAuth>,
    provider: GoogleAuthProvider
  ): Promise<UserCredential> => {
    if (shouldUseRedirect()) {
      return await startRedirect(auth, provider)
    }

    const openedAt = Date.now()
    try {
      return await signInWithPopup(auth, provider)
    } catch (error: any) {
      const popupWasKilled =
        error?.code === "auth/popup-closed-by-user" &&
        Date.now() - openedAt < POPUP_KILLED_THRESHOLD_MS

      if (POPUP_UNAVAILABLE_CODES.includes(error?.code) || popupWasKilled) {
        return await startRedirect(auth, provider)
      }
      throw error
    }
  }

  /**
   * Kicks off the redirect and throws a sentinel — the promise can never
   * resolve because the page is navigating away. Callers treat this code as
   * "nothing went wrong, just stop here".
   */
  const startRedirect = async (
    auth: ReturnType<typeof useFirebaseAuth>,
    provider: GoogleAuthProvider
  ): Promise<never> => {
    await signInWithRedirect(auth, provider)
    const pending: any = new Error("Redirecting to Google sign-in")
    pending.code = GOOGLE_AUTH_REDIRECT_PENDING
    throw pending
  }

  /** Environments where window.open either fails or lands outside the app. */
  const shouldUseRedirect = (): boolean => {
    if (typeof window === "undefined") return false

    const ua = window.navigator.userAgent || ""
    const inAppBrowser =
      /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|LinkedInApp|WhatsApp|MicroMessenger|Snapchat|Pinterest|GSA\//i.test(
        ua
      )

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true

    const touchPhone =
      !!window.matchMedia?.("(max-width: 768px)").matches &&
      !!window.matchMedia?.("(pointer: coarse)").matches

    return inAppBrowser || !!standalone || touchPhone
  }

  /**
   * Check for a redirect result after coming back from Google. Call this on
   * mount of every page that offers Google sign-in — on web it is how the
   * redirect flow delivers its credential.
   */
  const checkRedirectResult = async (): Promise<UserCredential | null> => {
    if (isTauri) {
      // Desktop never starts a Google redirect; it signs in through the browser.
      return null
    }

    try {
      return await getRedirectResult(useFirebaseAuth())
    } catch (error) {
      console.error("Error resolving Google redirect result:", error)
      return null
    }
  }

  return {
    handleGoogleSignIn,
    checkRedirectResult,
  }
}
