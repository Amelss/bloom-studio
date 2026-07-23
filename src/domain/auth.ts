import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { ExperienceLevel, Profile, UserRole } from '../lib/types'

/** Editable profile fields (from Account settings). */
export interface ProfilePatch {
  display_name?: string
  organisation?: string | null
  experience_level?: ExperienceLevel | null
  avatar_url?: string | null
}

function toMessage(e: unknown): string {
  if (e instanceof Error && e.message.includes('fetch')) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return e instanceof Error ? e.message : 'Something went wrong.'
}

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
  updateProfile: (patch: ProfilePatch) => Promise<{ error: string | null }>
  uploadAvatar: (file: File) => Promise<{ error: string | null }>
  completeOnboarding: (args: {
    displayName: string
    role: UserRole
  }) => Promise<{ error: string | null }>
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

  updateProfile: async (patch) => {
    const user = get().user
    if (!user) return { error: 'You are not signed in.' }
    const current = get().profile
    try {
      // upsert (POST) rather than update (PATCH) — some deployments block PATCH
      // at the CORS layer. display_name is always included so the insert-shaped
      // payload satisfies the NOT NULL column even on a partial edit.
      const row: Record<string, unknown> = {
        id: user.id,
        display_name: patch.display_name ?? current?.display_name ?? '',
      }
      if (patch.organisation !== undefined) row.organisation = patch.organisation
      if (patch.experience_level !== undefined) row.experience_level = patch.experience_level
      if (patch.avatar_url !== undefined) row.avatar_url = patch.avatar_url

      const { error } = await supabase.from('profiles').upsert(row)
      if (error) return { error: error.message }
      // Mirror the name onto auth metadata (shown in the Supabase dashboard).
      if (patch.display_name) {
        await supabase.auth.updateUser({ data: { display_name: patch.display_name } })
      }
      await get().loadProfile()
      return { error: null }
    } catch (e) {
      return { error: toMessage(e) }
    }
  },

  uploadAvatar: async (file) => {
    const user = get().user
    if (!user) return { error: 'You are not signed in.' }
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type || undefined })
      if (upErr) return { error: upErr.message }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust so a replaced image at the same path shows immediately.
      return await get().updateProfile({ avatar_url: `${data.publicUrl}?v=${Date.now()}` })
    } catch (e) {
      return { error: toMessage(e) }
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

  completeOnboarding: async ({ displayName, role }) => {
    const user = get().user
    if (!user) return { error: 'You are not signed in.' }
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: displayName, role, onboarded: true })
      if (error) return { error: error.message }
      await supabase.auth.updateUser({ data: { display_name: displayName, role } })
      await get().loadProfile()
      return { error: null }
    } catch (e) {
      return {
        error:
          e instanceof Error && e.message.includes('fetch')
            ? 'Could not reach the server. Check your connection and try again.'
            : e instanceof Error
              ? e.message
              : 'Something went wrong.',
      }
    }
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
