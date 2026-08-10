import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ClassroomShell } from '../components/ClassroomShell'
import { useCourse } from '../hooks/useCourse'
import { BRIEF_INDEX } from '../education/briefs'
import { markAssignmentSeen } from '../lib/classroomSeen'
import {
  classroomErrorMessage as errMsg,
  listAssignments,
  listSubmissionsForCourse,
} from '../lib/classroomApi'
import type { Assignment, SubmissionMeta } from '../lib/types'

/** All assignments in a course (route `/classroom/:courseId/assignments`). */
export default function CourseAssignments() {
  const { courseId } = useParams<{ courseId: string }>()
  const { course, isOwner } = useCourse(courseId)
  const [assignments, setAssignments] = useState<Assignment[] | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionMeta[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    let active = true
    ;(async () => {
      try {
        const a = await listAssignments(courseId)
        if (!active) return
        setAssignments(a)
        // Educators get every submission; RLS scopes a student to their own.
        setSubmissions(await listSubmissionsForCourse(a.map((x) => x.id)))
      } catch (e) {
        if (active) setError(errMsg(e))
      }
    })()
    return () => {
      active = false
    }
  }, [courseId])

  // Educator: totals per assignment. Student: their own submission per assignment.
  const countsByAssignment = useMemo(() => {
    const m = new Map<string, { total: number; nw: number }>()
    for (const s of submissions) {
      const c = m.get(s.assignment_id) ?? { total: 0, nw: 0 }
      c.total += 1
      if (s.status === 'submitted') c.nw += 1
      m.set(s.assignment_id, c)
    }
    return m
  }, [submissions])

  const mineByAssignment = useMemo(() => {
    const m = new Map<string, SubmissionMeta>()
    for (const s of submissions) m.set(s.assignment_id, s)
    return m
  }, [submissions])

  // A student viewing the list has "seen" these assignments — clears their
  // new-assignment notifications.
  useEffect(() => {
    if (course && !isOwner && assignments) assignments.forEach((a) => markAssignmentSeen(a.id))
  }, [course, isOwner, assignments])

  const back = { to: `/classroom/${courseId}`, label: course?.name ?? 'Course' }

  return (
    <ClassroomShell back={back}>
      <div className="mb-6 mt-3 flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">Assignments</h1>
        {isOwner && (
          <Link
            to={`/classroom/${courseId}/new`}
            className="rounded-xl bg-bloom-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-bloom-700"
          >
            + Create assignment
          </Link>
        )}
      </div>

      {error && <p className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-bloom-clay">{error}</p>}

      {!assignments ? (
        <p className="text-sm text-bloom-ink/45">Loading…</p>
      ) : assignments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-10 text-center text-sm text-bloom-ink/50">
          No assignments yet.{isOwner ? ' Create one to get started.' : ''}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {assignments.map((a) => {
            const brief = a.brief_id ? BRIEF_INDEX[a.brief_id] : null
            const counts = countsByAssignment.get(a.id)
            const mine = mineByAssignment.get(a.id)
            return (
              <li key={a.id}>
                <Link
                  to={`/classroom/${courseId}/a/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3.5 transition hover:border-bloom-500/50 hover:shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bloom-ink">{a.title}</p>
                    <p className="mt-0.5 text-xs text-bloom-ink/55">
                      {brief ? brief.title : 'Custom brief'}
                      {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>

                  {isOwner ? (
                    <div className="flex shrink-0 items-center gap-2">
                      {counts && counts.nw > 0 && <span className="chip bg-amber-100 text-amber-700">{counts.nw} new</span>}
                      <span className="text-xs text-bloom-ink/50">
                        {counts?.total ?? 0} submission{(counts?.total ?? 0) === 1 ? '' : 's'}
                      </span>
                    </div>
                  ) : (
                    <StudentStatusChip mine={mine} />
                  )}
                  <span className="shrink-0 text-bloom-ink/30" aria-hidden>→</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </ClassroomShell>
  )
}

/** The student's own status for an assignment. */
function StudentStatusChip({ mine }: { mine: SubmissionMeta | undefined }) {
  if (!mine) return <span className="chip shrink-0 bg-bloom-ink/[0.06] text-bloom-ink/55">Not started</span>
  if (mine.status === 'graded') {
    return <span className="chip shrink-0 bg-bloom-100 text-bloom-700">Graded{mine.grade != null ? ` ${mine.grade}` : ''}</span>
  }
  return <span className="chip shrink-0 bg-amber-100 text-amber-700">Submitted</span>
}
