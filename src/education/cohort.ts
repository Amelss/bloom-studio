import { PRINCIPLES } from './principles'
import type { SampleInput } from '../lib/progressApi'

/**
 * Cohort analytics: roll each submission's per-principle report into class-wide
 * averages, so an educator sees where the whole group is strong or weak. The
 * same computed feedback that coaches one student, aggregated across many — the
 * structured-data advantage the classroom is built on.
 */

/** One principle averaged across the cohort's submissions. */
export interface CohortPrinciple {
  principleId: string
  name: string
  /** Mean score 0–100 across every submission that exercised this principle. */
  avg: number
  /** How many submissions contributed a score for this principle. */
  samples: number
  /** How many of those flagged it as needing work (tone 'watch'). */
  needsWork: number
}

export interface CohortInsights {
  /** Weakest (lowest average) first. */
  principles: CohortPrinciple[]
  /** Submissions that carried a usable report. */
  submissionCount: number
  /** Mean of all principle scores across the cohort, or null when empty. */
  overallAvg: number | null
}

const NAME = new Map(PRINCIPLES.map((p) => [p.id, p.name]))

export function aggregateCohort(reports: Array<SampleInput[] | null>): CohortInsights {
  const byPrinciple = new Map<string, { scores: number[]; needsWork: number }>()
  let submissionCount = 0

  for (const report of reports) {
    if (!report || report.length === 0) continue
    submissionCount++
    for (const s of report) {
      const entry = byPrinciple.get(s.principleId) ?? { scores: [], needsWork: 0 }
      entry.scores.push(s.score)
      if (s.tone === 'watch') entry.needsWork++
      byPrinciple.set(s.principleId, entry)
    }
  }

  const principles: CohortPrinciple[] = [...byPrinciple.entries()]
    .map(([principleId, e]) => ({
      principleId,
      name: NAME.get(principleId) ?? principleId,
      avg: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length),
      samples: e.scores.length,
      needsWork: e.needsWork,
    }))
    .sort((a, b) => a.avg - b.avg || b.samples - a.samples)

  const allScores = [...byPrinciple.values()].flatMap((e) => e.scores)
  const overallAvg = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : null

  return { principles, submissionCount, overallAvg }
}
