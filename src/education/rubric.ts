/**
 * Rubric grading (M5). An educator can define per-assignment scoring criteria
 * (weighted rows) instead of a single free 0–100 grade. At grade time each
 * criterion is scored 0..max; the client rolls those up to a normalised 0–100
 * grade so everything downstream of `submissions.grade` (Progress, cohort) is
 * unchanged. A null/empty rubric means the assignment uses the legacy free grade.
 */

import { generateId } from '../domain/types'
import type { Principle } from './principles'
import type { Rubric, RubricCriterion, RubricScore } from '../lib/types'

/** A fresh, empty criterion (default 10 points). */
export function newCriterion(): RubricCriterion {
  return { id: generateId(), label: '', description: '', max: 10 }
}

/** Does this assignment grade against a rubric? Empty rows ⇒ no. */
export function hasRubric(rubric: Rubric | null | undefined): rubric is Rubric {
  return Array.isArray(rubric) && rubric.length > 0
}

/** The rows that actually count: a non-blank label and a positive max. */
export function validCriteria(rubric: Rubric): RubricCriterion[] {
  return rubric.filter((c) => c.label.trim() !== '' && c.max > 0)
}

/** Total points available across the valid criteria. */
export function rubricMaxTotal(rubric: Rubric): number {
  return validCriteria(rubric).reduce((sum, c) => sum + c.max, 0)
}

/**
 * Roll a set of per-criterion scores up to a normalised 0–100 grade.
 * Each score is clamped to its criterion's [0, max]; unscored criteria count
 * as 0. Returns 0 when there is nothing gradeable (no valid rows).
 */
export function rubricTotal(rubric: Rubric, scores: RubricScore[]): number {
  const criteria = validCriteria(rubric)
  const maxTotal = criteria.reduce((sum, c) => sum + c.max, 0)
  if (maxTotal <= 0) return 0
  const byId = new Map(scores.map((s) => [s.criterionId, s.points]))
  const earned = criteria.reduce((sum, c) => {
    const raw = byId.get(c.id) ?? 0
    const clamped = Math.max(0, Math.min(c.max, raw))
    return sum + clamped
  }, 0)
  return Math.round((100 * earned) / maxTotal)
}

/**
 * Seed a rubric from the app's design principles — a one-click starting point
 * aligned to what the software already teaches. Each principle becomes a row
 * worth 10 points.
 */
export function presetRubricFromPrinciples(principles: Principle[]): Rubric {
  return principles
    .filter((p) => p.group === 'principle')
    .map((p) => ({ id: generateId(), label: p.name, description: p.summary, max: 10 }))
}
