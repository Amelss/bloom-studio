import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppSidebar, MobileTopBar } from '../components/AppSidebar'
import { BRIEFS } from '../education/briefs'
import { computeMastery } from '../education/mastery'
import { listExerciseCompletions, listSkillSamples } from '../lib/progressApi'
import { listCourses, listMyAssignments, listMySubmissions } from '../lib/classroomApi'
import type {
  Assignment,
  Course,
  ExerciseCompletion,
  PrincipleMastery,
  SkillSample,
  SubmissionMeta,
} from '../lib/types'

/** Per-brief roll-up derived from the completion log. */
interface BriefProgress {
  count: number
  latest: string
  best: number | null
}

function masteryTone(score: number): { bar: string; text: string; label: string } {
  if (score >= 85) return { bar: 'bg-bloom-600', text: 'text-bloom-700', label: 'Strong' }
  if (score >= 70) return { bar: 'bg-bloom-500', text: 'text-bloom-600', label: 'Solid' }
  if (score >= 55) return { bar: 'bg-amber-400', text: 'text-amber-600', label: 'Developing' }
  return { bar: 'bg-bloom-clay', text: 'text-bloom-clay', label: 'Needs work' }
}

function TrendIcon({ trend }: { trend: PrincipleMastery['trend'] }) {
  if (trend === 'steady') {
    return (
      <span title="Holding steady" className="text-bloom-ink/35" aria-label="steady">
        —
      </span>
    )
  }
  const up = trend === 'up'
  return (
    <span
      title={up ? 'Improving' : 'Slipping'}
      aria-label={up ? 'improving' : 'slipping'}
      className={up ? 'text-bloom-600' : 'text-bloom-clay'}
    >
      {up ? '▲' : '▼'}
    </span>
  )
}

/**
 * Progress (route `/progress`): graded coursework from classes (separate) and
 * self-directed canvas practice (exercises + principle mastery).
 */
