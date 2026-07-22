import { createClient } from '@supabase/supabase-js'

/**
 * The single Supabase client. Credentials come from `.env`
 * (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY) — see docs/AUTH-SETUP.md.
 *
 * A client is always constructed (with harmless placeholders when the project
 * hasn't been configured yet) so imports never throw; real network calls are
 * gated on `supabaseConfigured` and the auth/UI layers show a setup notice.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && anonKey)

if (!supabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[Bloom Studio] Supabase is not configured. Copy .env.example to .env and add ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see docs/AUTH-SETUP.md).',
  )
}

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'anon-placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
