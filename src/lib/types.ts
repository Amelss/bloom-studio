import type { DesignDocument } from '../domain/types'

/** Account roles — mirrors the `profiles.role` check in the SQL schema. */
export type UserRole = 'student' | 'educator' | 'professional' | 'admin'

export interface Profile {
  id: string
  display_name: string
  role: UserRole
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
  created_at: string
  updated_at: string
}

/** Trimmed row for the dashboard list — no heavy `doc`. */
export interface DesignListItem {
  id: string
  name: string
  thumbnail_url: string | null
  updated_at: string
}
