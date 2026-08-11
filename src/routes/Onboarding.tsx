import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import type { ExperienceLevel, UserRole } from '../lib/types'
import { EXPERIENCE_LEVELS, SIGNUP_ROLES } from '../lib/profileOptions'
import { AuthShell, RequiredMark, fieldClass, labelClass } from '../components/auth/AuthShell'

/** Split a stored display name into first + rest (last), for pre-filling. */
function splitName(full: string | undefined): { first: string; last: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') }
}

/**
 * First-run profile setup. Email sign-ups already provide name + role (+ any
 * experience level), so they skip this; OAuth (Google) sign-ups land here to
 * supply them before entering the app — professionals must pick an experience
 * level, so Google can't bypass it.
 */
export default function Onboarding() {
  const profile = useAuth((s) => s.profile)
  const completeOnboarding = useAuth((s) => s.completeOnboarding)
  const navigate = useNavigate()

  const firstRef = useRef<HTMLInputElement>(null)
  const lastRef = useRef<HTMLInputElement>(null)
  const seeded = splitName(profile?.display_name)
  const [role, setRole] = useState<UserRole>(profile?.role ?? 'student')
  const [experience, setExperience] = useState<ExperienceLevel | ''>(profile?.experience_level ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already set up → straight to the app.
  if (profile?.onboarded) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const first = firstRef.current?.value.trim() ?? ''
    const last = lastRef.current?.value.trim() ?? ''
    if (!first || !last) {
      setError('Please enter your first and last name.')
      return
    }
    if (role === 'professional' && !experience) {
      setError('Please select your experience level.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await completeOnboarding({
      firstName: first,
      lastName: last,
      role,
      experienceLevel: role === 'professional' ? (experience as ExperienceLevel) : null,
    })
    setBusy(false)
    if (error) setError(error)
    else navigate('/', { replace: true })
  }

  return (
    <AuthShell subtitle="Welcome — let’s set up your profile">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {/* Uncontrolled + remount key: pre-fills once the profile loads. */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="firstName" className={labelClass}>
              First name
              <RequiredMark />
            </label>
            <input
              id="firstName"
              ref={firstRef}
              key={`first-${profile?.display_name ?? ''}`}
              defaultValue={seeded.first}
              required
              className={fieldClass}
              autoComplete="given-name"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="lastName" className={labelClass}>
              Last name
              <RequiredMark />
            </label>
            <input
              id="lastName"
              ref={lastRef}
              key={`last-${profile?.display_name ?? ''}`}
              defaultValue={seeded.last}
              required
              className={fieldClass}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div>
          <label htmlFor="role" className={labelClass}>
            I’m a…
            <RequiredMark />
          </label>
          <select
            id="role"
            className={fieldClass}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {SIGNUP_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {role === 'professional' && (
          <div>
            <label htmlFor="experience" className={labelClass}>
              Experience level
              <RequiredMark />
            </label>
            <select
              id="experience"
              className={fieldClass}
              value={experience}
              onChange={(e) => setExperience(e.target.value as ExperienceLevel | '')}
            >
              <option value="" disabled>
                Select…
              </option>
              {EXPERIENCE_LEVELS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        )}
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
