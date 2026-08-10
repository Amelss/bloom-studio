import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ClassroomShell } from '../components/ClassroomShell'
import { DevRoleToggle } from '../components/DevRoleToggle'
import { useCourse } from '../hooks/useCourse'
import { copyText } from '../utils/clipboard'
import { readDevStudentView, writeDevStudentView } from '../lib/dev'
import { isAssignmentSeen, isGradeSeen } from '../lib/classroomSeen'
import { BRIEF_INDEX } from '../education/briefs'
import {
  classroomErrorMessage as errMsg,
  joinCourse,
  listAssignments,
  listRoster,
  listSubmissionsForCourse,
} from '../lib/classroomApi'
import type { Assignment, SubmissionMeta } from '../lib/types'

/** A course (route `/classroom/:courseId`): educator dashboard, or student view. */
export default function Course() {
  const { courseId } = useParams<{ courseId: string }>()
  const { course, isOwner, loading, error } = useCourse(courseId)
  const [asStudent, setAsStudent] = useState(readDevStudentView())

  const isEducator = isOwner && !asStudent

  const toggleAsStudent = (v: boolean) => {
    writeDevStudentView(v)
    setAsStudent(v)
  }

  const enrolSelf = async () => {
    if (!course) return
    try {
      await joinCourse(course.join_code)
      toggleAsStudent(true)
    } catch {
      // surfaced by the dashboard/student data loads
    }
  }

  return (
    <ClassroomShell back={{ to: '/classroom', label: 'Classroom' }}>
      {error && (
        <p className="mt-4 rounded-xl bg-bloom-600/[0.06] px-4 py-3 text-sm text-bloom-700 ring-1 ring-bloom-600/15">
          {error}
        </p>
      )}
      {loading && !course && <p className="mt-6 text-sm text-bloom-ink/45">Loading…</p>}

      {course && (
        <>
          {isOwner && (
            <div className="mt-4">
              <DevRoleToggle asStudent={asStudent} onChange={toggleAsStudent} onEnrol={() => void enrolSelf()} />
            </div>
          )}
          {isEducator ? (
            <EducatorDashboard courseId={course.id} name={course.name} joinCode={course.join_code} />
          ) : (
            <StudentDashboard courseId={course.id} name={course.name} />
          )}
        </>
      )}
    </ClassroomShell>
  )
}

/* ─────────────────────────── educator dashboard ─────────────────────────── */

