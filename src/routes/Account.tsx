import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import { UserMenu } from '../components/auth/UserMenu'
import { fieldClass, labelClass } from '../components/auth/AuthShell'
import { EXPERIENCE_LEVELS, SIGNUP_ROLES } from '../lib/profileOptions'
import type { ExperienceLevel, UserRole } from '../lib/types'

export default function Account() {
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const updateProfile = useAuth((s) => s.updateProfile)
  const uploadAvatar = useAuth((s) => s.uploadAvatar)

  const nameRef = useRef<HTMLInputElement>(null)
  const orgRef = useRef<HTMLInputElement>(null)
  // Role + experience are controlled so the experience field can appear only for
  // professionals. Resynced from the profile once it loads.
  const [role, setRole] = useState<UserRole>(profile?.role ?? 'student')
  const [experience, setExperience] = useState<ExperienceLevel | ''>(profile?.experience_level ?? '')
  useEffect(() => {
    if (profile) {
      setRole(profile.role)
      setExperience(profile.experience_level ?? '')
    }
  }, [profile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const initial = (profile?.display_name?.trim()[0] ?? '?').toUpperCase()

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const displayName = nameRef.current?.value.trim() ?? ''
    if (!displayName) {
      setError('Please enter a name.')
      return
    }
    if (role === 'professional' && !experience) {
      setError('Please select your experience level.')
      return
    }
    setSaving(true)
    setError(null)
    setStatus(null)
    const org = orgRef.current?.value.trim() ?? ''
    const { error } = await updateProfile({
      display_name: displayName,
      role,
      organisation: org || null,
      // Experience level only applies to professionals; cleared otherwise.
      experience_level: role === 'professional' ? (experience as ExperienceLevel) : null,
    })
    setSaving(false)
    if (error) setError(error)
    else setStatus('Saved.')
  }

  const onAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    setStatus(null)
    const { error } = await uploadAvatar(file)
    setUploading(false)
    if (error) setError(error)
  }

  return (
    <div className="min-h-full bg-bloom-50">
      <header className="flex items-center justify-between border-b border-bloom-200 bg-white/80 px-6 py-3">
        <Link to="/" className="font-brand text-lg font-semibold text-bloom-700">
          Florafo
        </Link>
        <UserMenu />
      </header>

      <main className="mx-auto max-w-lg px-6 py-8">
        <Link to="/" className="text-sm text-bloom-ink/55 transition-colors hover:text-bloom-ink">
          ← Back to my designs
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold text-bloom-ink">Account settings</h1>

        <form
          onSubmit={onSave}
          className="mt-6 rounded-2xl bg-white p-6 shadow-panel ring-1 ring-bloom-ink/[0.05]"
        >
          {/* Avatar */}
          <div className="mb-5 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full bg-bloom-600 text-white">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl font-semibold">
                  {initial}
                </span>
              )}
            </div>
            <label className="cursor-pointer rounded-lg border border-bloom-200 bg-white px-3 py-1.5 text-sm font-medium shadow-soft transition-colors hover:bg-bloom-100">
              {uploading ? 'Uploading…' : 'Change photo'}
              <input type="file" accept="image/*" className="hidden" onChange={onAvatar} disabled={uploading} />
            </label>
          </div>

          <label className={labelClass} htmlFor="displayName">
            Display name
          </label>
          {/* Uncontrolled + remount key: fields refresh once the profile loads. */}
          <input
            id="displayName"
            ref={nameRef}
            key={`name-${profile?.id ?? ''}`}
            defaultValue={profile?.display_name ?? ''}
            className={fieldClass}
            autoComplete="name"
          />

          <label className={`${labelClass} mt-4`} htmlFor="organisation">
            Organisation / college <span className="font-normal text-bloom-ink/40">(optional)</span>
          </label>
          <input
            id="organisation"
            ref={orgRef}
            key={`org-${profile?.id ?? ''}`}
            defaultValue={profile?.organisation ?? ''}
            className={fieldClass}
          />

          <div className="mt-4">
            <span className={labelClass}>Email</span>
            <p className="text-sm text-bloom-ink/70">{user?.email ?? '—'}</p>
          </div>
          <label className={`${labelClass} mt-4`} htmlFor="role">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={fieldClass}
          >
            {SIGNUP_ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-bloom-ink/45">
            Students &amp; educators get the Classroom, Progress tracking and learning features.
            Professionals get the design studio — plus learning features if they’re a Beginner.
          </p>

          {role === 'professional' && (
            <>
              <label className={`${labelClass} mt-4`} htmlFor="experience">
                Experience level
              </label>
              <select
                id="experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value as ExperienceLevel | '')}
                className={fieldClass}
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
              <p className="mt-1 text-xs text-bloom-ink/45">
                Beginner unlocks Learning Mode; other levels keep the studio clutter-free.
              </p>
            </>
          )}

          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
          {status && <p className="mt-3 text-xs text-bloom-700">{status}</p>}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-bloom-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </main>
    </div>
  )
}
