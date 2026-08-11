/**
 * Composable for handling Google OAuth in Tauri
 * Uses tauri-plugin-oauth for Tauri (localhost server), redirect for web
 */
import { GoogleAuthProvider, signInWithPopup, signInWithCredential, type UserCredential } from "firebase/auth"

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
      // For web, use popup flow
      return await signInWithPopup(auth, provider)
    }
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
   * Check for redirect result after returning from Google sign-in.
   * Only applies to Tauri — on web, signInWithPopup is used so no redirect result needed.
   */
  const checkRedirectResult = async (): Promise<UserCredential | null> => {
    if (isTauri) {
      // Tauri handles the result through the oauth_url event listener; nothing to do here.
      return null
    }
    return null
  }

  return {
    handleGoogleSignIn,
    checkRedirectResult,
  }
}
