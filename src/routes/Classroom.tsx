import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppSidebar, MobileTopBar } from '../components/AppSidebar'
import { useAuth } from '../domain/auth'
import { copyText } from '../utils/clipboard'
import { classroomErrorMessage as friendlyError, createCourse, joinCourse, listCourses } from '../lib/classroomApi'
import type { Course } from '../lib/types'

/** Classroom hub (route `/classroom`): courses you teach and courses you've joined. */
export default function Classroom() {
  const navigate = useNavigate()
  const myId = useAuth((s) => s.user?.id)
  const role = useAuth((s) => s.profile?.role)
  const isEducator = role === 'educator' || role === 'admin'
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = () => {
    listCourses()
      .then(setCourses)
      .catch((e) => setError(friendlyError(e)))
  }
  useEffect(load, [])

  const teaching = useMemo(() => (courses ?? []).filter((c) => c.educator_id === myId), [courses, myId])
  const enrolled = useMemo(() => (courses ?? []).filter((c) => c.educator_id !== myId), [courses, myId])

  const onCreate = async () => {
    if (!newName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const course = await createCourse(newName)
      setNewName('')
      navigate(`/classroom/${course.id}`)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const onJoin = async () => {
    if (!joinCode.trim()) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const { courseId, courseName } = await joinCourse(joinCode)
      setJoinCode('')
      setNotice(`Joined “${courseName}”.`)
      navigate(`/classroom/${courseId}`)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="classroom" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:px-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">Classroom</h1>
            <p className="mt-1 text-[15px] text-bloom-ink/55">
              Run a course, set briefs as assignments, and review your students’ work.
            </p>
          </div>

          {error && (
            <p className="mb-6 rounded-xl bg-bloom-600/[0.06] px-4 py-3 text-sm text-bloom-700 ring-1 ring-bloom-600/15">
              {error}
            </p>
          )}
          {notice && (
            <p className="mb-6 rounded-xl bg-bloom-100 px-4 py-3 text-sm text-bloom-700">{notice}</p>
          )}

          {/* Actions — educators start courses; students join them. */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {isEducator && (
              <div className="rounded-2xl border border-bloom-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-bloom-ink">Start a course</h2>
                <p className="mt-0.5 text-xs text-bloom-ink/55">You’ll get a join code to share with students.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void onCreate()}
                    placeholder="Course name"
                    className="min-w-0 flex-1 rounded-lg border border-bloom-200 px-3 py-2 text-sm focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20"
                  />
                  <button
                    onClick={() => void onCreate()}
                    disabled={busy || !newName.trim()}
                    className="shrink-0 rounded-lg bg-bloom-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-bloom-700 disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {!isEducator && (
              <div className="rounded-2xl border border-bloom-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-bloom-ink">Join a course</h2>
                <p className="mt-0.5 text-xs text-bloom-ink/55">Enter the code your educator gave you.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && void onJoin()}
                    placeholder="Join code"
                    className="min-w-0 flex-1 rounded-lg border border-bloom-200 px-3 py-2 text-sm uppercase tracking-widest focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20"
                  />
                  <button
                    onClick={() => void onJoin()}
                    disabled={busy || !joinCode.trim()}
                    className="shrink-0 rounded-lg border border-bloom-300 px-3.5 py-2 text-sm font-semibold text-bloom-700 hover:bg-bloom-100 disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}
          </div>

          {courses === null && !error && <p className="text-sm text-bloom-ink/45">Loading…</p>}

          {courses && (
            <div className="space-y-8">
              {isEducator ? (
                <CourseGroup title="Teaching" empty="You’re not teaching any courses yet." courses={teaching} showCode />
              ) : (
                <CourseGroup title="Enrolled" empty="You haven’t joined any courses yet." courses={enrolled} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function CourseGroup({
  title,
  empty,
  courses,
  showCode = false,
}: {
  title: string
  empty: string
  courses: Course[]
  showCode?: boolean
}) {
  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-bloom-ink">{title}</h2>
      {courses.length === 0 ? (
        <p className="rounded-xl border border-bloom-200 bg-white px-4 py-6 text-sm text-bloom-ink/50">{empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <li key={c.id} className="rounded-2xl border border-bloom-200 bg-white transition hover:-translate-y-0.5 hover:border-bloom-500/50">
              <Link to={`/classroom/${c.id}`} className="block px-4 pt-4">
                <p className="font-display text-base font-semibold text-bloom-ink">{c.name}</p>
              </Link>
              {showCode ? (
                <CodeChip code={c.join_code} />
              ) : (
                <div className="px-4 pb-4 pt-1" />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The join code with a one-click copy — used on an educator's course cards. */
function CodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        if (await copyText(code)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
      className="mt-1 flex w-full items-center gap-2 px-4 pb-4 text-left"
      title="Copy join code"
    >
      <span className="text-[11px] text-bloom-ink/45">Code</span>
      <span className="font-mono text-sm font-bold tracking-widest text-bloom-700">{code}</span>
      <span className={`ml-auto flex items-center gap-1 text-[11px] font-semibold ${copied ? 'text-bloom-600' : 'text-bloom-ink/45'}`}>
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {copied ? <path d="M20 6L9 17l-5-5" /> : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></>}
        </svg>
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  )
}
