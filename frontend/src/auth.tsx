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

  function syncAndSetUser(u: AuthUser, authToken?: string | null) {
    const localBoard = localStorage.getItem('tark_board') || localStorage.getItem('board')
    const localGrade = localStorage.getItem('tark_grade') || localStorage.getItem('grade')
    const localSchool = localStorage.getItem('tark_school') || localStorage.getItem('school')

    if (u.board && u.grade) {
      localStorage.setItem('tark_board', u.board)
      localStorage.setItem('tark_grade', u.grade)
      if (u.school) localStorage.setItem('tark_school', u.school)
      localStorage.setItem('tark_profile_completed', '1')
      setUser(u)
      return
    }

    if (localBoard && localGrade) {
      const effBoard = (u.board || localBoard) ?? undefined
      const effGrade = (u.grade || localGrade) ?? undefined
      const effSchool = (u.school || localSchool || '') ?? undefined
      const mergedUser: AuthUser = {
        ...u,
        board: effBoard,
        grade: effGrade,
        school: effSchool,
      }
      setUser(mergedUser)
      const tk = authToken || token || localStorage.getItem(TOKEN_KEY)
      if (tk) {
        authApi.updateProfile(tk, {
          board: effBoard,
          grade: effGrade,
          school: effSchool,
          exam: localStorage.getItem('tark_target_exam') || undefined,
          tutoring_style: localStorage.getItem('tark_tutoring_style') || undefined,
          language: localStorage.getItem('tark_language_pref') || undefined,
          weak_subjects: localStorage.getItem('tark_weak_subjects') || undefined,
        }).catch(() => {})
      }
      return
    }

    setUser(u)
  }

  function save(newToken: string | undefined, u: AuthUser | undefined) {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
      setToken(newToken)
    }
    if (u) {
      syncAndSetUser(u, newToken)
    }
  }

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
        if (r.ok && r.user) {
          syncAndSetUser(r.user, t)
        } else {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
        setLoading(false)
      })
    })
  }, [])

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
      const localBoard = localStorage.getItem('tark_board') || localStorage.getItem('board')
      const localGrade = localStorage.getItem('tark_grade') || localStorage.getItem('grade')
      const effectiveUser = r.user ? {
        ...r.user,
        board: r.user.board || localBoard || undefined,
        grade: r.user.grade || localGrade || undefined,
      } : undefined
      return { user: effectiveUser }
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
