import { useEffect, useMemo, useState } from 'react'
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
} from '../lib/classroomApi'
import type { Assignment, Course as CourseT, RosterMember } from '../lib/types'

/** A single course (route `/classroom/:courseId`). Educator and student views. */
export default function Course() {
  const { courseId } = useParams<{ courseId: string }>()
  const myId = useAuth((s) => s.user?.id)
  const [course, setCourse] = useState<CourseT | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [asStudent, setAsStudent] = useState(readDevStudentView())

  const isOwner = !!course && course.educator_id === myId
  const isEducator = isOwner && !asStudent // dev "view as student" flips this

  const load = async () => {
    if (!courseId) return
    setLoading(true)
    try {
      const c = await getCourse(courseId)
      setCourse(c)
      const [a, r] = await Promise.all([
        listAssignments(courseId),
        c && c.educator_id === myId ? listRoster(courseId) : Promise.resolve([]),
      ])
      setAssignments(a)
      setRoster(r)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, myId])

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

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="classroom" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8 lg:px-10">
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
              <div className="mb-6 mt-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">{course.name}</h1>
                  <p className="mt-1 text-sm text-bloom-ink/55">
                    {isEducator ? `${roster.length} student${roster.length === 1 ? '' : 's'}` : 'Enrolled'}
                  </p>
                </div>
                {isEducator && (
                  <button
                    onClick={() => void copyCode()}
                    className="group flex items-center gap-2.5 rounded-xl border border-bloom-200 bg-white px-3 py-2 hover:border-bloom-500/50 hover:bg-bloom-100"
                    title="Copy this code to share with students"
                  >
                    <span className="text-left">
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-bloom-ink/45">
                        Join code
                      </span>
                      <span className="font-mono text-lg font-bold tracking-[0.2em] text-bloom-700">
                        {course.join_code}
                      </span>
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-semibold ${copied ? 'text-bloom-600' : 'text-bloom-ink/50'}`}>
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        {copied ? (
                          <path d="M20 6L9 17l-5-5" />
                        ) : (
                          <>
                            <rect x="9" y="9" width="11" height="11" rx="2" />
                            <path d="M5 15V5a2 2 0 012-2h8" />
                          </>
                        )}
                      </svg>
                      {copied ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                )}
              </div>

              <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
                {/* Assignments */}
                <section>
                  <h2 className="mb-3 font-display text-xl font-semibold text-bloom-ink">Assignments</h2>
                  {isEducator && <NewAssignment courseId={course.id} onCreated={() => void load()} />}
                  {assignments.length === 0 ? (
                    <p className="rounded-xl border border-bloom-200 bg-white px-4 py-6 text-sm text-bloom-ink/50">
                      {isEducator ? 'No assignments yet — set one above.' : 'No assignments yet.'}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {assignments.map((a) => {
                        const brief = BRIEF_INDEX[a.brief_id]
                        return (
                          <li key={a.id}>
                            <Link
                              to={`/classroom/${course.id}/a/${a.id}`}
                              className="block rounded-xl border border-bloom-200 bg-white px-4 py-3 transition hover:border-bloom-500/50"
                            >
                              <p className="text-sm font-semibold text-bloom-ink">{a.title}</p>
                              <p className="mt-0.5 text-xs text-bloom-ink/55">
                                {brief ? `Brief: ${brief.title}` : a.brief_id}
                                {a.due_at ? ` · due ${new Date(a.due_at).toLocaleDateString()}` : ''}
                              </p>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {/* Roster (educator only) */}
                {isEducator && (
                  <section>
                    <h2 className="mb-3 font-display text-xl font-semibold text-bloom-ink">Roster</h2>
                    {roster.length === 0 ? (
                      <p className="rounded-xl border border-bloom-200 bg-white px-4 py-6 text-sm text-bloom-ink/50">
                        No students yet. Share the join code above.
                      </p>
                    ) : (
                      <ul className="divide-y divide-bloom-100 rounded-xl border border-bloom-200 bg-white">
                        {roster.map((m) => (
                          <li key={m.id} className="px-4 py-2.5 text-sm text-bloom-ink">
                            {m.student_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

/** Educator form: set one of the built-in briefs as an assignment. */
function NewAssignment({ courseId, onCreated }: { courseId: string; onCreated: () => void }) {
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
        title: (title.trim() || briefTitle),
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

  return (
    <div className="mb-4 rounded-xl border border-bloom-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold text-bloom-ink/70">Set an assignment</p>
      <div className="flex flex-col gap-2">
        <select
          value={briefId}
          onChange={(e) => setBriefId(e.target.value)}
          className="rounded-lg border border-bloom-200 px-2.5 py-2 text-sm"
          aria-label="Brief"
        >
          {BRIEFS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={briefTitle ? `Title (default: ${briefTitle})` : 'Assignment title'}
          className="rounded-lg border border-bloom-200 px-2.5 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-bloom-ink/55">Due</label>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="rounded-lg border border-bloom-200 px-2.5 py-1.5 text-sm"
          />
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="ml-auto rounded-lg bg-bloom-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-bloom-700 disabled:opacity-50"
          >
            Set assignment
          </button>
        </div>
        {error && <p className="text-xs text-bloom-clay">{error}</p>}
      </div>
    </div>
  )
}
