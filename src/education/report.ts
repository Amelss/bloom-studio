import type { DesignDocument } from '../domain/types'
import { analyzeDesign, type InsightTone } from './insights'
import { PRINCIPLES } from './principles'

/**
 * The design report card: rolls the live per-principle insights into an overall
 * score. Because feedback is already computed per principle with a tone, grading
 * is just mapping tones to points and averaging — the same engine that teaches
 * also assesses, which is the foundation for exercises, assignments and grading.
 */

const TONE_SCORE: Record<InsightTone, number> = { positive: 100, tip: 65, watch: 30 }
/** Lower rank = worse; used to pick the most critical tone per principle. */
const TONE_RANK: Record<InsightTone, number> = { watch: 0, tip: 1, positive: 2 }

export interface PrincipleScore {
  principleId: string
  name: string
  tone: InsightTone
  score: number
  /** The representative insight's headline. */
  title: string
}

export interface DesignReport {
  /** 0–100, or null when there aren't enough stems to assess. */
  overall: number | null
  label: string
  scores: PrincipleScore[]
  evaluated: number
  strong: number // positives
  improve: number // tips
  watch: number // watches
}

function labelFor(score: number): string {
  if (score >= 85) return 'Strong'
  if (score >= 70) return 'Solid'
  if (score >= 55) return 'Developing'
  return 'Needs work'
}

export function scoreDesign(doc: DesignDocument): DesignReport {
  if (doc.stems.length === 0) {
    return { overall: null, label: 'Add stems to see your score', scores: [], evaluated: 0, strong: 0, improve: 0, watch: 0 }
  }
  const insights = analyzeDesign(doc)

  // One score per principle — keep the most critical tone if several fired.
  const worst = new Map<string, InsightTone>()
  const title = new Map<string, string>()
  for (const ins of insights) {
    const current = worst.get(ins.principleId)
    if (current == null || TONE_RANK[ins.tone] < TONE_RANK[current]) {
      worst.set(ins.principleId, ins.tone)
      title.set(ins.principleId, ins.title)
    }
  }

  const scores: PrincipleScore[] = [...worst.entries()]
    .map(([principleId, tone]) => ({
      principleId,
      name: PRINCIPLES.find((p) => p.id === principleId)?.name ?? principleId,
      tone,
      score: TONE_SCORE[tone],
      title: title.get(principleId) ?? '',
    }))
    // Weakest first — the student's next fix sits at the top.
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))

  const evaluated = scores.length
  const overall =
    evaluated === 0 ? null : Math.round(scores.reduce((sum, s) => sum + s.score, 0) / evaluated)

  return {
    overall,
    label: overall == null ? 'Add stems to see your score' : labelFor(overall),
    scores,
    evaluated,
    strong: scores.filter((s) => s.tone === 'positive').length,
    improve: scores.filter((s) => s.tone === 'tip').length,
    watch: scores.filter((s) => s.tone === 'watch').length,
  }
}
