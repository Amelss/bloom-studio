import { supabase } from './supabase'
import { migrateDocument } from '../domain/migrate'
import type { DesignDocument } from '../domain/types'
import type { SnapshotKind, SnapshotMeta } from './types'

/**
 * Versioned snapshots: immutable frozen copies of a design's document. The live
 * `doc` on the designs row is what autosave keeps current; a snapshot is a
 * moment in that history worth returning to. Reads/writes are owner-scoped by
 * RLS. See supabase/migrations/0007_snapshots.sql.
 */

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('You are not signed in.')
  return id
}

/** Freeze the given document as a new snapshot. A plain insert (POST). */
export async function createSnapshot(input: {
  designId: string
  doc: DesignDocument
  thumbnail?: string | null
  label?: string | null
  kind: SnapshotKind
}): Promise<void> {
  const owner_id = await requireUserId()
  const { error } = await supabase.from('design_snapshots').insert({
    design_id: input.designId,
    owner_id,
    doc: input.doc,
    doc_version: input.doc.version,
    thumbnail_url: input.thumbnail ?? null,
    label: input.label?.trim() || null,
    kind: input.kind,
  })
  if (error) throw error
}

/** A design's version history, newest first — metadata only (no heavy `doc`). */
export async function listSnapshots(designId: string): Promise<SnapshotMeta[]> {
  const { data, error } = await supabase
    .from('design_snapshots')
    .select('id, design_id, doc_version, thumbnail_url, label, kind, created_at')
    .eq('design_id', designId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SnapshotMeta[]
}

/** Fetch one snapshot's frozen document (for restore or preview). */
export async function getSnapshotDoc(snapshotId: string): Promise<DesignDocument> {
  const { data, error } = await supabase
    .from('design_snapshots')
    .select('doc')
    .eq('id', snapshotId)
    .single()
  if (error) throw error
  return migrateDocument((data as { doc: DesignDocument }).doc)
}

/** Rename a snapshot's label. RPC (POST) — a direct UPDATE is a blocked PATCH. */
export async function renameSnapshot(snapshotId: string, label: string): Promise<void> {
  const { error } = await supabase.rpc('rename_snapshot', {
    p_id: snapshotId,
    p_label: label,
  })
  if (error) throw error
}

/** Delete a snapshot. DELETE is permitted directly (unlike PATCH). */
export async function deleteSnapshot(snapshotId: string): Promise<void> {
  const { error } = await supabase.from('design_snapshots').delete().eq('id', snapshotId)
  if (error) throw error
}