function EducatorDashboard({ courseId, name, joinCode }: { courseId: string; name: string; joinCode: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [submissions, setSubmissions] = useState<SubmissionMeta[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const a = await listAssignments(courseId)
        const [roster, subs] = await Promise.all([
          listRoster(courseId),
          listSubmissionsForCourse(a.map((x) => x.id)),
        ])
        if (!active) return
        setAssignments(a)
        setStudentCount(roster.length)
        setSubmissions(subs)
      } catch (e) {
        if (active) setErr(errMsg(e))
      }
    })()
    return () => {
      active = false
    }
  }, [courseId])

  const newCount = useMemo(() => submissions.filter((s) => s.status === 'submitted').length, [submissions])
  const titleById = useMemo(() => new Map(assignments.map((a) => [a.id, a.title])), [assignments])

  const copyCode = async () => {
    if (await copyText(joinCode)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <>
      <div className="mb-7 mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-bloom-ink/40">Course dashboard</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">{name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void copyCode()}
            className="flex items-center gap-2 rounded-xl border border-bloom-200 bg-white px-3 py-2 hover:border-bloom-500/50 hover:bg-bloom-100"
            title="Copy this code to share with students"
          >
            <span className="text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-bloom-ink/45">Join code</span>
              <span className="font-mono text-base font-bold tracking-[0.2em] text-bloom-700">{joinCode}</span>
            </span>
            <span className={`text-xs font-semibold ${copied ? 'text-bloom-600' : 'text-bloom-ink/50'}`}>
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
          <Link
            to={`/classroom/${courseId}/new`}
            className="rounded-xl bg-bloom-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-bloom-700"
          >
            + Create assignment
          </Link>
        </div>
      </div>

      {err && <p className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-bloom-clay">{err}</p>}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Submissions" value={submissions.length} sub={newCount ? `${newCount} new` : undefined} />
        <Stat label="Assignments" value={assignments.length} />
        <Stat label="Students" value={studentCount} />
        <Stat label="Awaiting review" value={newCount} highlight={newCount > 0} />
      </div>

      {/* Navigation cards */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <NavCard
          to={`/classroom/${courseId}/assignments`}
          title="Assignments"
          hint={`${assignments.length} created`}
          icon={<path d="M5 4h11a2 2 0 012 2v14l-6-3-6 3V4z" />}
        />
        <NavCard
          to={`/classroom/${courseId}/submissions`}
          title="Submissions"
          hint={newCount ? `${newCount} need review` : `${submissions.length} total`}
          badge={newCount}
          icon={<path d="M4 6h16M4 12h16M4 18h10" />}
        />
        <NavCard
          to={`/classroom/${courseId}/students`}
          title="Enrolled students"
          hint={`${studentCount} enrolled`}
          icon={<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />}
        />
      </div>

      {/* Recent activity */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold text-bloom-ink">Recent submissions</h2>
          {submissions.length > 0 && (
            <Link to={`/classroom/${courseId}/submissions`} className="text-sm font-medium text-bloom-700 hover:underline">
              View all →
            </Link>
          )}
        </div>
        {submissions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-8 text-center text-sm text-bloom-ink/50">
            No submissions yet. Create an assignment and share your join code to get started.
          </p>
        ) : (
          <ul className="divide-y divide-bloom-100 overflow-hidden rounded-xl border border-bloom-200 bg-white">
            {submissions.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link
                  to={`/classroom/${courseId}/a/${s.assignment_id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-bloom-50"
                >
                  <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-bloom-50 ring-1 ring-bloom-200">
                    {s.thumbnail_url ? <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bloom-ink">{s.student_name}</p>
                    <p className="truncate text-xs text-bloom-ink/55">{titleById.get(s.assignment_id) ?? 'Assignment'}</p>
                  </div>
                  <span className={`chip shrink-0 ${s.status === 'graded' ? 'bg-bloom-100 text-bloom-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.status === 'graded' ? 'Graded' : 'New'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function Stat({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-amber-300 bg-amber-50' : 'border-bloom-200 bg-white'}`}>
      <p className={`text-3xl font-bold ${highlight ? 'text-amber-700' : 'text-bloom-ink'}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-bloom-ink/55">{label}</p>
      {sub && <p className={`mt-0.5 text-[11px] font-semibold ${highlight ? 'text-amber-700' : 'text-bloom-600'}`}>{sub}</p>}
    </div>
  )
}

function NavCard({
  to,
  title,
  hint,
  icon,
  badge = 0,
}: {
  to: string
  title: string
  hint: string
  icon: React.ReactNode
  badge?: number
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-bloom-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-bloom-500/50"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bloom-600/[0.1] text-bloom-600 transition group-hover:bg-bloom-600 group-hover:text-white">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-bloom-ink">
          {title}
          {badge > 0 && <span className="chip bg-amber-100 text-amber-700">{badge}</span>}
        </span>
        <span className="block text-xs text-bloom-ink/50">{hint}</span>
      </span>
      <span className="text-bloom-ink/30" aria-hidden>→</span>
    </Link>
  )
}

function NotifyBanner({
  to,
  icon,
  text,
  cta,
}: {
  to: string
  icon: React.ReactNode
  text: string
  cta: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 transition hover:bg-amber-100"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/25 text-amber-700">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-amber-800">{text}</span>
      <span className="shrink-0 text-xs font-semibold text-amber-800">{cta} →</span>
    </Link>
  )
}

/* ────────────────────────────── student dashboard ─────────────────────────── */

function StudentDashboard({ courseId, name }: { courseId: string; name: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [mySubs, setMySubs] = useState<SubmissionMeta[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const a = await listAssignments(courseId)
        // RLS scopes submissions to the student's own, so this is "my work".
        const subs = await listSubmissionsForCourse(a.map((x) => x.id))
        if (!active) return
        setAssignments(a)
        setMySubs(subs)
        setLoaded(true)
      } catch (e) {
        if (active) setErr(errMsg(e))
      }
    })()
    return () => {
      active = false
    }
  }, [courseId])

  const submittedIds = useMemo(() => new Set(mySubs.map((s) => s.assignment_id)), [mySubs])
  const toDo = useMemo(() => assignments.filter((a) => !submittedIds.has(a.id)), [assignments, submittedIds])
  const gradedCount = useMemo(() => mySubs.filter((s) => s.status === 'graded').length, [mySubs])
  // Unseen notifications (cleared once the student opens the assignment).
  const newCount = useMemo(() => assignments.filter((a) => !isAssignmentSeen(a.id)).length, [assignments])
  const gradedUnseen = useMemo(
    () => mySubs.filter((s) => s.status === 'graded' && !isGradeSeen(s)).length,
    [mySubs],
  )

  return (
    <>
      <div className="mb-7 mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-bloom-ink/40">Your dashboard</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">{name}</h1>
      </div>

      {err && <p className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-bloom-clay">{err}</p>}

      {/* Notifications: new assignments and newly graded results */}
      {(newCount > 0 || gradedUnseen > 0) && (
        <div className="mb-6 space-y-2">
          {newCount > 0 && (
            <NotifyBanner
              to={`/classroom/${courseId}/assignments`}
              icon={<path d="M5 4h11a2 2 0 012 2v14l-6-3-6 3V4z" />}
              text={`${newCount} new assignment${newCount === 1 ? '' : 's'}`}
              cta="View"
            />
          )}
          {gradedUnseen > 0 && (
            <NotifyBanner
              to={`/classroom/${courseId}/submissions`}
              icon={<path d="M20 6L9 17l-5-5" />}
              text={`${gradedUnseen} result${gradedUnseen === 1 ? '' : 's'} graded — see your feedback`}
              cta="See feedback"
            />
          )}
        </div>
      )}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Assignments" value={assignments.length} />
        <Stat label="Submitted" value={mySubs.length} />
        <Stat label="To do" value={toDo.length} sub={toDo.length ? 'outstanding' : undefined} highlight={toDo.length > 0} />
        <Stat label="Graded" value={gradedCount} />
      </div>

      {/* Navigation cards */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <NavCard
          to={`/classroom/${courseId}/assignments`}
          title="Assignments"
          hint={toDo.length ? `${toDo.length} to do` : 'All submitted'}
          badge={toDo.length}
          icon={<path d="M5 4h11a2 2 0 012 2v14l-6-3-6 3V4z" />}
        />
        <NavCard
          to={`/classroom/${courseId}/submissions`}
          title="My submissions"
          hint={mySubs.length ? `${mySubs.length} submitted · ${gradedCount} graded` : 'Nothing submitted yet'}
          icon={<path d="M4 6h16M4 12h16M4 18h10" />}
        />
      </div>

      {/* To do */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-bloom-ink">To do</h2>
        {!loaded ? (
          <p className="text-sm text-bloom-ink/45">Loading…</p>
        ) : toDo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-8 text-center text-sm text-bloom-ink/50">
            {assignments.length === 0 ? 'No assignments yet.' : 'You’re all caught up — everything’s submitted. 🎉'}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {toDo.map((a) => {
              const brief = a.brief_id ? BRIEF_INDEX[a.brief_id] : null
              return (
                <li key={a.id}>
                  <Link
                    to={`/classroom/${courseId}/a/${a.id}`}
                    className="flex items-center gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3 transition hover:border-bloom-500/50 hover:shadow-soft"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-bloom-ink">{a.title}</p>
                      <p className="mt-0.5 text-xs text-bloom-ink/55">
                        {brief ? brief.title : 'Custom brief'}
                        {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-bloom-600 px-3 py-1.5 text-xs font-semibold text-white">Submit</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
