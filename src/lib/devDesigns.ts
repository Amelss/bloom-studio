import { migrateDocument } from '../domain/migrate'
import type { DesignDocument } from '../domain/types'
import type { DesignListItem, DesignRow } from './types'

/**
 * A localStorage-backed designs store used ONLY in the dev no-auth bypass, where
 * there's no real Supabase session so the cloud CRUD can't run. It lets you
 * reach and use the canvas locally. Mirrors the shapes designsApi returns.
 */

const KEY = 'bloom-dev-designs-v1'

interface DevRow {
  id: string
  name: string
  doc: DesignDocument
  thumbnail_url: string | null
  created_at: string
  updated_at: string
}

function read(): Record<string, DevRow> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, DevRow>
  } catch {
    return {}
  }
}

function write(map: Record<string, DevRow>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    // storage full/disabled — nothing else we can do in the bypass
  }
}

export function devCreateDesign(name: string, doc: DesignDocument): string {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const map = read()
  map[id] = { id, name, doc, thumbnail_url: null, created_at: now, updated_at: now }
  write(map)
  return id
}

export function devListDesigns(): DesignListItem[] {
  return Object.values(read())
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map((r) => ({ id: r.id, name: r.name, thumbnail_url: r.thumbnail_url, updated_at: r.updated_at }))
}

export function devLoadDesign(id: string): DesignRow {
  const row = read()[id]
  if (!row) throw new Error('Design not found (dev bypass).')
  return {
    id: row.id,
    owner_id: 'dev-user',
    name: row.name,
    doc: migrateDocument(row.doc),
    doc_version: row.doc.version,
    thumbnail_url: row.thumbnail_url,
    share_id: null,
    shared_at: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function devSaveDesign(
  id: string,
  patch: { doc?: DesignDocument; name?: string; thumbnail?: string | null },
): void {
  const map = read()
  const row = map[id]
  if (!row) return
  if (patch.doc !== undefined) row.doc = patch.doc
  if (patch.name !== undefined) row.name = patch.name
  if (patch.thumbnail !== undefined) row.thumbnail_url = patch.thumbnail
  row.updated_at = new Date().toISOString()
  write(map)
}

export function devDeleteDesign(id: string): void {
  const map = read()
  delete map[id]
  write(map)
}
