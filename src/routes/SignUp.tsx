import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import type { UserRole } from '../lib/types'
import { AuthShell, GoogleIcon, fieldClass, labelClass } from '../components/auth/AuthShell'

const ROLES: Array<{ id: UserRole; label: string }> = [
  { id: 'student', label: 'Student' },
  { id: 'educator', label: 'Educator' },
  { id: 'professional', label: 'Professional florist' },
]

export default function SignUp() {
  const user = useAuth((s) => s.user)
  const configured = useAuth((s) => s.configured)
  const signUp = useAuth((s) => s.signUp)
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('student')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  if (user) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error, needsConfirmation } = await signUp({ email, password, displayName, role })
    setBusy(false)
    if (error) setError(error)
    else if (needsConfirmation) setConfirm(true)
    else navigate('/', { replace: true })
  }

  if (confirm) {
    return (
      <AuthShell subtitle="Almost there">
        <div className="text-center">
          <p className="text-sm text-bloom-ink/75">
            We’ve emailed a confirmation link to <span className="font-medium">{email}</span>. Click
            it to activate your account, then sign in.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white hover:bg-bloom-700"
          >
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      subtitle="Create your studio account"
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-bloom-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="name" className={labelClass}>
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            className={fieldClass}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={fieldClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="role" className={labelClass}>
            I’m a…
          </label>
          <select
            id="role"
            className={fieldClass}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy || !configured}
          className="mt-1 w-full rounded-lg bg-bloom-600 px-3 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-bloom-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wide text-bloom-ink/35">
        <span className="h-px flex-1 bg-bloom-200" />
        or
        <span className="h-px flex-1 bg-bloom-200" />
      </div>

      <button
        type="button"
        disabled={!configured}
        onClick={() => void signInWithGoogle()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-bloom-200 bg-white px-3 py-2 text-sm font-medium shadow-soft transition-colors hover:bg-bloom-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </AuthShell>
  )
}
