import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import type { UserRole } from '../lib/types'
import { AuthShell, fieldClass, labelClass } from '../components/auth/AuthShell'

const ROLES: Array<{ id: UserRole; label: string }> = [
  { id: 'student', label: 'Student' },
  { id: 'educator', label: 'Educator' },
  { id: 'professional', label: 'Professional florist' },
]

/**
 * First-run profile setup. Email sign-ups already provide a name + role, so
 * they skip this; OAuth (Google) sign-ups land here to confirm both before
 * entering the app.
 */
export default function Onboarding() {
  const profile = useAuth((s) => s.profile)
  const completeOnboarding = useAuth((s) => s.completeOnboarding)
  const navigate = useNavigate()

  const nameRef = useRef<HTMLInputElement>(null)
  const [role, setRole] = useState<UserRole>(profile?.role ?? 'student')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already set up → straight to the app.
  if (profile?.onboarded) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const displayName = nameRef.current?.value.trim() ?? ''
    if (!displayName) {
      setError('Please enter your name.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await completeOnboarding({ displayName, role })
    setBusy(false)
    if (error) setError(error)
    else navigate('/', { replace: true })
  }

  return (
    <AuthShell subtitle="Welcome — let’s set up your profile">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="name" className={labelClass}>
            Your name
          </label>
          {/* Uncontrolled + remount key: pre-fills once the profile loads. */}
          <input
            id="name"
            ref={nameRef}
            key={profile?.display_name ?? ''}
            defaultValue={profile?.display_name ?? ''}
            className={fieldClass}
            autoComplete="name"
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
          disabled={busy}
          className="mt-1 w-full rounded-lg bg-bloom-600 px-3 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-bloom-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </AuthShell>
  )
}
