import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import { UserMenu } from '../components/auth/UserMenu'
import { fieldClass, labelClass } from '../components/auth/AuthShell'

export default function Account() {
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const updateDisplayName = useAuth((s) => s.updateDisplayName)

  const nameRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const value = nameRef.current?.value.trim() ?? ''
    if (!value) {
      setError('Please enter a name.')
      return
    }
    setSaving(true)
    setError(null)
    setStatus(null)
    const { error } = await updateDisplayName(value)
    setSaving(false)
    if (error) setError(error)
    else setStatus('Saved.')
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
          <label className={labelClass} htmlFor="displayName">
            Display name
          </label>
          {/* Uncontrolled + remount key: refreshes when the profile loads. */}
          <input
            id="displayName"
            ref={nameRef}
            key={profile?.display_name ?? ''}
            defaultValue={profile?.display_name ?? ''}
            className={fieldClass}
            autoComplete="name"
          />
          <p className="mt-1 text-xs text-bloom-ink/45">The name shown on your account.</p>

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