export default function Progress() {
  const [completions, setCompletions] = useState<ExerciseCompletion[] | null>(null)
  const [samples, setSamples] = useState<SkillSample[] | null>(null)
  const [submissions, setSubmissions] = useState<SubmissionMeta[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [c, s] = await Promise.all([listExerciseCompletions(), listSkillSamples()])
        if (active) {
          setCompletions(c)
          setSamples(s)
        }
      } catch (e) {
        if (!active) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(
          /exercise_completions|skill_samples|does not exist|schema cache/i.test(msg)
            ? 'Progress tracking isn’t set up on the database yet. Run migration 0008_progress.sql in Supabase, then reload.'
            : msg,
        )
      }
      // Classroom data is best-effort — a student may not be enrolled, or the
      // classroom migrations may not be applied. Either way, coursework stays empty.
      try {
        const [subs, asgs, crs] = await Promise.all([
          listMySubmissions(),
          listMyAssignments(),
          listCourses(),
        ])
        if (active) {
          setSubmissions(subs)
          setAssignments(asgs)
          setCourses(crs)
        }
      } catch {
        // ignore — the Coursework section simply won't show
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const briefProgress = useMemo(() => {
    const map = new Map<string, BriefProgress>()
    for (const c of completions ?? []) {
      const cur = map.get(c.brief_id)
      const best = c.overall_score
      if (!cur) {
        map.set(c.brief_id, { count: 1, latest: c.completed_at, best })
      } else {
        cur.count += 1
        if (c.completed_at > cur.latest) cur.latest = c.completed_at
        if (best != null && (cur.best == null || best > cur.best)) cur.best = best
      }
    }
    return map
  }, [completions])

  const mastery = useMemo(() => (samples ? computeMastery(samples) : []), [samples])
  const doneCount = briefProgress.size
  const loading = !completions && !samples && !error

  const assignmentById = useMemo(() => new Map(assignments.map((a) => [a.id, a])), [assignments])
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c.name])), [courses])
  const graded = useMemo(
    () => submissions.filter((s) => s.status === 'graded' && s.grade != null),
    [submissions],
  )
  const avgGrade = useMemo(
    () => (graded.length ? Math.round(graded.reduce((a, s) => a + (s.grade ?? 0), 0) / graded.length) : null),
    [graded],
  )
  // Show coursework only for students in the classroom (enrolled or with grades).
  const inClassroom = courses.length > 0 || graded.length > 0

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="progress" />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />

        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:px-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">Progress</h1>
            <p className="mt-1 text-[15px] text-bloom-ink/55">
              Your graded coursework, the exercises you’ve practised, and how your design skills are trending.
            </p>
          </div>

          {error && (
            <p className="mb-6 rounded-xl bg-bloom-600/[0.06] px-4 py-3 text-sm text-bloom-700 ring-1 ring-bloom-600/15">
              {error}
            </p>
          )}

          {loading && <p className="text-sm text-bloom-ink/45">Loading your progress…</p>}

          {!loading && !error && (
            <div className="space-y-10">
              {/* ── Coursework (graded classroom submissions) ── */}
              {inClassroom && (
                <section>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="font-display text-xl font-semibold text-bloom-ink">Coursework</h2>
                      <p className="text-xs text-bloom-ink/50">Graded assignments from your classes.</p>
                    </div>
                    {graded.length > 0 && (
                      <span className="text-sm text-bloom-ink/45">
                        {graded.length} graded{avgGrade != null ? ` · avg ${avgGrade}` : ''}
                      </span>
                    )}
                  </div>

                  {graded.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-8 text-center text-sm text-bloom-ink/50">
                      No graded coursework yet. Submit an assignment in your class and your grades will appear here.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {graded.map((s) => {
                        const a = assignmentById.get(s.assignment_id)
                        const courseName = a ? courseById.get(a.course_id) : null
                        const row = (
                          <>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-bloom-ink">
                                {a?.title ?? 'Assignment'}
                              </p>
                              <p className="truncate text-[11px] text-bloom-ink/50">
                                {courseName ? `${courseName} · ` : ''}
                                graded {s.graded_at ? new Date(s.graded_at).toLocaleDateString() : ''}
                              </p>
                              {s.feedback && (
                                <p className="mt-1 line-clamp-2 text-xs text-bloom-ink/70">{s.feedback}</p>
                              )}
                            </div>
                            <span className="shrink-0 self-start rounded-lg bg-bloom-100 px-2.5 py-1 text-sm font-bold text-bloom-700">
                              {s.grade}/100
                            </span>
                          </>
                        )
                        return (
                          <li key={s.id}>
                            {a ? (
                              <Link
                                to={`/classroom/${a.course_id}/a/${a.id}`}
                                className="flex items-start gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3 transition hover:border-bloom-500/50"
                              >
                                {row}
                              </Link>
                            ) : (
                              <div className="flex items-start gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3">
                                {row}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )}

              {/* ── Canvas practice (self-directed) ── */}
              <div>
                <div className="mb-3">
                  <h2 className="font-display text-xl font-semibold text-bloom-ink">Canvas practice</h2>
                  <p className="text-xs text-bloom-ink/50">Self-directed exercises and how your skills are trending.</p>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                  {/* Exercises */}
                  <section>
                    <div className="mb-3 flex items-baseline justify-between">
                      <h3 className="font-display text-base font-semibold text-bloom-ink">Exercises</h3>
                      <span className="text-sm text-bloom-ink/45">
                        {doneCount} of {BRIEFS.length} complete
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {BRIEFS.map((b) => {
                        const p = briefProgress.get(b.id)
                        return (
                          <li
                            key={b.id}
                            className="flex items-center gap-3 rounded-xl border border-bloom-200 bg-white px-3.5 py-3"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                p ? 'bg-bloom-600 text-white' : 'border border-bloom-ink/20 text-transparent'
                              }`}
                              aria-hidden
                            >
                              ✓
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-bloom-ink">{b.title}</p>
                              <p className="text-[11px] text-bloom-ink/50">
                                {p
                                  ? `Completed ${new Date(p.latest).toLocaleDateString()}${
                                      p.count > 1 ? ` · ${p.count}×` : ''
                                    }`
                                  : `${b.constraints.length} goals · not started`}
                              </p>
                            </div>
                            {p?.best != null && (
                              <span className="shrink-0 rounded-lg bg-bloom-100 px-2 py-1 text-xs font-semibold text-bloom-700">
                                {p.best}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </section>

                  {/* Principle mastery */}
                  <section>
                    <div className="mb-3 flex items-baseline justify-between">
                      <h3 className="font-display text-base font-semibold text-bloom-ink">Principle mastery</h3>
                      <span className="text-sm text-bloom-ink/45">weakest first</span>
                    </div>
                    {mastery.length === 0 ? (
                      <p className="rounded-xl border border-bloom-200 bg-white px-4 py-10 text-center text-sm text-bloom-ink/55">
                        No skill data yet. Finish an exercise or save a version of a design to start tracking your mastery.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {mastery.map((m) => {
                          const tone = masteryTone(m.mastery)
                          return (
                            <li key={m.principleId}>
                              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                                <span className="flex items-center gap-1.5 font-medium text-bloom-ink">
                                  {m.name}
                                  <TrendIcon trend={m.trend} />
                                </span>
                                <span className={`text-xs font-semibold ${tone.text}`}>
                                  {m.mastery} · {tone.label}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-bloom-100">
                                <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${m.mastery}%` }} />
                              </div>
                              <p className="mt-0.5 text-[11px] text-bloom-ink/40">
                                {m.samples} sample{m.samples === 1 ? '' : 's'}
                              </p>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
