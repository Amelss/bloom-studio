import { supabase } from './supabase'
import type { DesignDocument } from '../domain/types'
import type { DesignListItem, DesignRow } from './types'

/**
 * CRUD for the `designs` table. Every call is implicitly scoped to the signed-in
 * user by row-level security, so we never filter by owner here — the database
 * refuses to return or mutate anyone else's rows.
 */

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('You are not signed in.')
  return id
}

export async function listDesigns(): Promise<DesignListItem[]> {
  const { data, error } = await supabase
    .from('designs')
    .select('id, name, thumbnail_url, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DesignListItem[]
}

export async function createDesign(name: string, doc: DesignDocument): Promise<string> {
  const owner_id = await requireUserId()
  const { data, error } = await supabase
    .from('designs')
    .insert({ owner_id, name, doc, doc_version: doc.version })
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

export async function loadDesign(id: string): Promise<DesignRow> {
  const { data, error } = await supabase.from('designs').select('*').eq('id', id).single()
  if (error) throw error
  return data as DesignRow
}

/**
 * Partial update — send only what changed (doc autosave, rename, thumbnail).
 * Uses upsert (POST) rather than update (PATCH): some deployments block PATCH at
 * the CORS layer. The row already exists, so this resolves to an UPDATE; RLS
 * still restricts it to the owner. `owner_id` is included to satisfy the
 * insert-shaped payload's not-null constraint.
 */
export async function saveDesign(
  id: string,
  patch: { doc?: DesignDocument; name?: string; thumbnail?: string | null },
): Promise<void> {
  const row: Record<string, unknown> = { id }
  if (patch.doc !== undefined) {
    row.doc = patch.doc
    row.doc_version = patch.doc.version
  }
  if (patch.name !== undefined) row.name = patch.name
  if (patch.thumbnail !== undefined) row.thumbnail_url = patch.thumbnail
  if (Object.keys(row).length === 1) return // nothing but the id
  row.owner_id = await requireUserId()
  const { error } = await supabase.from('designs').upsert(row)
  if (error) throw error
}

export async function renameDesign(id: string, name: string): Promise<void> {
  const owner_id = await requireUserId()
  const { error } = await supabase.from('designs').upsert({ id, owner_id, name })
  if (error) throw error
}

export async function deleteDesign(id: string): Promise<void> {
  const { error } = await supabase.from('designs').delete().eq('id', id)
  if (error) throw error
}
