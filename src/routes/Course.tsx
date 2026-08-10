import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppSidebar, MobileTopBar } from '../components/AppSidebar'
import { useAuth } from '../domain/auth'
import { copyText } from '../utils/clipboard'
import { readDevStudentView, writeDevStudentView } from '../lib/dev'
import { DevRoleToggle } from '../components/DevRoleToggle'
import { BRIEFS, BRIEF_INDEX } from '../education/briefs'
import {
  classroomErrorMessage as errMsg,
  createAssignment,
  getCourse,
  joinCourse,
  listAssignments,
  listRoster,
  listSubmissionsForCourse,
} from '../lib/classroomApi'
import type { Assignment, Course as CourseT, RosterMember, SubmissionMeta } from '../lib/types'

/** A single course (route `/classroom/:courseId`). Educator and student views. */
export default function Course() {
  const { courseId } = useParams<{ courseId: string }>()
  const myId = useAuth((s) => s.user?.id)
  const [course, setCourse] = useState<CourseT | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [submissions, setSubmissions] = useState<SubmissionMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [asStudent, setAsStudent] = useState(readDevStudentView())
  const submissionsRef = useRef<HTMLDivElement>(null)

  const isOwner = !!course && course.educator_id === myId
  const isEducator = isOwner && !asStudent // dev "view as student" flips this

  const load = async () => {
    if (!courseId) return
    setLoading(true)
    try {
      const c = await getCourse(courseId)
      setCourse(c)
      const educatorView = !!c && c.educator_id === myId && !asStudent
      const a = await listAssignments(courseId)
      setAssignments(a)
      if (educatorView) {
        const [r, subs] = await Promise.all([
          listRoster(courseId),
          listSubmissionsForCourse(a.map((x) => x.id)),
        ])
        setRoster(r)
        setSubmissions(subs)
      } else {
        setRoster([])
        setSubmissions([])
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, myId, asStudent])

  const copyCode = async () => {
    if (!course) return
    const ok = await copyText(course.join_code)
    setCopied(ok)
    if (ok) setTimeout(() => setCopied(false), 1500)
  }

  const toggleAsStudent = (v: boolean) => {
    writeDevStudentView(v)
    setAsStudent(v)
  }

  // Dev-only: enrol yourself in your own course so you can submit to it.
  const enrolSelf = async () => {
    if (!course) return
    try {
      await joinCourse(course.join_code)
      toggleAsStudent(true)
      await load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  // Group submissions by assignment, and count the ungraded ("new") ones.
  const subsByAssignment = useMemo(() => {
    const m = new Map<string, SubmissionMeta[]>()
    for (const s of submissions) {
      const list = m.get(s.assignment_id)
      if (list) list.push(s)
      else m.set(s.assignment_id, [s])
    }
    return m
  }, [submissions])

  const newSubmissions = useMemo(() => submissions.filter((s) => s.status === 'submitted'), [submissions])
  const assignmentTitle = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of assignments) m.set(a.id, a.title)
    return m
  }, [assignments])

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="classroom" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:px-10">
          <Link to="/classroom" className="text-sm font-medium text-bloom-700 hover:underline">
            ← Classroom
          </Link>

          {error && (
            <p className="mt-4 rounded-xl bg-bloom-600/[0.06] px-4 py-3 text-sm text-bloom-700 ring-1 ring-bloom-600/15">
              {error}
            </p>
          )}
          {loading && !error && <p className="mt-6 text-sm text-bloom-ink/45">Loading…</p>}

          {course && (
            <>
              {isOwner && (
                <div className="mt-4">
                  <DevRoleToggle asStudent={asStudent} onChange={toggleAsStudent} onEnrol={() => void enrolSelf()} />
                </div>
              )}

              {/* Course header */}
              <div className="mb-7 mt-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-bloom-ink/40">Course</p>
                  <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">{course.name}</h1>
                  <p className="mt-1 text-sm text-bloom-ink/55">
                    {isEducator
                      ? `${roster.length} student${roster.length === 1 ? '' : 's'} · ${assignments.length} assignment${assignments.length === 1 ? '' : 's'}`
                      : 'You’re enrolled in this course'}
                  </p>
                </div>
                {isEducator && (
                  <button
                    onClick={() => void copyCode()}
                    className="group flex items-center gap-2.5 rounded-xl border border-bloom-200 bg-white px-3 py-2 hover:border-bloom-500/50 hover:bg-bloom-100"
                    title="Copy this code to share with students"
                  >
                    <span className="text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-bloom-ink/45">Join code</span>
                      <span className="font-mono text-lg font-bold tracking-[0.2em] text-bloom-700">{course.join_code}</span>
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-semibold ${copied ? 'text-bloom-600' : 'text-bloom-ink/50'}`}>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        {copied ? <path d="M20 6L9 17l-5-5" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></>}
                      </svg>
                      {copied ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                )}
              </div>

              {isEducator ? (
                <>
                  {/* Notification: new submissions awaiting review */}
                  {newSubmissions.length > 0 && (
                    <button
                      onClick={() => submissionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="mb-6 flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/25 text-amber-700">
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-amber-800">
                          {newSubmissions.length} new submission{newSubmissions.length === 1 ? '' : 's'} to review
                        </span>
                        <span className="block truncate text-xs text-amber-700/80">
                          {[...new Set(newSubmissions.map((s) => assignmentTitle.get(s.assignment_id) ?? 'Assignment'))].join(' · ')}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-amber-800">Review →</span>
                    </button>
                  )}

                  <div className="grid gap-8 lg:grid-cols-[1fr_16rem]">
                    <div className="min-w-0 space-y-10">
                      {/* 1 — Create */}
                      <CreateAssignmentSection courseId={course.id} onCreated={() => void load()} />

                      {/* 2 — Existing assignments */}
                      <AssignmentsSection
                        courseId={course.id}
                        assignments={assignments}
                        subsByAssignment={subsByAssignment}
                      />

                      {/* 3 — Submissions */}
                      <div ref={submissionsRef} className="scroll-mt-6">
                        <SubmissionsSection
                          courseId={course.id}
                          submissions={submissions}
                          assignmentTitle={assignmentTitle}
                          newCount={newSubmissions.length}
                        />
                      </div>
                    </div>

                    {/* Roster */}
                    <aside>
                      <RosterSection roster={roster} />
                    </aside>
                  </div>
                </>
              ) : (
                <StudentAssignments courseId={course.id} assignments={assignments} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

/* ─────────────────────────── 1. Create assignment ─────────────────────────── */

function SectionHeader({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bloom-600/12 text-xs font-bold text-bloom-700">
        {step}
      </span>
      <h2 className="font-display text-xl font-semibold text-bloom-ink">{title}</h2>
      {hint && <span className="text-sm text-bloom-ink/45">{hint}</span>}
    </div>
  )
}

function CreateAssignmentSection({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
  return (
    <section>
      <SectionHeader step={1} title="Create an assignment" />
      <div className="rounded-2xl border border-bloom-500/30 bg-bloom-600/[0.04] p-4">
        <p className="mb-3 text-sm text-bloom-ink/70">
          Choose a brief for students to work to. Their submissions are auto-scored against it.
        </p>
        <NewAssignmentForm courseId={courseId} onCreated={onCreated} />
      </div>
    </section>
  )
}

/** Educator form: set one of the built-in briefs as an assignment. */
function NewAssignmentForm({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
  const [briefId, setBriefId] = useState(BRIEFS[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const briefTitle = useMemo(() => BRIEF_INDEX[briefId]?.title ?? '', [briefId])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await createAssignment({
        courseId,
        briefId,
        title: title.trim() || briefTitle,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      })
      setTitle('')
      setDueAt('')
      onCreated()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const fieldCls = 'w-full rounded-lg border border-bloom-200 bg-white px-2.5 py-2 text-sm focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20'

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Brief</span>
        <select value={briefId} onChange={(e) => setBriefId(e.target.value)} className={fieldCls} aria-label="Brief">
          {BRIEFS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Due date (optional)</span>
        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={fieldCls} />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-xs font-semibold text-bloom-ink/60">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={briefTitle ? `Defaults to “${briefTitle}”` : 'Assignment title'}
          className={fieldCls}
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-bloom-700 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create assignment'}
        </button>
        {error && <p className="text-xs text-bloom-clay">{error}</p>}
      </div>
    </div>
  )
}

/* ─────────────────────────── 2. Existing assignments ──────────────────────── */

function AssignmentsSection({
  courseId,
  assignments,
  subsByAssignment,
}: {
  courseId: string
  assignments: Assignment[]
  subsByAssignment: Map<string, SubmissionMeta[]>
}) {
  return (
    <section>
      <SectionHeader step={2} title="Assignments" hint={assignments.length ? `${assignments.length} total` : undefined} />
      {assignments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-8 text-center text-sm text-bloom-ink/50">
          No assignments yet. Create one above to get started.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {assignments.map((a) => {
            const brief = BRIEF_INDEX[a.brief_id]
            const subs = subsByAssignment.get(a.id) ?? []
            const newCount = subs.filter((s) => s.status === 'submitted').length
            return (
              <li key={a.id}>
                <Link
                  to={`/classroom/${courseId}/a/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3 transition hover:border-bloom-500/50 hover:shadow-soft"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bloom-ink">{a.title}</p>
                    <p className="mt-0.5 text-xs text-bloom-ink/55">
                      {brief ? brief.title : a.brief_id}
                      {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {newCount > 0 && (
                      <span className="chip bg-amber-100 text-amber-700">{newCount} new</span>
                    )}
                    <span className="text-xs text-bloom-ink/50">
                      {subs.length} submission{subs.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-bloom-ink/30" aria-hidden>→</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ────────────────────────────── 3. Submissions ────────────────────────────── */

function SubmissionsSection({
  courseId,
  submissions,
  assignmentTitle,
  newCount,
}: {
  courseId: string
  submissions: SubmissionMeta[]
  assignmentTitle: Map<string, string>
  newCount: number
}) {
  return (
    <section>
      <SectionHeader
        step={3}
        title="Submissions"
        hint={submissions.length ? `${submissions.length} total${newCount ? ` · ${newCount} new` : ''}` : undefined}
      />
      {submissions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-8 text-center text-sm text-bloom-ink/50">
          No submissions yet. They’ll appear here as students hand in their work.
        </p>
      ) : (
        <ul className="divide-y divide-bloom-100 overflow-hidden rounded-xl border border-bloom-200 bg-white">
          {submissions.map((s) => {
            const graded = s.status === 'graded'
            return (
              <li key={s.id}>
                <Link
                  to={`/classroom/${courseId}/a/${s.assignment_id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-bloom-50"
                >
                  <span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-bloom-50 ring-1 ring-bloom-200">
                    {s.thumbnail_url ? <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-bloom-ink">{s.student_name}</p>
                    <p className="truncate text-xs text-bloom-ink/55">
                      {assignmentTitle.get(s.assignment_id) ?? 'Assignment'} · {new Date(s.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  {s.auto_score != null && (
                    <span className="shrink-0 text-xs text-bloom-ink/50" title="Auto-score">
                      auto {s.auto_score}
                    </span>
                  )}
                  <span
                    className={`chip shrink-0 ${graded ? 'bg-bloom-100 text-bloom-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {graded ? `Graded ${s.grade ?? ''}` : 'New'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ───────────────────────────────── Roster ─────────────────────────────────── */

function RosterSection({ roster }: { roster: RosterMember[] }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-base font-semibold text-bloom-ink">
        Roster <span className="text-sm font-normal text-bloom-ink/45">({roster.length})</span>
      </h2>
      {roster.length === 0 ? (
        <p className="rounded-xl border border-bloom-200 bg-white px-4 py-5 text-xs text-bloom-ink/50">
          No students yet. Share the join code.
        </p>
      ) : (
        <ul className="divide-y divide-bloom-100 rounded-xl border border-bloom-200 bg-white">
          {roster.map((m) => (
            <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm text-bloom-ink">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bloom-600/12 text-[11px] font-semibold text-bloom-700">
                {(m.student_name.trim()[0] ?? '?').toUpperCase()}
              </span>
              <span className="truncate">{m.student_name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ─────────────────────────────── Student view ─────────────────────────────── */

function StudentAssignments({ courseId, assignments }: { courseId: string; assignments: Assignment[] }) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-bloom-ink">Assignments</h2>
      {assignments.length === 0 ? (
        <p className="rounded-xl border border-bloom-200 bg-white px-4 py-6 text-sm text-bloom-ink/50">
          No assignments yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {assignments.map((a) => {
            const brief = BRIEF_INDEX[a.brief_id]
            return (
              <li key={a.id}>
                <Link
                  to={`/classroom/${courseId}/a/${a.id}`}
                  className="block rounded-xl border border-bloom-200 bg-white px-4 py-3 transition hover:border-bloom-500/50"
                >
                  <p className="text-sm font-semibold text-bloom-ink">{a.title}</p>
                  <p className="mt-0.5 text-xs text-bloom-ink/55">
                    {brief ? brief.title : a.brief_id}
                    {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ''}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
