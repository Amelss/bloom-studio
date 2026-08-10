import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listExerciseCompletions,
  recordExerciseCompletion,
  recordSkillSamples,
} from './progressApi'

const h = vi.hoisted(() => ({
  state: {
    insertPayload: null as unknown,
    insertTable: null as string | null,
    listResult: { data: [] as unknown[], error: null as unknown },
  },
}))

vi.mock('./supabase', () => {
  const { state } = h
  const makeBuilder = (table: string): Record<string, unknown> => {
    const builder: Record<string, unknown> = {
      insert: (p: unknown) => {
        state.insertPayload = p
        state.insertTable = table
        return Promise.resolve({ error: null })
      },
      select: () => builder,
      order: () => Promise.resolve(state.listResult),
    }
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    },
  }
})

beforeEach(() => {
  h.state.insertPayload = null
  h.state.insertTable = null
  h.state.listResult = { data: [], error: null }
})

describe('recordExerciseCompletion', () => {
  it('logs the brief, design and score against the owner', async () => {
    await recordExerciseCompletion({ briefId: 'budget-compote', designId: 'd9', overallScore: 82 })
    expect(h.state.insertTable).toBe('exercise_completions')
    expect(h.state.insertPayload).toMatchObject({
      owner_id: 'user-1',
      brief_id: 'budget-compote',
      design_id: 'd9',
      overall_score: 82,
    })
  })
})

describe('recordSkillSamples', () => {
  it('inserts one row per principle sample', async () => {
    await recordSkillSamples('d9', [
      { principleId: 'balance', score: 70, tone: 'tip' },
      { principleId: 'depth', score: 90, tone: 'positive' },
    ])
    expect(h.state.insertTable).toBe('skill_samples')
    const rows = h.state.insertPayload as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ owner_id: 'user-1', design_id: 'd9', principle_id: 'balance', score: 70, tone: 'tip' })
  })

  it('is a no-op when there are no samples', async () => {
    await recordSkillSamples('d9', [])
    expect(h.state.insertPayload).toBeNull()
  })
})

describe('listExerciseCompletions', () => {
  it('returns the rows the query yields', async () => {
    h.state.listResult = {
      data: [{ id: 'c1', brief_id: 'x', design_id: null, overall_score: 50, completed_at: 't' }],
      error: null,
    }
    const rows = await listExerciseCompletions()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('c1')
  })
})
