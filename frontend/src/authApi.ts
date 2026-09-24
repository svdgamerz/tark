// Talks to Tark's own backend auth (no Supabase). Stores a JWT in localStorage.

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

export interface AuthUser {
  id: number
  username: string
  email: string
  is_admin?: boolean
  board?: string | null
  grade?: string | null
  school?: string | null
  exam?: string | null
  tutoring_style?: string | null
  language?: string | null
  weak_subjects?: string | null
  goal?: string | null
}

interface Result {
  ok: boolean
  error?: string
  token?: string
  user?: AuthUser
}

async function postJson(path: string, body: unknown): Promise<Result> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: 'Unable to connect to the server. Please try again.' }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      error: typeof data.detail === 'string' ? data.detail : `Error ${res.status}`,
    }
  }
  return { ok: true, token: data.token, user: data.user }
}

export const authApi = {
  signup: (username: string, email: string, password: string) =>
    postJson('/auth/signup', { username, email, password }),
  verify: (email: string, code: string) =>
    postJson('/auth/verify', { email, code }),
  resend: (email: string) => postJson('/auth/resend', { email }),
  login: (email: string, password: string) =>
    postJson('/auth/login', { email, password }),
  forgot: (email: string) => postJson('/auth/forgot', { email }),
  reset: (email: string, code: string, password: string) =>
    postJson('/auth/reset', { email, code, password }),
  firebaseAuth: (idToken: string) =>
    postJson('/auth/firebase', { id_token: idToken }),
  async me(token: string): Promise<Result> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return { ok: false }
      const data = await res.json()
      return { ok: true, user: data.user }
    } catch {
      return { ok: false }
    }
  },
  async updateProfile(
    token: string,
    profile: {
      board?: string
      grade?: string
      school?: string
      exam?: string
      tutoring_style?: string
      language?: string
      weak_subjects?: string
      goal?: string
    },
  ): Promise<Result> {
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return {
          ok: false,
          error:
            typeof data.detail === 'string' ? data.detail : `Error ${res.status}`,
        }
      }
      return { ok: true, user: data.user }
    } catch {
      return { ok: false, error: "Can't reach the server." }
    }
  },
}
