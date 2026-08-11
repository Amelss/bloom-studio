import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { ExperienceLevel, Profile, UserRole } from '../lib/types'

/** Editable profile fields (from Account settings). */
export interface ProfilePatch {
  first_name?: string | null
  last_name?: string | null
  display_name?: string
  role?: UserRole
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
    firstName: string
    lastName: string
    role: UserRole
    experienceLevel: ExperienceLevel | null
  }) => Promise<{ error: string | null }>
  signUp: (args: {
    email: string
    password: string
    firstName: string
    lastName: string
    role: UserRole
    experienceLevel: ExperienceLevel | null
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
    // DEV-ONLY auth bypass so the canvas is reachable without a real login.
    // Double-gated: `import.meta.env.DEV` means it is stripped from any
    // production build, and it only activates when VITE_DEV_NO_AUTH=true is set
    // in a local .env. NEVER set that flag in a deployed environment.
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_NO_AUTH === 'true') {
      set({
        user: { id: 'dev-user', email: 'dev@localhost' } as unknown as User,
        profile: {
          id: 'dev-user',
          first_name: 'Dev',
          last_name: 'User',
          display_name: 'Dev',
          role: 'student',
          onboarded: true,
        } as unknown as Profile,
        loading: false,
        configured: true,
      })
      return
    }
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
    // Dev no-auth bypass: `dev-user` isn't a real UUID and there's no session,
    // so a Supabase write would fail. Apply the edit to the in-memory profile
    // only — enough to flip role and exercise the role-gated UI locally.
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_NO_AUTH === 'true') {
      set({ profile: { ...(current as Profile), ...patch } as Profile })
      return { error: null }
    }
    try {
      // upsert (POST) rather than update (PATCH) — some deployments block PATCH
      // at the CORS layer. display_name is always included so the insert-shaped
      // payload satisfies the NOT NULL column even on a partial edit.
      const row: Record<string, unknown> = {
        id: user.id,
        display_name: patch.display_name ?? current?.display_name ?? '',
      }
      if (patch.first_name !== undefined) row.first_name = patch.first_name
      if (patch.last_name !== undefined) row.last_name = patch.last_name
      if (patch.role !== undefined) row.role = patch.role
      if (patch.organisation !== undefined) row.organisation = patch.organisation
      if (patch.experience_level !== undefined) row.experience_level = patch.experience_level
      if (patch.avatar_url !== undefined) row.avatar_url = patch.avatar_url

      const { error } = await supabase.from('profiles').upsert(row)
      if (error) return { error: error.message }
      // Mirror name/role onto auth metadata (shown in the Supabase dashboard,
      // and read by the new-user trigger on future sign-ins).
      const meta: Record<string, unknown> = {}
      if (patch.display_name) meta.display_name = patch.display_name
      if (patch.role) meta.role = patch.role
      if (Object.keys(meta).length) await supabase.auth.updateUser({ data: meta })
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

  signUp: async ({ email, password, firstName, lastName, role, experienceLevel }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Read by the handle_new_user() trigger, which derives a unique display name.
      options: {
        data: { first_name: firstName, last_name: lastName, role, experience_level: experienceLevel },
      },
    })
    if (error) return { error: error.message, needsConfirmation: false }
    // No session means email confirmation is required before first login.
    return { error: null, needsConfirmation: !data.session }
  },

  completeOnboarding: async ({ firstName, lastName, role, experienceLevel }) => {
    const user = get().user
    if (!user) return { error: 'You are not signed in.' }
    try {
      // Default display name = "First Last", de-duplicated server-side.
      const base = `${firstName} ${lastName}`.trim()
      const { data: unique, error: rpcErr } = await supabase.rpc('generate_unique_display_name', {
        p_base: base,
      })
      if (rpcErr) return { error: rpcErr.message }
      const displayName = (unique as string | null) || base
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        role,
        experience_level: experienceLevel,
        onboarded: true,
      })
      if (error) return { error: error.message }
      await supabase.auth.updateUser({
        data: { display_name: displayName, first_name: firstName, last_name: lastName, role, experience_level: experienceLevel },
      })
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

/**
 * Two capability tiers:
 *
 * - Canvas learning (the Learn tab + educational annotations): students,
 *   educators and admins always; a professional only if they told us at sign-up
 *   that they're a Beginner. Other professional levels don't get it.
 * - Classroom + Progress (the course/tracking layer): only student / educator /
 *   admin. Professionals (any level) have neither.
 *
 * Design overlays (form guide / balance / tilt) are NOT gated here — they're a
 * plain design tool available to every account, always, from the toolbar.
 */
export function useHasCanvasLearning(): boolean {
  return useAuth((s) => {
    const p = s.profile
    if (p?.role === 'professional') return p.experience_level === 'beginner'
    return true // student / educator / admin (and unknown-during-load)
  })
}

export function useHasClassroom(): boolean {
  return useAuth((s) => {
    const role = s.profile?.role
    return role === 'student' || role === 'educator' || role === 'admin'
  })
}
