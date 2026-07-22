import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Profile, UserRole } from '../lib/types'

/**
 * Auth session store — the same Zustand pattern as the design store. Holds the
 * Supabase session/user plus the app's `profile` row, and mirrors sign-in state
 * via `onAuthStateChange`. `loading` stays true until the first session check
 * resolves, so route guards don't bounce a logged-in user to /login on refresh.
 */
interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  /** False when VITE_SUPABASE_* aren't set — the UI shows a setup notice. */
  configured: boolean

  init: () => void
  loadProfile: () => Promise<void>
  updateDisplayName: (displayName: string) => Promise<{ error: string | null }>
  signUp: (args: {
    email: string
    password: string
    displayName: string
    role: UserRole
  }) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

let initialized = false

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  configured: supabaseConfigured,

  init: () => {
    if (initialized) return
    initialized = true
    if (!supabaseConfigured) {
      set({ loading: false })
      return
    }
    // v2 fires INITIAL_SESSION right away with the current session (or null).
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false })
      if (session?.user) {
        // Defer other Supabase calls out of the callback (avoids the client's
        // documented re-entrancy deadlock).
        setTimeout(() => void get().loadProfile(), 0)
      } else {
        set({ profile: null })
      }
    })
  },

  loadProfile: async () => {
    const user = get().user
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) set({ profile: data as Profile })
  },

  updateDisplayName: async (displayName) => {
    const user = get().user
    if (!user) return { error: 'You are not signed in.' }
    try {
      // upsert (POST) rather than update (PATCH): some deployments block PATCH
      // at the CORS layer, and this is functionally the same for an existing row.
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: displayName })
      if (error) return { error: error.message }
      // Mirror onto the auth user metadata so the Supabase dashboard
      // (Authentication → Users) shows the same name. Best-effort: `profiles`
      // is the source of truth, so a metadata hiccup doesn't fail the save.
      await supabase.auth.updateUser({ data: { display_name: displayName } })
      await get().loadProfile()
      return { error: null }
    } catch (e) {
      // Network-level failure (couldn't reach Supabase) rather than an API error.
      return {
        error:
          e instanceof Error && e.message.includes('fetch')
            ? 'Could not reach the server. Check your connection and that the Supabase project is running.'
            : e instanceof Error
              ? e.message
              : 'Something went wrong.',
      }
    }
  },

  signUp: async ({ email, password, displayName, role }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Read by the handle_new_user() trigger to seed the profile row.
      options: { data: { display_name: displayName, role } },
    })
    if (error) return { error: error.message, needsConfirmation: false }
    // No session means email confirmation is required before first login.
    return { error: null, needsConfirmation: !data.session }
  },

  signInWithPassword: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    return { error: error?.message ?? null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },
}))
