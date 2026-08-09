import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blankDocument } from '../domain/templates'
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshotDoc,
  listSnapshots,
  renameSnapshot,
} from './snapshotsApi'

// A minimal chainable stand-in for the Supabase client that records the writes
// the API layer makes, so we can assert on payload shape without a network.
const h = vi.hoisted(() => ({
  state: {
    insertPayload: null as Record<string, unknown> | null,
    rpcCalls: [] as Array<[string, unknown]>,
    deleteEq: null as [string, string] | null,
    listResult: { data: [] as unknown[], error: null as unknown },
    singleResult: { data: null as unknown, error: null as unknown },
  },
}))

vi.mock('./supabase', () => {
  const { state } = h
  const builder: Record<string, unknown> = {
    insert: (p: Record<string, unknown>) => {
      state.insertPayload = p
      return Promise.resolve({ error: null })
    },
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve(state.listResult),
    single: () => Promise.resolve(state.singleResult),
    delete: () => ({
      eq: (c: string, v: string) => {
        state.deleteEq = [c, v]
        return Promise.resolve({ error: null })
      },
    }),
  }
  return {
    supabase: {
      from: () => builder,
      rpc: (name: string, args: unknown) => {
        state.rpcCalls.push([name, args])
        return Promise.resolve({ error: null })
      },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    },
  }
})

beforeEach(() => {
  h.state.insertPayload = null
  h.state.rpcCalls = []
  h.state.deleteEq = null
  h.state.listResult = { data: [], error: null }
  h.state.singleResult = { data: null, error: null }
})

describe('createSnapshot', () => {
  it('freezes the document with its version, owner, and kind', async () => {
    const doc = blankDocument('Test')
    await createSnapshot({ designId: 'd1', doc, thumbnail: 'data:img', label: 'v1', kind: 'manual' })
    const p = h.state.insertPayload!
    expect(p.design_id).toBe('d1')
    expect(p.owner_id).toBe('user-1')
    expect(p.doc_version).toBe(doc.version)
    expect(p.thumbnail_url).toBe('data:img')
    expect(p.label).toBe('v1')
    expect(p.kind).toBe('manual')
  })

  it('normalises a blank or whitespace label to null', async () => {
    const doc = blankDocument('Test')
    await createSnapshot({ designId: 'd1', doc, label: '   ', kind: 'shared' })
    expect(h.state.insertPayload!.label).toBeNull()
    expect(h.state.insertPayload!.thumbnail_url).toBeNull()
  })
})

describe('listSnapshots', () => {
  it('returns the rows the query yields', async () => {
    h.state.listResult = {
      data: [{ id: 's1', design_id: 'd1', kind: 'manual', created_at: 'x', doc_version: 4, thumbnail_url: null, label: null }],
      error: null,
    }
    const rows = await listSnapshots('d1')
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('s1')
  })
})

describe('getSnapshotDoc', () => {
  it('migrates the frozen document on the way out', async () => {
    const doc = blankDocument('Frozen')
    h.state.singleResult = { data: { doc }, error: null }
    const out = await getSnapshotDoc('s1')
    expect(out.name).toBe('Frozen')
    expect(out.version).toBe(doc.version)
  })
})

describe('renameSnapshot / deleteSnapshot', () => {
  it('renames through the rename_snapshot RPC', async () => {
    await renameSnapshot('s1', 'New name')
    expect(h.state.rpcCalls).toEqual([['rename_snapshot', { p_id: 's1', p_label: 'New name' }]])
  })

  it('deletes by id', async () => {
    await deleteSnapshot('s1')
    expect(h.state.deleteEq).toEqual(['id', 's1'])
  })
})
