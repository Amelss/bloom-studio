import { describe, expect, it } from 'vitest'
import {
  hasRubric,
  presetRubricFromPrinciples,
  rubricMaxTotal,
  rubricTotal,
  validCriteria,
} from './rubric'
import { PRINCIPLES } from './principles'
import type { Rubric } from '../lib/types'

const rubric: Rubric = [
  { id: 'a', label: 'Focal point', description: '', max: 10 },
  { id: 'b', label: 'Colour', description: '', max: 30 },
  { id: 'c', label: 'Balance', description: '', max: 10 },
]

describe('hasRubric', () => {
  it('is false for null / empty and true for a populated list', () => {
    expect(hasRubric(null)).toBe(false)
    expect(hasRubric([])).toBe(false)
    expect(hasRubric(rubric)).toBe(true)
  })
})

describe('validCriteria / rubricMaxTotal', () => {
  it('drops blank-labelled and non-positive rows', () => {
    const messy: Rubric = [
      ...rubric,
      { id: 'd', label: '   ', description: '', max: 20 }, // blank label
      { id: 'e', label: 'Zero', description: '', max: 0 }, // no points
    ]
    expect(validCriteria(messy)).toHaveLength(3)
    expect(rubricMaxTotal(messy)).toBe(50)
  })
})

describe('rubricTotal', () => {
  it('normalises earned points to a 0–100 grade', () => {
    // 5/10 + 15/30 + 10/10 = 30 earned of 50 → 60
    const grade = rubricTotal(rubric, [
      { criterionId: 'a', points: 5 },
      { criterionId: 'b', points: 15 },
      { criterionId: 'c', points: 10 },
    ])
    expect(grade).toBe(60)
  })

  it('treats unscored criteria as zero', () => {
    // only c scored: 10/50 → 20
    expect(rubricTotal(rubric, [{ criterionId: 'c', points: 10 }])).toBe(20)
  })

  it('clamps a score above its max', () => {
    // a clamped to 10, rest zero: 10/50 → 20
    expect(rubricTotal(rubric, [{ criterionId: 'a', points: 999 }])).toBe(20)
  })

  it('clamps a negative score to zero', () => {
    expect(rubricTotal(rubric, [{ criterionId: 'b', points: -5 }])).toBe(0)
  })

  it('rounds to the nearest whole grade', () => {
    // 1/10 + 0 + 0 = 1/50 = 2%; 2/10 → 4. Use a case that rounds: 1 of 3-point rows
    const r: Rubric = [{ id: 'x', label: 'X', description: '', max: 3 }]
    // 1/3 → 33.33 → 33
    expect(rubricTotal(r, [{ criterionId: 'x', points: 1 }])).toBe(33)
    // 2/3 → 66.67 → 67
    expect(rubricTotal(r, [{ criterionId: 'x', points: 2 }])).toBe(67)
  })

  it('returns 0 when there is nothing gradeable', () => {
    expect(rubricTotal([], [])).toBe(0)
    expect(rubricTotal([{ id: 'z', label: '', description: '', max: 10 }], [])).toBe(0)
  })
})

describe('presetRubricFromPrinciples', () => {
  it('builds one 10-point row per design principle with unique ids', () => {
    const preset = presetRubricFromPrinciples(PRINCIPLES)
    const principleCount = PRINCIPLES.filter((p) => p.group === 'principle').length
    expect(preset).toHaveLength(principleCount)
    expect(preset.every((c) => c.max === 10 && c.label !== '')).toBe(true)
    expect(new Set(preset.map((c) => c.id)).size).toBe(preset.length)
  })
})
