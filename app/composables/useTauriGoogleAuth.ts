/**
 * Composable for handling Google OAuth in Tauri
 * Uses tauri-plugin-oauth for Tauri (localhost server), redirect for web
 */
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
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
  const config = useRuntimeConfig()

  /**
   * Handle Google Sign In with Tauri compatibility
   * Uses tauri-plugin-oauth for Tauri (localhost server), popup for web
   */
  const handleGoogleSignIn = async (): Promise<UserCredential> => {
    const auth = useFirebaseAuth()
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({
      prompt: 'select_account'
    })

    if (isTauri) {
      return new Promise(async (resolve, reject) => {
        let unlistenFn: any = null
        let oauthPort: number | null = null

        try {
          // Imported lazily so none of the Tauri plugins reach the web bundle —
          // this composable backs the Google button on the auth layout.
          const [{ invoke }, { listen }, { open }] = await Promise.all([
            import('@tauri-apps/api/core'),
            import('@tauri-apps/api/event'),
            import('@tauri-apps/plugin-shell'),
          ])

          // Start the OAuth server
          oauthPort = await invoke<number>('start_oauth_server')
          console.log(`OAuth server started on port ${oauthPort}`)

          // Set up listener for OAuth callback
          unlistenFn = await listen('oauth_url', async (event: any) => {
            try {

              const url = new URL(event.payload as string)
              const code = url.searchParams.get('code')
              const state = url.searchParams.get('state')

              if (code) {
                // Exchange the authorization code for tokens using Firebase
                // We'll need to use Firebase's REST API for this
                const credential = await exchangeCodeForTokens(code, `http://localhost:${oauthPort}`)
                const userCredential = await signInWithCredential(auth, credential)
                resolve(userCredential)
              } else {
                const error = url.searchParams.get('error')
                reject(new Error(`OAuth error: ${error || 'No authorization code received'}`))
              }
            } catch (error) {
              console.error('Error processing OAuth callback:', error)
              reject(error)
            } finally {
              // Cleanup listener
              if (unlistenFn) {
                unlistenFn()
              }
            }
          })

          // Construct OAuth URL with localhost redirect
          const clientId = await getGoogleClientId()
          const redirectUri = `http://localhost:${oauthPort}`
          const state = Math.random().toString(36).substring(2)

          const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent('openid email profile')}` +
            `&state=${state}`

          // Open in system browser using Tauri's shell plugin (avoids terminal window on Windows)
          await open(authUrl)

          // Set timeout (5 minutes)
          setTimeout(() => {
            if (unlistenFn) {
              unlistenFn()
            }
            reject(new Error('OAuth timeout'))
          }, 300000)
        } catch (error) {
          console.error('Error starting OAuth flow:', error)
          if (unlistenFn) {
            unlistenFn()
          }
          reject(error)
        }
      })
    } else {
      return await webSignIn(auth, provider)
    }
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
   * Get Google OAuth Client ID from environment or Firebase config
   */
  const getGoogleClientId = async (): Promise<string> => {
    // You can store this in .env file as GOOGLE_OAUTH_CLIENT_ID
    // Or get it from Firebase config
    const clientId = (config.public.GOOGLE_OAUTH_CLIENT_ID as string) || '666115758673-yourgoogleclientid.apps.googleusercontent.com'
    return clientId
  }

  /**
   * Exchange authorization code for Firebase credential
   * This uses Firebase's signInWithCredential after getting tokens
   */
  const exchangeCodeForTokens = async (code: string, redirectUri: string): Promise<any> => {
    // For Firebase, we can use the authorization code directly with backend
    // Or exchange it client-side using Google's token endpoint
    const clientId = await getGoogleClientId()
    const clientSecret = (config.public.GOOGLE_OAUTH_CLIENT_SECRET as string) || ''

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      })

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange code for tokens')
      }

      const tokens = await tokenResponse.json()
      const { id_token, access_token } = tokens

      // Create Google credential for Firebase
      const provider = new GoogleAuthProvider()
      return GoogleAuthProvider.credential(id_token, access_token)
    } catch (error) {
      console.error('Error exchanging code for tokens:', error)
      throw error
    }
  }

  /**
   * Check for a redirect result after coming back from Google. Call this on
   * mount of every page that offers Google sign-in — on web it is how the
   * redirect flow delivers its credential.
   */
  const checkRedirectResult = async (): Promise<UserCredential | null> => {
    if (isTauri) {
      // Tauri handles the result through the oauth_url event listener; nothing to do here.
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
