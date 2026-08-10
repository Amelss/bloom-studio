import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClassroomShell } from '../components/ClassroomShell'
import { useCourse } from '../hooks/useCourse'
import { copyText } from '../utils/clipboard'
import { classroomErrorMessage as errMsg, listRoster } from '../lib/classroomApi'
import type { RosterMember } from '../lib/types'

/** Enrolled students (route `/classroom/:courseId/students`). Educator view. */
export default function CourseStudents() {
  const { courseId } = useParams<{ courseId: string }>()
  const { course } = useCourse(courseId)
  const [roster, setRoster] = useState<RosterMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!courseId) return
    let active = true
    listRoster(courseId)
      .then((r) => active && setRoster(r))
      .catch((e) => active && setError(errMsg(e)))
    return () => {
      active = false
    }
  }, [courseId])

  const back = { to: `/classroom/${courseId}`, label: course?.name ?? 'Course' }

  return (
    <ClassroomShell back={back}>
      <div className="mb-6 mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">
          Enrolled students {roster && <span className="text-lg font-normal text-bloom-ink/45">({roster.length})</span>}
        </h1>
        {course && (
          <button
            onClick={async () => {
              if (await copyText(course.join_code)) {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }
            }}
            className="flex items-center gap-2 rounded-xl border border-bloom-200 bg-white px-3 py-2 text-sm hover:bg-bloom-100"
          >
            Join code{' '}
            <span className="font-mono font-bold tracking-widest text-bloom-700">{course.join_code}</span>
            <span className={`text-xs font-semibold ${copied ? 'text-bloom-600' : 'text-bloom-ink/45'}`}>
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
        )}
      </div>

      {error && <p className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-bloom-clay">{error}</p>}

      {!roster ? (
        <p className="text-sm text-bloom-ink/45">Loading…</p>
      ) : roster.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-10 text-center text-sm text-bloom-ink/50">
          No students yet. Share the join code above to invite them.
        </p>
      ) : (
        <ul className="divide-y divide-bloom-100 overflow-hidden rounded-xl border border-bloom-200 bg-white">
          {roster.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bloom-600/12 text-xs font-semibold text-bloom-700">
                {(m.student_name.trim()[0] ?? '?').toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-bloom-ink">{m.student_name}</span>
              <span className="shrink-0 text-xs text-bloom-ink/45">
                joined {new Date(m.joined_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ClassroomShell>
  )
}
