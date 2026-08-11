import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCourse,
  gradeSubmission,
  joinCourse,
  submitAssignment,
} from './classroomApi'

const h = vi.hoisted(() => ({
  state: {
    insertPayloads: [] as unknown[],
    singleQueue: [] as Array<{ data: unknown; error: unknown }>,
    rpcCalls: [] as Array<[string, unknown]>,
    rpcResult: { data: null as unknown, error: null as unknown },
  },
}))

vi.mock('./supabase', () => {
  const { state } = h
  const builder: Record<string, unknown> = {
    insert: (p: unknown) => {
      state.insertPayloads.push(p)
      return builder
    },
    select: () => builder,
    eq: () => builder,
    order: () => Promise.resolve({ data: [], error: null }),
    single: () => Promise.resolve(state.singleQueue.shift() ?? { data: null, error: null }),
    maybeSingle: () => Promise.resolve(state.singleQueue.shift() ?? { data: null, error: null }),
  }
  return {
    supabase: {
      from: () => builder,
      rpc: (name: string, args: unknown) => {
        state.rpcCalls.push([name, args])
        return Promise.resolve(state.rpcResult)
      },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1' } } }) },
    },
  }
})

beforeEach(() => {
  h.state.insertPayloads = []
  h.state.singleQueue = []
  h.state.rpcCalls = []
  h.state.rpcResult = { data: null, error: null }
})

describe('createCourse', () => {
  it('inserts with the caller as educator and a 6-char join code', async () => {
    h.state.singleQueue = [{ data: { id: 'c1', name: 'Bouquets 101' }, error: null }]
    const course = await createCourse('  Bouquets 101  ')
    const payload = h.state.insertPayloads[0] as { educator_id: string; name: string; join_code: string }
    expect(payload.educator_id).toBe('user-1')
    expect(payload.name).toBe('Bouquets 101') // trimmed
    expect(payload.join_code).toMatch(/^[A-Z2-9]{6}$/)
    expect(course.id).toBe('c1')
  })

  it('retries with a new code when the code collides (23505)', async () => {
    h.state.singleQueue = [
      { data: null, error: { code: '23505' } },
      { data: { id: 'c2' }, error: null },
    ]
    const course = await createCourse('Repeat')
    expect(h.state.insertPayloads).toHaveLength(2)
    const a = h.state.insertPayloads[0] as { join_code: string }
    const b = h.state.insertPayloads[1] as { join_code: string }
    expect(a.join_code).not.toBe(b.join_code)
    expect(course.id).toBe('c2')
  })
})

describe('joinCourse', () => {
  it('calls the join_course RPC and maps the result', async () => {
    h.state.rpcResult = { data: [{ out_course_id: 'c9', out_course_name: 'Weddings' }], error: null }
    const out = await joinCourse('abc123')
    const [name, args] = h.state.rpcCalls[0] as [string, { p_code: string; p_allow_self: boolean }]
    expect(name).toBe('join_course')
    expect(args.p_code).toBe('abc123')
    expect(typeof args.p_allow_self).toBe('boolean')
    expect(out).toEqual({ courseId: 'c9', courseName: 'Weddings' })
  })
})

describe('submitAssignment / gradeSubmission', () => {
  it('submits through the submit_assignment RPC', async () => {
    const report = [{ principleId: 'balance', score: 80, tone: 'positive' as const }]
    await submitAssignment({ assignmentId: 'a1', designId: 'd1', autoScore: 77, report })
    expect(h.state.rpcCalls[0]).toEqual([
      'submit_assignment',
      { p_assignment_id: 'a1', p_design_id: 'd1', p_auto_score: 77, p_report: report },
    ])
  })

  it('grades through the grade_submission RPC (simple grade)', async () => {
    await gradeSubmission('s1', 85, 'Lovely balance')
    expect(h.state.rpcCalls[0]).toEqual([
      'grade_submission',
      { p_submission_id: 's1', p_grade: 85, p_feedback: 'Lovely balance', p_rubric_scores: null },
    ])
  })

  it('passes the per-criterion breakdown when grading on a rubric', async () => {
    const scores = [{ criterionId: 'a', points: 8 }]
    await gradeSubmission('s1', 80, 'Good', scores)
    expect(h.state.rpcCalls[0]).toEqual([
      'grade_submission',
      { p_submission_id: 's1', p_grade: 80, p_feedback: 'Good', p_rubric_scores: scores },
    ])
  })
})
