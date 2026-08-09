import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../domain/auth'

/**
 * Account chip: initial avatar → dropdown with dashboard, account, sign out.
 * `direction` controls whether the menu opens below (default, for top bars) or
 * above (for the sidebar, where the chip sits at the bottom of the screen).
 */
export function UserMenu({ direction = 'down' }: { direction?: 'up' | 'down' }) {
  const navigate = useNavigate()
  const profile = useAuth((s) => s.profile)
  const user = useAuth((s) => s.user)
  const signOut = useAuth((s) => s.signOut)

  const name = profile?.display_name ?? user?.email ?? 'Account'
  const initial = (name.trim()[0] ?? '?').toUpperCase()

  // Native <details> stays open after a click; close it explicitly.
  const close = (e: MouseEvent) => {
    ;(e.currentTarget as HTMLElement).closest('details')?.removeAttribute('open')
  }

  const itemClass = 'block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100'

  return (
    <details className="relative">
      <summary
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center overflow-hidden rounded-full bg-bloom-600 text-sm font-semibold text-white"
        title={name}
        aria-label="Account menu"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </summary>
      <div
        className={`absolute z-50 w-56 rounded-xl bg-white p-1 shadow-pop ring-1 ring-bloom-ink/[0.06] ${
          direction === 'up' ? 'bottom-full left-0 mb-1.5' : 'right-0 mt-1.5'
        }`}
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{profile?.display_name ?? 'Signed in'}</p>
          {user?.email && <p className="truncate text-xs text-bloom-ink/50">{user.email}</p>}
          {profile?.role && (
            <p className="mt-0.5 text-[11px] capitalize text-bloom-ink/40">{profile.role}</p>
          )}
        </div>
        <div className="my-1 h-px bg-bloom-200" />
        <Link to="/" onClick={close} className={itemClass}>
          My designs
        </Link>
        <Link to="/account" onClick={close} className={itemClass}>
          Account settings
        </Link>
        <div className="my-1 h-px bg-bloom-200" />
        <button
          className={itemClass}
          onClick={(e) => {
            close(e)
            void signOut().then(() => navigate('/login'))
          }}
        >
          Sign out
        </button>
      </div>
    </details>
  )
}
