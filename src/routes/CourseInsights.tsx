import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ClassroomShell } from '../components/ClassroomShell'
import { useCourse } from '../hooks/useCourse'
import { aggregateCohort, type CohortPrinciple } from '../education/cohort'
import {
  classroomErrorMessage as errMsg,
  listAssignments,
  listCourseReports,
} from '../lib/classroomApi'
import type { SampleInput } from '../lib/progressApi'

/** Colour band for a principle's cohort average. */
function tone(avg: number): { bar: string; text: string; label: string } {
  if (avg >= 70) return { bar: 'bg-bloom-500', text: 'text-bloom-700', label: 'Strong' }
  if (avg >= 55) return { bar: 'bg-amber-400', text: 'text-amber-700', label: 'Developing' }
  return { bar: 'bg-bloom-clay', text: 'text-bloom-clay', label: 'Needs work' }
}

/** Cohort analytics (route `/classroom/:courseId/insights`). Educator only. */
export default function CourseInsights() {
  const { courseId } = useParams<{ courseId: string }>()
  const { course, isOwner, loading } = useCourse(courseId)
  const [reports, setReports] = useState<Array<SampleInput[] | null> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    let active = true
    ;(async () => {
      try {
        const a = await listAssignments(courseId)
        const r = await listCourseReports(a.map((x) => x.id))
        if (active) setReports(r)
      } catch (e) {
        if (active) setError(errMsg(e))
      }
    })()
    return () => {
      active = false
    }
  }, [courseId])

  const insights = useMemo(() => (reports ? aggregateCohort(reports) : null), [reports])
  const back = { to: `/classroom/${courseId}`, label: course?.name ?? 'Course' }

  if (!loading && course && !isOwner) {
    return (
      <ClassroomShell back={back}>
        <p className="mt-6 text-sm text-bloom-ink/55">Only the course educator can see class insights.</p>
      </ClassroomShell>
    )
  }

  const weakest = insights?.principles.slice(0, 3) ?? []

  return (
    <ClassroomShell back={back}>
      <div className="mb-6 mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-bloom-ink/40">Class insights</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">
          {course?.name ?? 'Course'}
        </h1>
      </div>

      {error && <p className="mb-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-bloom-clay">{error}</p>}

      {!insights ? (
        <p className="text-sm text-bloom-ink/45">Loading…</p>
      ) : insights.submissionCount === 0 ? (
        <p className="rounded-xl border border-dashed border-bloom-300 bg-white px-4 py-12 text-center text-sm text-bloom-ink/50">
          No data yet. Class insights appear once students start submitting work.
        </p>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-bloom-200 bg-white p-4">
              <p className="text-3xl font-bold text-bloom-ink">{insights.submissionCount}</p>
              <p className="mt-0.5 text-xs font-medium text-bloom-ink/55">Submissions analysed</p>
            </div>
            <div className="rounded-2xl border border-bloom-200 bg-white p-4">
              <p className="text-3xl font-bold text-bloom-ink">{insights.overallAvg ?? '—'}</p>
              <p className="mt-0.5 text-xs font-medium text-bloom-ink/55">Class average</p>
            </div>
            <div className="rounded-2xl border border-bloom-200 bg-white p-4">
              <p className="text-3xl font-bold text-bloom-ink">{insights.principles.length}</p>
              <p className="mt-0.5 text-xs font-medium text-bloom-ink/55">Principles measured</p>
            </div>
          </div>

          {/* Weakest areas callout */}
          {weakest.length > 0 && (
            <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <h2 className="text-sm font-semibold text-amber-800">Where the class needs work</h2>
              <p className="mt-0.5 text-xs text-amber-700/80">The lowest-scoring principles across the cohort — worth a group lesson.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {weakest.map((p) => (
                  <span key={p.principleId} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-amber-800 ring-1 ring-amber-300">
                    {p.name} <span className="font-bold">{p.avg}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Per-principle bars, weakest first */}
          <section>
            <h2 className="mb-3 font-display text-xl font-semibold text-bloom-ink">By principle</h2>
            <ul className="space-y-3">
              {insights.principles.map((p) => (
                <PrincipleBar key={p.principleId} p={p} />
              ))}
            </ul>
          </section>
        </>
      )}
    </ClassroomShell>
  )
}

function PrincipleBar({ p }: { p: CohortPrinciple }) {
  const t = tone(p.avg)
  return (
    <li className="rounded-xl border border-bloom-200 bg-white px-4 py-3">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-bloom-ink">{p.name}</span>
        <span className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${t.text}`}>{t.label}</span>
          <span className="font-bold text-bloom-ink">{p.avg}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bloom-100">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${p.avg}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-bloom-ink/45">
        {p.samples} submission{p.samples === 1 ? '' : 's'}
        {p.needsWork > 0 ? ` · ${p.needsWork} flagged` : ''}
      </p>
    </li>
  )
}
