import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useStudio } from '../../domain/store'
import { computeMetrics } from '../../education/metrics'
import { BRIEFS, BRIEF_INDEX, evaluateBrief } from '../../education/briefs'
import { scoreDesign } from '../../education/report'
import { samplesFromReport } from '../../education/mastery'
import { recordExerciseCompletion, recordSkillSamples } from '../../lib/progressApi'

/**
 * Exercises: pick a client brief and watch its goals tick off as you design.
 * Each goal is a machine-checkable predicate over the design metrics, so the
 * exercise grades itself live — the same computation that powers the feedback.
 */
export function ExercisesPanel() {
  const { id: designId } = useParams<{ id: string }>()
  const doc = useStudio((s) => s.doc)
  const activeBriefId = useStudio((s) => s.activeBriefId)
  const setActiveBrief = useStudio((s) => s.setActiveBrief)
  const setVessel = useStudio((s) => s.setVessel)

  const brief = activeBriefId ? BRIEF_INDEX[activeBriefId] : null
  const metrics = useMemo(() => computeMetrics(doc), [doc])
  const result = useMemo(() => (brief ? evaluateBrief(brief, metrics) : null), [brief, metrics])

  const start = (id: string) => {
    const b = BRIEF_INDEX[id]
    setActiveBrief(id)
    if (b?.vesselId) setVessel(b.vesselId) // set the brief's vessel context
  }

  /** Log the completion + a mastery sample for each principle, then exit. */
  const finish = (briefId: string) => {
    const report = scoreDesign(doc)
    void recordExerciseCompletion({
      briefId,
      designId: designId ?? null,
      overallScore: report.overall,
    }).catch(() => {})
    void recordSkillSamples(designId ?? null, samplesFromReport(report)).catch(() => {})
    setActiveBrief(null)
  }

  // ── Picker ────────────────────────────────────────────────────────────
  if (!brief || !result) {
    return (
      <section aria-label="Exercises">
        <p className="mb-2 text-xs text-bloom-ink/55">
          Practise a real brief — your goals tick off as you design.
        </p>
        <ul className="space-y-1.5">
          {BRIEFS.map((b) => (
            <li key={b.id}>
              <button
                onClick={() => start(b.id)}
                className="w-full rounded-lg border border-bloom-200 bg-white p-2.5 text-left transition hover:border-bloom-500/50"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-bloom-ink">{b.title}</span>
                  <span className="chip bg-bloom-100 capitalize text-bloom-700">{b.level}</span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-bloom-ink/55">{b.scenario}</span>
                <span className="mt-1 block text-[11px] font-medium text-bloom-600">
                  {b.constraints.length} goals →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  // ── Active exercise ───────────────────────────────────────────────────
  const pct = Math.round((result.met / result.total) * 100)
  return (
    <section aria-label="Active exercise" className="rounded-xl border border-bloom-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="chip bg-bloom-100 capitalize text-bloom-700">{brief.level} exercise</span>
          <h3 className="mt-1 font-display text-sm font-semibold text-bloom-ink">{brief.title}</h3>
        </div>
        <button
          onClick={() => setActiveBrief(null)}
          title="Exit exercise"
          aria-label="Exit exercise"
          className="shrink-0 rounded-md p-1 text-bloom-ink/45 transition-colors hover:bg-bloom-100 hover:text-bloom-ink"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p className="mt-1 text-xs leading-relaxed text-bloom-ink/70">{brief.scenario}</p>

      {/* Progress */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] font-semibold">
          <span className={result.complete ? 'text-bloom-600' : 'text-bloom-ink/60'}>
            {result.complete ? 'All goals met 🎉' : `${result.met} of ${result.total} goals met`}
          </span>
          <span className="text-bloom-ink/45">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bloom-100">
          <div className="h-full rounded-full bg-bloom-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Checklist */}
      <ul className="mt-3 space-y-2">
        {result.results.map(({ constraint, met }) => (
          <li key={constraint.id} className="flex items-start gap-2">
            <span
              className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                met ? 'bg-bloom-600 text-white' : 'border border-bloom-ink/25 text-transparent'
              }`}
              aria-hidden
            >
              ✓
            </span>
            <span className="min-w-0">
              <span
                className={`block text-xs ${
                  met
                    ? 'font-medium text-bloom-ink/45 line-through decoration-bloom-ink/25'
                    : 'font-medium text-bloom-ink'
                }`}
              >
                {constraint.label}
              </span>
              {!met && (
                <span className="mt-0.5 block text-[11px] leading-snug text-bloom-ink/55">
                  {constraint.hint}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {result.complete && (
        <button
          onClick={() => finish(brief.id)}
          className="mt-3 w-full rounded-lg bg-bloom-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-bloom-700"
        >
          Finish exercise
        </button>
      )}
    </section>
  )
}
