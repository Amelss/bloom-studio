import type { SubmissionMeta } from './types'

/**
 * Per-device tracking of what a student has already viewed, so "new assignment"
 * and "graded" notifications disappear once opened. Client-side (localStorage),
 * matching the tour's seen-flag approach — a student's notifications are a
 * personal, per-browser signal, not shared state.
 */

const ASSIGN_KEY = 'bloom-seen-assignments-v1'
const GRADE_KEY = 'bloom-seen-grades-v1'

function readSet(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function add(key: string, value: string): void {
  try {
    const set = readSet(key)
    if (set.has(value)) return
    set.add(value)
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // storage disabled — notifications just won't be remembered
  }
}

/* ── new assignments ── */

export function isAssignmentSeen(id: string): boolean {
  return readSet(ASSIGN_KEY).has(id)
}

export function markAssignmentSeen(id: string): void {
  add(ASSIGN_KEY, id)
}

/* ── grades ── */

// Keyed on graded_at so a re-grade re-notifies the student.
function gradeKey(sub: Pick<SubmissionMeta, 'id' | 'graded_at'>): string {
  return `${sub.id}:${sub.graded_at ?? ''}`
}

export function isGradeSeen(sub: Pick<SubmissionMeta, 'id' | 'graded_at'>): boolean {
  return readSet(GRADE_KEY).has(gradeKey(sub))
}

export function markGradeSeen(sub: Pick<SubmissionMeta, 'id' | 'graded_at'>): void {
  add(GRADE_KEY, gradeKey(sub))
}

/** Count a student's unseen notifications from their assignments + submissions. */
export function countStudentNotifications(
  assignmentIds: string[],
  submissions: SubmissionMeta[],
): { newAssignments: number; gradedUnseen: number; total: number } {
  const newAssignments = assignmentIds.filter((id) => !isAssignmentSeen(id)).length
  const gradedUnseen = submissions.filter((s) => s.status === 'graded' && !isGradeSeen(s)).length
  return { newAssignments, gradedUnseen, total: newAssignments + gradedUnseen }
}
