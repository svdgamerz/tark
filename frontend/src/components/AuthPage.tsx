import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { fetchCurriculum, fetchSchools, type SchoolItem } from '../api'
import { Logo } from './Logo'
import {
  triggerGoogleSignIn,
  checkRedirectSignIn,
  isFirebaseConfigured,
  triggerFirebaseEmailSignup,
  triggerFirebaseEmailLogin,
  triggerFirebasePasswordReset,
} from '../firebase'

const GRADES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type View = 'login' | 'signup' | 'verify' | 'onboard' | 'forgot' | 'reset'

function shortBoard(b: string): string {
  if (/cbse|ncert/i.test(b)) return 'CBSE'
  if (/maharashtra|balbharati/i.test(b)) return 'Maharashtra State Board'
  if (/icse|cisce/i.test(b)) return 'ICSE'
  return b
}

function PasswordField({
  value,
  onChange,
  placeholder,
  show,
  onToggle,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  show: boolean
  onToggle: () => void
}) {
  return (
    <div className="pw-field">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={6}
      />
      <button
        type="button"
        className="pw-toggle"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggle}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

export function AuthPage({
  reason,
  onClose,
}: {
  reason?: string
  onClose: () => void
}) {
  const {
    signIn,
    signUp,
    verifyEmailCode,
    resendCode,
    forgotPassword,
    resetPassword,
    updateProfile,
    signInWithFirebaseToken,
  } = useAuth()

  const [view, setView] = useState<View>('login')

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [boards, setBoards] = useState<string[]>([])
  const [board, setBoard] = useState('')
  const [grade, setGrade] = useState('')
  const [school, setSchool] = useState('')
  const [schoolResults, setSchoolResults] = useState<SchoolItem[]>([])
  const debounceRef = useRef<number | undefined>(undefined)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    fetchCurriculum().then((items) =>
      setBoards(Array.from(new Set(items.map((i) => i.board)))),
    )
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  useEffect(() => {
    checkRedirectSignIn().then(async (res) => {
      if (res && res.idToken) {
        setBusy(true)
        const { error: authErr, user: signedInUser } = await signInWithFirebaseToken(res.idToken)
        if (!authErr) {
          if (!signedInUser?.board || !signedInUser?.grade) {
            go('onboard')
          } else {
            onClose()
          }
        } else {
          setError(authErr)
        }
        setBusy(false)
      }
    })
  }, [])

  function go(v: View) {
    setError('')
    setInfo('')
    setView(v)
  }

  function onSchoolChange(v: string) {
    setSchool(v)
    window.clearTimeout(debounceRef.current)
    if (v.trim().length < 2) {
      setSchoolResults([])
      return
    }
    debounceRef.current = window.setTimeout(async () => {
      setSchoolResults(await fetchSchools(v))
    }, 200)
  }

  function pickSchool(s: SchoolItem) {
    setSchool(s.name)
    setBoard(boards.includes(s.board) ? s.board : '__other')
    setSchoolResults([])
  }

  async function handleGoogleSignIn() {
    setError('')
    setBusy(true)
    setInfo('Connecting to Google…')
    try {
      if (!isFirebaseConfigured) {
        setError(
          'Google Sign-In requires Firebase setup. Please configure VITE_FIREBASE_API_KEY in frontend/.env.local or continue with Email/Password below.'
        )
        setBusy(false)
        return
      }

      await triggerGoogleSignIn()
      // Browser automatically redirects to Google in the same tab
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.')
      setBusy(false)
    }
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault()
    // Login accepts either an email or a username — only require it to be present.
    if (!email.trim()) return setError('Please enter your email or username.')
    setError('')
    setBusy(true)

    // Try Firebase Email Login first if input is an email
    if (isFirebaseConfigured && EMAIL_RE.test(email.trim())) {
      try {
        const { idToken } = await triggerFirebaseEmailLogin(email.trim(), password)
        const { error: authErr, user: signedInUser } = await signInWithFirebaseToken(idToken)
        if (!authErr) {
          if (!signedInUser?.board || !signedInUser?.grade) {
            go('onboard')
          } else {
            onClose()
          }
          setBusy(false)
          return
        }
      } catch (fbErr: any) {
        // Fall back to local DB login below
      }
    }

    const { error } = await signIn(email, password)
    if (error) setError(error)
    else onClose()
    setBusy(false)
  }

  async function submitSignup(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) return setError('Please enter a valid email.')
    if (password.length < 6)
      return setError('Password must be at least 6 characters.')
    setError('')
    setBusy(true)

    // Try Firebase Email Signup first to send real email from Google servers
    if (isFirebaseConfigured) {
      try {
        const { idToken } = await triggerFirebaseEmailSignup(email.trim(), password)
        const { error: authErr, user: signedInUser } = await signInWithFirebaseToken(idToken)
        if (authErr) {
          setError(authErr)
        } else {
          setInfo(`Verification email sent directly to ${email}!`)
          if (!signedInUser?.board || !signedInUser?.grade) {
            go('onboard')
          } else {
            onClose()
          }
        }
        setBusy(false)
        return
      } catch (fbErr: any) {
        console.warn('Firebase signup notice:', fbErr)
        if (fbErr?.code === 'auth/email-already-in-use') {
          setError('This email is already registered. Please log in instead.')
          setBusy(false)
          return
        }
        // If Email/Password is not enabled in Firebase Console, fallback to backend OTP
      }
    }

    const { error, needsConfirm } = await signUp(username, email, password)
    if (error) setError(error)
    else if (needsConfirm) {
      setResendIn(30)
      go('verify')
      setInfo(`We've sent a 6-digit code to ${email}.`)
    } else go('onboard')
    setBusy(false)
  }

  async function submitVerify(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await verifyEmailCode(email, code.trim())
    if (error) setError(error)
    else {
      setCode('')
      go('onboard')
    }
    setBusy(false)
  }

  async function submitForgot(e: FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) return setError('Please enter a valid email.')
    setError('')
    setBusy(true)

    if (isFirebaseConfigured) {
      try {
        await triggerFirebasePasswordReset(email.trim())
        setInfo(`Password reset link sent to ${email}! Please check your Gmail inbox.`)
        setBusy(false)
        return
      } catch (e: any) {
        console.warn('Firebase reset notice:', e)
      }
    }

    await forgotPassword(email)
    setResendIn(30)
    go('reset')
    setInfo(`If ${email} is registered, a reset code is on its way.`)
    setBusy(false)
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6)
      return setError('Password must be at least 6 characters.')
    setError('')
    setBusy(true)
    const { error } = await resetPassword(email, code.trim(), password)
    if (error) setError(error)
    else onClose() // logged in with the new password
    setBusy(false)
  }

  async function submitOnboard(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error } = await updateProfile({
      board: board === '__other' ? undefined : board,
      grade,
      school: school.trim() || undefined,
    })
    if (error) setError(error)
    else onClose()
    setBusy(false)
  }

  async function resend() {
    setError('')
    setBusy(true)
    if (view === 'reset') await forgotPassword(email)
    else await resendCode(email)
    setResendIn(30)
    setInfo('Code resent — check your email.')
    setBusy(false)
  }

  const heading: Record<View, string> = {
    login: 'Welcome back',
    signup: 'Create your account',
    verify: 'Check your email',
    onboard: 'Set up your syllabus',
    forgot: 'Reset your password',
    reset: 'Enter your reset code',
  }

  return (
    <div className="auth-page">
      <button className="auth-close" onClick={onClose} aria-label="Close">
        ×
      </button>

      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={24} className="brand-mark" />
          <span>Tark</span>
        </div>
        <h2>{heading[view]}</h2>

        {/* ---- LOGIN / SIGNUP ---- */}
        {(view === 'login' || view === 'signup') && (
          <>
            <div className="google-auth-section">
              <button
                type="button"
                className="google-signin-btn"
                onClick={handleGoogleSignIn}
                disabled={busy}
              >
                <svg className="google-icon" width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.24C.45 8.14 0 9.97 0 12s.45 3.86 1.24 5.42l4.04-3.13z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
              <div className="auth-divider">
                <span>or continue with email</span>
              </div>
            </div>

            <div className="auth-tabs">
              <button
                className={view === 'login' ? 'active' : ''}
                onClick={() => go('login')}
              >
                Log in
              </button>
              <button
                className={view === 'signup' ? 'active' : ''}
                onClick={() => go('signup')}
              >
                Sign up
              </button>
            </div>

            {reason && <p className="auth-sub">{reason}</p>}

            {view === 'login' ? (
              <form onSubmit={submitLogin}>
                <input
                  type="text"
                  placeholder="Email or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  placeholder="Password"
                  show={showPw}
                  onToggle={() => setShowPw((s) => !s)}
                />
                {error && <div className="modal-error">{error}</div>}
                <button className="modal-primary" type="submit" disabled={busy}>
                  {busy ? 'Please wait…' : 'Log in'}
                </button>
                <p className="auth-foot">
                  <button type="button" onClick={() => go('forgot')}>
                    Forgot password?
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={submitSignup}>
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={2}
                  autoFocus
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  placeholder="Password (min 6 characters)"
                  show={showPw}
                  onToggle={() => setShowPw((s) => !s)}
                />
                {error && <div className="modal-error">{error}</div>}
                <button className="modal-primary" type="submit" disabled={busy}>
                  {busy ? 'Please wait…' : 'Create account'}
                </button>
              </form>
            )}
          </>
        )}

        {/* ---- VERIFY / RESET (code entry) ---- */}
        {(view === 'verify' || view === 'reset') && (
          <>
            <p className="auth-sub">
              Enter the 6-digit code sent to <b>{email}</b>.
            </p>
            <form onSubmit={view === 'verify' ? submitVerify : submitReset}>
              <input
                className="code-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
                required
              />
              {view === 'reset' && (
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  placeholder="New password (min 6 characters)"
                  show={showPw}
                  onToggle={() => setShowPw((s) => !s)}
                />
              )}
              {error && <div className="modal-error">{error}</div>}
              {info && <div className="modal-info">{info}</div>}
              <button
                className="modal-primary"
                type="submit"
                disabled={busy || code.length < 6}
              >
                {busy
                  ? 'Please wait…'
                  : view === 'verify'
                    ? 'Verify & continue'
                    : 'Set new password'}
              </button>
            </form>
            <p className="auth-foot">
              {resendIn > 0 ? (
                <span className="muted">Resend code in {resendIn}s</span>
              ) : (
                <button type="button" onClick={resend} disabled={busy}>
                  Resend code
                </button>
              )}
              {' · '}
              <button type="button" onClick={() => go('login')}>
                Back to log in
              </button>
            </p>
          </>
        )}

        {/* ---- FORGOT (email entry) ---- */}
        {view === 'forgot' && (
          <>
            <p className="auth-sub">
              Enter your email and we'll send a code to reset your password.
            </p>
            <form onSubmit={submitForgot}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <div className="modal-error">{error}</div>}
              <button className="modal-primary" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
            <p className="auth-foot">
              <button type="button" onClick={() => go('login')}>
                Back to log in
              </button>
            </p>
          </>
        )}

        {/* ---- ONBOARD (syllabus) ---- */}
        {view === 'onboard' && (
          <>
            <p className="auth-sub">
              So Tark answers from <b>your</b> exact textbooks.
            </p>
            <form onSubmit={submitOnboard}>
              <div className="school-autocomplete">
                <input
                  type="text"
                  placeholder="Type your school name…"
                  value={school}
                  onChange={(e) => onSchoolChange(e.target.value)}
                  onBlur={() => setTimeout(() => setSchoolResults([]), 150)}
                  autoComplete="off"
                  autoFocus
                />
                {schoolResults.length > 0 && (
                  <ul className="school-results">
                    {schoolResults.map((s, i) => (
                      <li key={i} onMouseDown={() => pickSchool(s)}>
                        <span className="school-name">{s.name}</span>
                        <span className="school-meta">
                          {[s.city, s.state].filter(Boolean).join(', ')} ·{' '}
                          {shortBoard(s.board)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <select
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select your board
                </option>
                {boards.map((b) => (
                  <option key={b} value={b}>
                    {shortBoard(b)}
                  </option>
                ))}
                <option value="__other">Other / not listed</option>
              </select>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select your class
                </option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Class {g}
                  </option>
                ))}
              </select>
              {error && <div className="modal-error">{error}</div>}
              <button
                className="modal-primary"
                type="submit"
                disabled={busy || !board || !grade}
              >
                {busy ? 'Saving…' : 'Finish'}
              </button>
            </form>
            <p className="auth-foot">
              <button type="button" onClick={onClose}>
                Skip for now
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
