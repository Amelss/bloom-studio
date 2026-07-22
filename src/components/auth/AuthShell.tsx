import type { ReactNode } from 'react'
import { useAuth } from '../../domain/auth'

/** Centred card layout shared by the login and sign-up screens. */
export function AuthShell({
  subtitle,
  children,
  footer,
}: {
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  const configured = useAuth((s) => s.configured)
  return (
    <div className="flex min-h-full items-center justify-center bg-bloom-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-bloom-700">Bloom Studio</h1>
          <p className="mt-1 text-sm text-bloom-ink/55">{subtitle}</p>
        </div>
        {!configured && (
          <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
            <span className="font-semibold">Supabase isn’t connected yet.</span> Add your project
            keys to <code className="font-mono">.env</code> (see <code>docs/AUTH-SETUP.md</code>) and
            restart the dev server to enable sign-in.
          </div>
        )}
        <div className="rounded-2xl bg-white p-6 shadow-panel ring-1 ring-bloom-ink/[0.05]">
          {children}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-bloom-ink/60">{footer}</div>}
      </div>
    </div>
  )
}

/** Google's multicolour "G" for the OAuth button. */
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-4 6.8-9.9 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.9 2.2-6.4 0-11.8-4.1-13.7-9.9l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export const fieldClass =
  'w-full rounded-lg bg-bloom-100/60 px-3 py-2 text-sm text-bloom-ink placeholder:text-bloom-ink/40 outline-none transition-colors focus:bg-white focus:ring-2 focus:ring-bloom-600'

export const labelClass = 'mb-1 block text-xs font-medium text-bloom-ink/70'
