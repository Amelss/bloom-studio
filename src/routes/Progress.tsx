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
  if (trend === 'steady') return <span title="Holding steady" className="text-bloom-ink/35">—</span>
  const up = trend === 'up'
  return (
    <span title={up ? 'Improving' : 'Slipping'} className={up ? 'text-bloom-600' : 'text-bloom-clay'}>
      {up ? '▲' : '▼'}
    </span>
  )
}

/** A tiny inline sparkline of values (0–100) over time. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const W = 300
  const H = 72
  const pad = 8
  const stepX = (W - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - pad * 2)
    return [x, y] as const
  })
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full text-bloom-600" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={4} fill="currentColor" />
    </svg>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-bloom-500/30 bg-bloom-600/[0.05]' : 'border-bloom-200 bg-white'}`}>
      <p className={`font-bold ${accent ? 'text-4xl text-bloom-700' : 'text-3xl text-bloom-ink'}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-bloom-ink/55">{label}</p>
      {sub && <p className={`mt-0.5 text-[11px] font-semibold ${accent ? 'text-bloom-600' : 'text-bloom-ink/45'}`}>{sub}</p>}
    </div>
  )
}

/** Progress (route `/progress`): a dashboard of how the student is improving. */
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
      try {
        const [subs, asgs, crs] = await Promise.all([listMySubmissions(), listMyAssignments(), listCourses()])
        if (active) {
          setSubmissions(subs)
          setAssignments(asgs)
          setCourses(crs)
        }
      } catch {
        // best-effort — coursework simply won't show
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
      if (!cur) map.set(c.brief_id, { count: 1, latest: c.completed_at, best })
      else {
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

  // Graded coursework, oldest → newest, for the trend.
  const gradedChrono = useMemo(
    () =>
      submissions
        .filter((s) => s.status === 'graded' && s.grade != null)
        .sort((a, b) => (a.graded_at ?? '').localeCompare(b.graded_at ?? '')),
    [submissions],
  )
  const gradeSeries = useMemo(() => gradedChrono.map((s) => s.grade as number), [gradedChrono])
  const avgGrade = gradeSeries.length ? Math.round(gradeSeries.reduce((a, b) => a + b, 0) / gradeSeries.length) : null
  const bestGrade = gradeSeries.length ? Math.max(...gradeSeries) : null
  const gradeDelta = gradeSeries.length >= 2 ? gradeSeries[gradeSeries.length - 1] - gradeSeries[0] : null
  const skillsImproving = mastery.filter((m) => m.trend === 'up').length

  const inClassroom = courses.length > 0 || gradedChrono.length > 0
  const gradedNewestFirst = [...gradedChrono].reverse()

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="progress" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:px-10">
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">Your progress</h1>
            <p className="mt-1 text-[15px] text-bloom-ink/55">See how your work is improving over time.</p>
          </div>

          {error && (
            <p className="mb-6 rounded-xl bg-bloom-600/[0.06] px-4 py-3 text-sm text-bloom-700 ring-1 ring-bloom-600/15">{error}</p>
          )}
          {loading && <p className="text-sm text-bloom-ink/45">Loading your progress…</p>}

          {!loading && !error && (
            <div className="space-y-8">
              {/* Headline stats */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {inClassroom ? (
                  <StatCard
                    label="Average grade"
                    value={avgGrade ?? '—'}
                    accent
                    sub={gradeDelta != null ? `${gradeDelta >= 0 ? '▲ +' : '▼ '}${Math.abs(gradeDelta)} since your first` : undefined}
                  />
                ) : (
                  <StatCard label="Exercises done" value={`${doneCount}/${BRIEFS.length}`} accent />
                )}
                {inClassroom && <StatCard label="Graded assignments" value={gradedChrono.length} sub={bestGrade != null ? `best ${bestGrade}` : undefined} />}
                <StatCard label="Exercises done" value={`${doneCount}/${BRIEFS.length}`} />
                <StatCard label="Skills improving" value={skillsImproving} sub={mastery.length ? `of ${mastery.length} tracked` : undefined} />
              </div>

              {/* Grade trend — the "how I improved" centrepiece */}
              {gradeSeries.length >= 2 && (
                <section className="rounded-2xl border border-bloom-200 bg-white p-5">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold text-bloom-ink">Grade trend</h2>
                    <span className={`text-sm font-semibold ${gradeDelta != null && gradeDelta >= 0 ? 'text-bloom-600' : 'text-bloom-clay'}`}>
                      {gradeDelta != null && gradeDelta >= 0 ? 'Trending up' : 'Keep going'}
                    </span>
                  </div>
                  <Sparkline values={gradeSeries} />
                  <div className="mt-1 flex justify-between text-[11px] text-bloom-ink/45">
                    <span>First: {gradeSeries[0]}</span>
                    <span>Latest: {gradeSeries[gradeSeries.length - 1]}</span>
                  </div>
                </section>
              )}

              <div className="grid gap-8 lg:grid-cols-2">
                {/* Principle mastery — improvement per skill */}
                <section>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="font-display text-lg font-semibold text-bloom-ink">Skill trends</h2>
                    <span className="text-sm text-bloom-ink/45">weakest first</span>
                  </div>
                  {mastery.length === 0 ? (
                    <p className="rounded-xl border border-bloom-200 bg-white px-4 py-8 text-center text-sm text-bloom-ink/55">
                      No skill data yet. Finish an exercise or save a version of a design to start tracking.
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
                              <span className={`text-xs font-semibold ${tone.text}`}>{m.mastery} · {tone.label}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-bloom-100">
                              <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${m.mastery}%` }} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>

                {/* Coursework (graded) or Exercises for non-classroom users */}
                {inClassroom ? (
                  <section>
                    <div className="mb-3 flex items-baseline justify-between">
                      <h2 className="font-display text-lg font-semibold text-bloom-ink">Coursework</h2>
                      <span className="text-sm text-bloom-ink/45">graded assignments</span>
                    </div>
                    {gradedNewestFirst.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-8 text-center text-sm text-bloom-ink/50">
                        No graded coursework yet. Submit an assignment and your grades will appear here.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {gradedNewestFirst.map((s) => {
                          const a = assignmentById.get(s.assignment_id)
                          const courseName = a ? courseById.get(a.course_id) : null
                          const inner = (
                            <>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-bloom-ink">{a?.title ?? 'Assignment'}</p>
                                <p className="truncate text-[11px] text-bloom-ink/50">
                                  {courseName ? `${courseName} · ` : ''}
                                  {s.graded_at ? new Date(s.graded_at).toLocaleDateString() : ''}
                                </p>
                                {s.feedback && <p className="mt-1 line-clamp-2 text-xs text-bloom-ink/70">{s.feedback}</p>}
                              </div>
                              <span className="shrink-0 self-start rounded-lg bg-bloom-100 px-2.5 py-1 text-sm font-bold text-bloom-700">{s.grade}/100</span>
                            </>
                          )
                          return (
                            <li key={s.id}>
                              {a ? (
                                <Link to={`/classroom/${a.course_id}/a/${a.id}`} className="flex items-start gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3 transition hover:border-bloom-500/50">
                                  {inner}
                                </Link>
                              ) : (
                                <div className="flex items-start gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3">{inner}</div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </section>
                ) : (
                  <ExercisesSection briefProgress={briefProgress} doneCount={doneCount} />
                )}
              </div>

              {/* Exercises always shown for classroom students (below the fold) */}
              {inClassroom && <ExercisesSection briefProgress={briefProgress} doneCount={doneCount} />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ExercisesSection({ briefProgress, doneCount }: { briefProgress: Map<string, BriefProgress>; doneCount: number }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold text-bloom-ink">Practice exercises</h2>
        <span className="text-sm text-bloom-ink/45">{doneCount} of {BRIEFS.length} complete</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {BRIEFS.map((b) => {
          const p = briefProgress.get(b.id)
          return (
            <li key={b.id} className="flex items-center gap-3 rounded-xl border border-bloom-200 bg-white px-3.5 py-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${p ? 'bg-bloom-600 text-white' : 'border border-bloom-ink/20 text-transparent'}`} aria-hidden>✓</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-bloom-ink">{b.title}</p>
                <p className="text-[11px] text-bloom-ink/50">
                  {p ? `Completed ${new Date(p.latest).toLocaleDateString()}${p.count > 1 ? ` · ${p.count}×` : ''}` : `${b.constraints.length} goals · not started`}
                </p>
              </div>
              {p?.best != null && <span className="shrink-0 rounded-lg bg-bloom-100 px-2 py-1 text-xs font-semibold text-bloom-700">{p.best}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
