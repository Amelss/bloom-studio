import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DISPLAY_NAME_TAKEN, useAuth } from '../domain/auth'
import { UserMenu } from '../components/auth/UserMenu'
import { fieldClass, labelClass } from '../components/auth/AuthShell'
import { EXPERIENCE_LEVELS, SIGNUP_ROLES } from '../lib/profileOptions'

export default function Account() {
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const updateProfile = useAuth((s) => s.updateProfile)
  const uploadAvatar = useAuth((s) => s.uploadAvatar)

  const firstRef = useRef<HTMLInputElement>(null)
  const lastRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null) // display name
  const orgRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // A "display name taken" error is shown inline under that field, not form-wide.
  const [displayNameError, setDisplayNameError] = useState<string | null>(null)

  const initial = (profile?.display_name?.trim()[0] ?? '?').toUpperCase()
  // Role + experience are set at sign-up and can't be changed here.
  const roleLabel = SIGNUP_ROLES.find((r) => r.id === profile?.role)?.label ?? profile?.role ?? '—'
  const experienceLabel =
    EXPERIENCE_LEVELS.find((x) => x.id === profile?.experience_level)?.label ?? null

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const first = firstRef.current?.value.trim() ?? ''
    const last = lastRef.current?.value.trim() ?? ''
    const displayName = nameRef.current?.value.trim() ?? ''
    if (!first || !last) {
      setError('Please enter your first and last name.')
      return
    }
    if (!displayName) {
      setError('Please enter a display name.')
      return
    }
    setSaving(true)
    setError(null)
    setDisplayNameError(null)
    setStatus(null)
    const org = orgRef.current?.value.trim() ?? ''
    const { error } = await updateProfile({
      first_name: first,
      last_name: last,
      display_name: displayName,
      organisation: org || null,
    })
    setSaving(false)
    if (error === DISPLAY_NAME_TAKEN) {
      setDisplayNameError(error)
      nameRef.current?.focus()
    } else if (error) {
      setError(error)
    } else {
      setStatus('Saved.')
    }
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

          {/* Uncontrolled + remount key: fields refresh once the profile loads. */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass} htmlFor="firstName">
                First name
              </label>
              <input
                id="firstName"
                ref={firstRef}
                key={`first-${profile?.id ?? ''}`}
                defaultValue={profile?.first_name ?? ''}
                className={fieldClass}
                autoComplete="given-name"
              />
            </div>
            <div className="flex-1">
              <label className={labelClass} htmlFor="lastName">
                Last name
              </label>
              <input
                id="lastName"
                ref={lastRef}
                key={`last-${profile?.id ?? ''}`}
                defaultValue={profile?.last_name ?? ''}
                className={fieldClass}
                autoComplete="family-name"
              />
            </div>
          </div>

          <label className={`${labelClass} mt-4`} htmlFor="displayName">
            Display name
          </label>
          <input
            id="displayName"
            ref={nameRef}
            key={`name-${profile?.id ?? ''}`}
            defaultValue={profile?.display_name ?? ''}
            onChange={() => displayNameError && setDisplayNameError(null)}
            aria-invalid={displayNameError ? true : undefined}
            className={`${fieldClass} ${displayNameError ? 'ring-2 ring-red-500' : ''}`}
            autoComplete="nickname"
          />
          {displayNameError && <p className="mt-1 text-xs text-red-700">{displayNameError}</p>}

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

          <div className="mt-4">
            <span className={labelClass}>Role</span>
            <p className="text-sm text-bloom-ink/70">{roleLabel}</p>
          </div>

          {experienceLabel && (
            <div className="mt-4">
              <span className={labelClass}>Experience level</span>
              <p className="text-sm text-bloom-ink/70">{experienceLabel}</p>
            </div>
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
