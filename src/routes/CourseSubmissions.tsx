import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ClassroomShell } from '../components/ClassroomShell'
import { useCourse } from '../hooks/useCourse'
import { markGradeSeen } from '../lib/classroomSeen'
import {
  classroomErrorMessage as errMsg,
  listAssignments,
  listSubmissionsForCourse,
} from '../lib/classroomApi'
import type { SubmissionMeta } from '../lib/types'

type Filter = 'all' | 'new' | 'graded'

/** All submissions across a course (route `/classroom/:courseId/submissions`). */
export default function CourseSubmissions() {
  const { courseId } = useParams<{ courseId: string }>()
  const { course, isOwner } = useCourse(courseId)
  const [submissions, setSubmissions] = useState<SubmissionMeta[] | null>(null)
  const [titleById, setTitleById] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    if (!courseId) return
    let active = true
    ;(async () => {
      try {
        const a = await listAssignments(courseId)
        const subs = await listSubmissionsForCourse(a.map((x) => x.id))
        if (!active) return
        setTitleById(new Map(a.map((x) => [x.id, x.title])))
        setSubmissions(subs)
      } catch (e) {
        if (active) setError(errMsg(e))
      }
    })()
    return () => {
      active = false
    }
  }, [courseId])

  // A student viewing their submissions has "seen" their grades.
  useEffect(() => {
    if (course && !isOwner && submissions) {
      submissions.filter((s) => s.status === 'graded').forEach(markGradeSeen)
    }
  }, [course, isOwner, submissions])

  const filtered = useMemo(() => {
    if (!submissions) return null
    if (filter === 'new') return submissions.filter((s) => s.status === 'submitted')
    if (filter === 'graded') return submissions.filter((s) => s.status === 'graded')
    return submissions
  }, [submissions, filter])

  const newCount = submissions?.filter((s) => s.status === 'submitted').length ?? 0
  const back = { to: `/classroom/${courseId}`, label: course?.name ?? 'Course' }

  return (
    <ClassroomShell back={back}>
      <h1 className="mb-4 mt-3 font-display text-3xl font-semibold tracking-tight text-bloom-ink">
        {isOwner ? 'Submissions' : 'My submissions'}
      </h1>

      {error && <p className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-bloom-clay">{error}</p>}

      <div className="mb-4 flex gap-1.5">
        {(['all', 'new', 'graded'] as Filter[]).map((f) => {
          const label = f === 'new' ? (isOwner ? 'New' : 'Awaiting') : f
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-bloom-600 text-white' : 'text-bloom-ink/60 hover:bg-bloom-100'
              }`}
            >
              {label}
              {f === 'new' && newCount > 0 ? ` (${newCount})` : ''}
            </button>
          )
        })}
      </div>

      {!filtered ? (
        <p className="text-sm text-bloom-ink/45">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-10 text-center text-sm text-bloom-ink/50">
          {filter === 'all' ? 'No submissions yet.' : `No ${filter} submissions.`}
        </p>
      ) : (
        <ul className="divide-y divide-bloom-100 overflow-hidden rounded-xl border border-bloom-200 bg-white">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                to={`/classroom/${courseId}/a/${s.assignment_id}`}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-bloom-50"
              >
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-bloom-50 ring-1 ring-bloom-200">
                  {s.thumbnail_url ? <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-bloom-ink">
                    {isOwner ? s.student_name : (titleById.get(s.assignment_id) ?? 'Assignment')}
                  </p>
                  <p className="truncate text-xs text-bloom-ink/55">
                    {isOwner ? `${titleById.get(s.assignment_id) ?? 'Assignment'} · ` : ''}
                    {new Date(s.submitted_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`chip shrink-0 ${s.status === 'graded' ? 'bg-bloom-100 text-bloom-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.status === 'graded' ? `Graded ${s.grade ?? ''}` : isOwner ? 'New' : 'Awaiting grade'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ClassroomShell>
  )
}
