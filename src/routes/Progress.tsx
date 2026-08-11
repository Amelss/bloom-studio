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

/** A grade point in time. */
interface GradePoint {
  t: number
  v: number
  date: Date
}

/**
 * Grades over time: a single-series line chart with a 0–100 y-axis and monthly
 * x-axis. One brand hue, recessive gridlines, axis labels in ink tokens; each
 * point carries a native tooltip. (No legend — the section title names the series.)
 */
function GradeChart({ points }: { points: GradePoint[] }) {
  if (points.length < 2) return null
  const W = 760
  const H = 240
  const padL = 34
  const padR = 16
  const padT = 14
  const padB = 30
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const tMin = points[0].t
  const tMax = points[points.length - 1].t
  const span = tMax - tMin
  const xOf = (t: number, i: number) =>
    span > 0
      ? padL + ((t - tMin) / span) * plotW
      : padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const yOf = (v: number) => padT + (1 - Math.max(0, Math.min(100, v)) / 100) * plotH

  const coords = points.map((p, i) => ({ ...p, x: xOf(p.t, i), y: yOf(p.v) }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const yTicks = [0, 25, 50, 75, 100]

  // Monthly x-axis ticks: one per calendar month spanned (first clamped to the left).
  const monthTicks: Array<{ x: number; label: string }> = []
  if (span > 0) {
    const start = new Date(new Date(tMin).getFullYear(), new Date(tMin).getMonth(), 1)
    const multiYear = new Date(tMin).getFullYear() !== new Date(tMax).getFullYear()
    for (let d = start; d.getTime() <= tMax; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const tx = Math.max(tMin, d.getTime())
      const x = padL + ((tx - tMin) / span) * plotW
      const label =
        d.toLocaleDateString(undefined, { month: 'short' }) +
        (d.getMonth() === 0 || multiYear ? ` ’${String(d.getFullYear()).slice(2)}` : '')
      monthTicks.push({ x, label })
    }
  } else {
    monthTicks.push({ x: padL + plotW / 2, label: points[0].date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) })
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Grades over time">
      {/* Y gridlines + labels (0–100) */}
      <g className="text-bloom-200">
        {yTicks.map((t) => (
          <line key={t} x1={padL} x2={W - padR} y1={yOf(t)} y2={yOf(t)} stroke="currentColor" strokeWidth={1} />
        ))}
      </g>
      <g className="fill-current text-bloom-ink/45 text-[10px]">
        {yTicks.map((t) => (
          <text key={t} x={padL - 6} y={yOf(t) + 3} textAnchor="end">
            {t}
          </text>
        ))}
      </g>

      {/* X axis month labels */}
      <g className="fill-current text-bloom-ink/45 text-[10px]">
        {monthTicks.map((m, i) => (
          <text key={i} x={m.x} y={H - 10} textAnchor="middle">
            {m.label}
          </text>
        ))}
      </g>

      {/* The grade line + points (brand hue) */}
      <g className="text-bloom-600">
        <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4.5 : 3.5} fill="currentColor" stroke="#fff" strokeWidth={1.5}>
            <title>
              {c.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}: {c.v}/100
            </title>
          </circle>
        ))}
      </g>
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
  const gradePoints = useMemo<GradePoint[]>(
    () =>
      gradedChrono.map((s) => {
        const date = new Date(s.graded_at ?? s.submitted_at)
        return { t: date.getTime(), v: s.grade as number, date }
      }),
    [gradedChrono],
  )
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
              {gradePoints.length >= 2 && (
                <section className="rounded-2xl border border-bloom-200 bg-white p-5">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-bloom-ink">Grades over time</h2>
                      <p className="text-xs text-bloom-ink/50">Each graded assignment, oldest to newest.</p>
                    </div>
                    <span className={`text-sm font-semibold ${gradeDelta != null && gradeDelta >= 0 ? 'text-bloom-600' : 'text-bloom-clay'}`}>
                      {gradeDelta != null && gradeDelta > 0
                        ? `▲ up ${gradeDelta}`
                        : gradeDelta === 0
                          ? 'Steady'
                          : 'Keep going'}
                    </span>
                  </div>
                  <GradeChart points={gradePoints} />
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
