import { useMemo } from 'react'
import { useStudio } from '../../domain/store'
import { scoreDesign } from '../../education/report'
import type { InsightTone } from '../../education/insights'

const TONE_DOT: Record<InsightTone, string> = {
  positive: 'bg-bloom-600',
  tip: 'bg-amber-500',
  watch: 'bg-bloom-clay',
}

/** Colour the overall score by band. */
function scoreClasses(score: number): string {
  if (score >= 70) return 'bg-bloom-600/10 text-bloom-700'
  if (score >= 55) return 'bg-amber-500/15 text-amber-700'
  return 'bg-bloom-clay/15 text-bloom-clay'
}

/**
 * The design report card: an at-a-glance grade rolled up from the live
 * per-principle feedback, weakest principle first so the next fix is obvious.
 */
export function ReportCard() {
  const doc = useStudio((s) => s.doc)
  const report = useMemo(() => scoreDesign(doc), [doc])

  return (
    <section aria-label="Design report card" className="rounded-xl border border-bloom-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${
            report.overall == null ? 'bg-bloom-100 text-bloom-ink/40' : scoreClasses(report.overall)
          }`}
        >
          <span className="font-display text-xl font-semibold leading-none tabular-nums">
            {report.overall ?? '—'}
          </span>
          {report.overall != null && <span className="mt-0.5 text-[9px] font-medium opacity-70">/ 100</span>}
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold text-bloom-ink">Design score</h3>
          <p className="text-xs text-bloom-ink/60">
            {report.label}
            {report.overall != null && (
              <>
                {' · '}
                {report.strong} strong
                {report.improve > 0 && ` · ${report.improve} to improve`}
                {report.watch > 0 && ` · ${report.watch} to fix`}
              </>
            )}
          </p>
        </div>
      </div>

      {report.overall != null && (
        <ul className="mt-3 space-y-1.5">
          {report.scores.map((s) => (
            <li key={s.principleId} className="flex items-center gap-2 text-xs">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[s.tone]}`} aria-hidden />
              <span className="shrink-0 font-medium text-bloom-ink">{s.name}</span>
              <span className="ml-auto truncate pl-2 text-right text-bloom-ink/45">{s.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
