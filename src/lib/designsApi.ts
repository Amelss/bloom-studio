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

/** Partial update — send only what changed (doc autosave, rename, thumbnail). */
export async function saveDesign(
  id: string,
  patch: { doc?: DesignDocument; name?: string; thumbnail?: string | null },
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (patch.doc !== undefined) {
    update.doc = patch.doc
    update.doc_version = patch.doc.version
  }
  if (patch.name !== undefined) update.name = patch.name
  if (patch.thumbnail !== undefined) update.thumbnail_url = patch.thumbnail
  if (Object.keys(update).length === 0) return
  const { error } = await supabase.from('designs').update(update).eq('id', id)
  if (error) throw error
}

export async function renameDesign(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('designs').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteDesign(id: string): Promise<void> {
  const { error } = await supabase.from('designs').delete().eq('id', id)
  if (error) throw error
}
