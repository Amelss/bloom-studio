import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import { UserMenu } from '../components/auth/UserMenu'
import { fieldClass, labelClass } from '../components/auth/AuthShell'
import type { ExperienceLevel } from '../lib/types'

const EXPERIENCE: Array<{ id: ExperienceLevel; label: string }> = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'professional', label: 'Professional' },
]

export default function Account() {
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const updateProfile = useAuth((s) => s.updateProfile)
  const uploadAvatar = useAuth((s) => s.uploadAvatar)

  const nameRef = useRef<HTMLInputElement>(null)
  const orgRef = useRef<HTMLInputElement>(null)
  const expRef = useRef<HTMLSelectElement>(null)

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
    setSaving(true)
    setError(null)
    setStatus(null)
    const org = orgRef.current?.value.trim() ?? ''
    const exp = expRef.current?.value ?? ''
    const { error } = await updateProfile({
      display_name: displayName,
      organisation: org || null,
      experience_level: (exp || null) as ExperienceLevel | null,
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
        <Link to="/" className="font-display text-lg font-semibold text-bloom-700">
          Bloom Studio
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

          <label className={`${labelClass} mt-4`} htmlFor="experience">
            Experience level <span className="font-normal text-bloom-ink/40">(optional)</span>
          </label>
          <select
            id="experience"
            ref={expRef}
            key={`exp-${profile?.id ?? ''}`}
            defaultValue={profile?.experience_level ?? ''}
            className={fieldClass}
          >
            <option value="">Prefer not to say</option>
            {EXPERIENCE.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>

          <div className="mt-4">
            <span className={labelClass}>Email</span>
            <p className="text-sm text-bloom-ink/70">{user?.email ?? '—'}</p>
          </div>
          <div className="mt-3">
            <span className={labelClass}>Role</span>
            <p className="text-sm capitalize text-bloom-ink/70">{profile?.role ?? '—'}</p>
          </div>

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
