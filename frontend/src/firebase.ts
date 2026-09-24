// Firebase Authentication setup for Tark
// Project: tark-22df9

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCLDNXNy35raaGZgllA-wfbgn0KORgv1BA',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'tark-22df9.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'tark-22df9',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'tark-22df9.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '272498781290',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:272498781290:web:e701401126d15503aaee13',
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
)

interface FirebaseModules {
  auth: any
  googleProvider: any
  signInWithPopup: any
  signInWithRedirect: any
  getRedirectResult: any
  createUserWithEmailAndPassword: any
  signInWithEmailAndPassword: any
  sendEmailVerification: any
  sendPasswordResetEmail: any
}

let firebasePromise: Promise<FirebaseModules> | null = null

/**
 * Pre-loads the Firebase SDK at app startup so that when the user clicks
 * "Continue with Google", signInWithPopup executes synchronously in the click gesture.
 * This prevents the browser from opening a separate blank tab or blocking session cookies.
 */
export function preloadFirebase(): Promise<FirebaseModules> {
  if (!firebasePromise) {
    firebasePromise = (async () => {
      // Dynamic import helper that prevents TypeScript TS2307 on remote URL modules
      const dynamicImport = new Function('url', 'return import(url)')
      const { initializeApp, getApps, getApp } = await dynamicImport(
        'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'
      )
      const {
        getAuth,
        signInWithPopup,
        signInWithRedirect,
        getRedirectResult,
        GoogleAuthProvider,
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        sendEmailVerification,
        sendPasswordResetEmail,
      } = await dynamicImport(
        'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js'
      )

      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
      const auth = getAuth(app)
      const googleProvider = new GoogleAuthProvider()
      googleProvider.addScope('email')
      googleProvider.addScope('profile')
      googleProvider.setCustomParameters({
        prompt: 'select_account',
      })

      return {
        auth,
        googleProvider,
        signInWithPopup,
        signInWithRedirect,
        getRedirectResult,
        createUserWithEmailAndPassword,
        signInWithEmailAndPassword,
        sendEmailVerification,
        sendPasswordResetEmail,
      }
    })().catch((err) => {
      console.warn('Firebase preload failed:', err)
      firebasePromise = null
      throw err
    })
  }
  return firebasePromise
}

// Kick off eager preload immediately on module evaluation
if (typeof window !== 'undefined') {
  preloadFirebase()
}

export const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '272498781290-p3fje696qsl30103rop74ec6o5on3f3h.apps.googleusercontent.com'

/**
 * Trigger direct Google OAuth 2.0 account chooser (exactly like Koyeb).
 * Routes directly to accounts.google.com/o/oauth2/v2/auth/oauthchooseaccount
 */
export function triggerDirectGoogleOAuth(): void {
  const origin = window.location.origin.replace(/\/$/, '')
  const nonce = Math.random().toString(36).substring(2)
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    googleClientId
  )}&redirect_uri=${encodeURIComponent(
    origin
  )}&response_type=id_token&scope=${encodeURIComponent(
    'openid email profile'
  )}&prompt=select_account&nonce=${nonce}`
  window.location.href = url
}

/**
 * Trigger seamless Google Sign-In directly in the current window (no popups).
 * If VITE_GOOGLE_CLIENT_ID is set, uses the direct Google OAuth2 endpoint (identical to Koyeb).
 */
export async function triggerGoogleSignIn(): Promise<void> {
  if (googleClientId) {
    triggerDirectGoogleOAuth()
    return
  }

  if (!isFirebaseConfigured) {
    throw new Error('Firebase credentials are not configured yet.')
  }

  const { auth, googleProvider, signInWithRedirect } = await preloadFirebase()
  await signInWithRedirect(auth, googleProvider)
}

/**
 * Check if the user is returning from a signInWithRedirect flow.
 */
export async function checkRedirectSignIn(): Promise<{ idToken: string; email?: string; name?: string } | null> {
  try {
    const { auth, getRedirectResult } = await preloadFirebase()
    const result = await getRedirectResult(auth)
    if (result && result.user) {
      const idToken = await result.user.getIdToken()
      return {
        idToken,
        email: result.user.email || undefined,
        name: result.user.displayName || undefined,
      }
    }
  } catch (e) {
    console.warn('checkRedirectSignIn notice:', e)
  }
  return null
}

/**
 * Create a new user with email/password and send official verification email via Google.
 */
export async function triggerFirebaseEmailSignup(
  email: string,
  pass: string
): Promise<{ user: any; idToken: string }> {
  const { auth, createUserWithEmailAndPassword, sendEmailVerification } = await preloadFirebase()
  const cred = await createUserWithEmailAndPassword(auth, email, pass)
  try {
    await sendEmailVerification(cred.user)
  } catch (e) {
    console.warn('sendEmailVerification notice:', e)
  }
  const idToken = await cred.user.getIdToken()
  return { user: cred.user, idToken }
}

/**
 * Sign in existing user with email/password via Firebase.
 */
export async function triggerFirebaseEmailLogin(
  email: string,
  pass: string
): Promise<{ idToken: string; email?: string }> {
  const { auth, signInWithEmailAndPassword } = await preloadFirebase()
  const cred = await signInWithEmailAndPassword(auth, email, pass)
  const idToken = await cred.user.getIdToken()
  return { idToken, email: cred.user.email || undefined }
}

/**
 * Send password reset email directly via Google.
 */
export async function triggerFirebasePasswordReset(email: string): Promise<void> {
  const { auth, sendPasswordResetEmail } = await preloadFirebase()
  await sendPasswordResetEmail(auth, email)
}
