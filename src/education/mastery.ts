import { PRINCIPLE_INDEX } from './principles'
import type { DesignReport } from './report'
import type { PrincipleMastery, SkillSample } from '../lib/types'
import type { SampleInput } from '../lib/progressApi'

/**
 * Mastery is derived from the raw skill samples, not stored: a principle's
 * mastery is the average of its most recent scores, and its trend compares the
 * newer half of recent samples against the older half. Keeping this a pure
 * function means it's cheap to test and the same logic the M5 educator
 * dashboard can later run across a whole cohort.
 */

/** How many recent samples feed the mastery average. */
const RECENT = 5
/** Samples considered when deciding the trend direction. */
const TREND_WINDOW = 10
/** Minimum score delta (older half → newer half) to count as a real move. */
const TREND_DELTA = 6

/** The per-principle scores from a report card, as loggable samples. */
export function samplesFromReport(report: DesignReport): SampleInput[] {
  return report.scores.map((s) => ({ principleId: s.principleId, score: s.score, tone: s.tone }))
}

function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function computeMastery(samples: SkillSample[]): PrincipleMastery[] {
  const byPrinciple = new Map<string, SkillSample[]>()
  for (const s of samples) {
    const list = byPrinciple.get(s.principle_id)
    if (list) list.push(s)
    else byPrinciple.set(s.principle_id, [s])
  }

  const out: PrincipleMastery[] = []
  for (const [principleId, list] of byPrinciple) {
    // Oldest → newest, so "recent" is the tail.
    const ordered = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const recent = ordered.slice(-RECENT)
    const mastery = Math.round(average(recent.map((s) => s.score)))

    let trend: PrincipleMastery['trend'] = 'steady'
    const window = ordered.slice(-TREND_WINDOW)
    if (window.length >= 2) {
      const mid = Math.floor(window.length / 2)
      const older = average(window.slice(0, mid).map((s) => s.score))
      const newer = average(window.slice(mid).map((s) => s.score))
      if (newer - older >= TREND_DELTA) trend = 'up'
      else if (older - newer >= TREND_DELTA) trend = 'down'
    }

    out.push({
      principleId,
      name: PRINCIPLE_INDEX[principleId]?.name ?? principleId,
      mastery,
      samples: ordered.length,
      trend,
    })
  }

  // Weakest first — what to practise next sits at the top.
  return out.sort((a, b) => a.mastery - b.mastery)
}
