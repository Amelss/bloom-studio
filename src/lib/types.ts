import type { DesignDocument } from '../domain/types'

/** Account roles — mirrors the `profiles.role` check in the SQL schema. */
export type UserRole = 'student' | 'educator' | 'professional' | 'admin'

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'professional'

export interface Profile {
  id: string
  display_name: string
  role: UserRole
  onboarded: boolean
  organisation: string | null
  experience_level: ExperienceLevel | null
  avatar_url: string | null
  created_at: string
}

/** A full `designs` row (the design document lives in `doc`). */
export interface DesignRow {
  id: string
  owner_id: string
  name: string
  doc: DesignDocument
  doc_version: number
  thumbnail_url: string | null
  /** Unguessable public share token, or null when the design isn't shared. */
  share_id: string | null
  shared_at: string | null
  created_at: string
  updated_at: string
}

/** The read-only projection an anonymous viewer receives for a shared design. */
export interface SharedDesign {
  id: string
  name: string
  doc: DesignDocument
  updated_at: string
}

export type FeedbackVerdict = 'approved' | 'changes_requested'

/** A single client response left against a shared design. */
export interface DesignFeedback {
  id: string
  design_id: string
  verdict: FeedbackVerdict
  note: string | null
  reviewer_name: string | null
  created_at: string
}

/** Trimmed row for the dashboard list — no heavy `doc`. */
export interface DesignListItem {
  id: string
  name: string
  thumbnail_url: string | null
  updated_at: string
}
