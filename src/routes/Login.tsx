import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import { AuthShell, GoogleIcon, fieldClass, labelClass } from '../components/auth/AuthShell'

export default function Login() {
  const user = useAuth((s) => s.user)
  const configured = useAuth((s) => s.configured)
  const signInWithPassword = useAuth((s) => s.signInWithPassword)
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle)

  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in → skip the form.
  if (user) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await signInWithPassword(email, password)
    setBusy(false)
    if (error) setError(error)
    else navigate(from, { replace: true })
  }

  return (
    <AuthShell
      subtitle="Sign in to your studio"
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-medium text-bloom-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
            autoComplete="current-password"
            required
            className={fieldClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy || !configured}
          className="mt-1 w-full rounded-lg bg-bloom-600 px-3 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-bloom-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
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
