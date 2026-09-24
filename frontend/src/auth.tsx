import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { authApi, type AuthUser } from './authApi'
import { checkRedirectSignIn } from './firebase'

interface AuthValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (
    username: string,
    email: string,
    password: string,
  ) => Promise<{ error?: string; needsConfirm?: boolean }>
  verifyEmailCode: (email: string, code: string) => Promise<{ error?: string }>
  resendCode: (email: string) => Promise<{ error?: string }>
  forgotPassword: (email: string) => Promise<{ error?: string }>
  resetPassword: (
    email: string,
    code: string,
    password: string,
  ) => Promise<{ error?: string }>
  signInWithFirebaseToken: (
    idToken: string,
  ) => Promise<{ error?: string; user?: AuthUser }>
  updateProfile: (profile: {
    board?: string
    grade?: string
    school?: string
    exam?: string
    tutoring_style?: string
    language?: string
    weak_subjects?: string
    goal?: string
  }) => Promise<{ error?: string }>
  signOut: () => void
}

const TOKEN_KEY = 'tark_token'
const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(
    localStorage.getItem(TOKEN_KEY),
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Direct Google OAuth2 return (hash contains id_token)
    if (window.location.hash.includes('id_token=')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const directIdToken = hashParams.get('id_token')
      if (directIdToken) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        authApi.firebaseAuth(directIdToken).then((r) => {
          if (r.ok && r.user) {
            save(r.token, r.user)
          }
          setLoading(false)
        })
        return
      }
    }

    // 2. Firebase redirect return
    checkRedirectSignIn().then(async (res) => {
      if (res && res.idToken) {
        const r = await authApi.firebaseAuth(res.idToken)
        if (r.ok && r.user) {
          save(r.token, r.user)
          setLoading(false)
          return
        }
      }

      const t = localStorage.getItem(TOKEN_KEY)
      if (!t) {
        setLoading(false)
        return
      }
      authApi.me(t).then((r) => {
        if (r.ok && r.user) setUser(r.user)
        else {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
        setLoading(false)
      })
    })
  }, [])

  function save(newToken: string | undefined, u: AuthUser | undefined) {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
      setToken(newToken)
    }
    if (u) setUser(u)
  }

  const value: AuthValue = {
    user,
    token,
    loading,
    signIn: async (email, password) => {
      const r = await authApi.login(email, password)
      if (!r.ok) return { error: r.error }
      save(r.token, r.user)
      return {}
    },
    signUp: async (username, email, password) => {
      const r = await authApi.signup(username, email, password)
      if (!r.ok) return { error: r.error }
      return { needsConfirm: true }
    },
    verifyEmailCode: async (email, code) => {
      const r = await authApi.verify(email, code)
      if (!r.ok) return { error: r.error }
      save(r.token, r.user)
      return {}
    },
    resendCode: async (email) => {
      const r = await authApi.resend(email)
      return r.ok ? {} : { error: r.error }
    },
    forgotPassword: async (email) => {
      const r = await authApi.forgot(email)
      return r.ok ? {} : { error: r.error }
    },
    resetPassword: async (email, code, password) => {
      const r = await authApi.reset(email, code, password)
      if (!r.ok) return { error: r.error }
      save(r.token, r.user)
      return {}
    },
    signInWithFirebaseToken: async (idToken: string) => {
      const r = await authApi.firebaseAuth(idToken)
      if (!r.ok) return { error: r.error }
      save(r.token, r.user)
      return { user: r.user }
    },
    updateProfile: async (profile) => {
      if (!token) return { error: 'Not logged in.' }
      const r = await authApi.updateProfile(token, profile)
      if (!r.ok) return { error: r.error }
      if (r.user) setUser(r.user)
      return {}
    },
    signOut: () => {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
