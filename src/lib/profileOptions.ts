import type { ExperienceLevel, UserRole } from './types'

/** Roles a user can choose for themselves (admin is assigned internally, never picked). */
export const SIGNUP_ROLES: Array<{ id: UserRole; label: string }> = [
  { id: 'student', label: 'Student' },
  { id: 'educator', label: 'Educator' },
  { id: 'professional', label: 'Professional' },
]

/** Experience levels — only captured for professionals; drives Learning Mode. */
export const EXPERIENCE_LEVELS: Array<{ id: ExperienceLevel; label: string }> = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
]
