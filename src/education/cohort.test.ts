import { describe, expect, it } from 'vitest'
import { aggregateCohort } from './cohort'
import type { SampleInput } from '../lib/progressApi'

const r = (entries: Array<[string, number, SampleInput['tone']]>): SampleInput[] =>
  entries.map(([principleId, score, tone]) => ({ principleId, score, tone }))

describe('aggregateCohort', () => {
  it('averages each principle across submissions and sorts weakest first', () => {
    const reports = [
      r([['balance', 100, 'positive'], ['colour', 30, 'watch']]),
      r([['balance', 60, 'tip'], ['colour', 30, 'watch']]),
    ]
    const out = aggregateCohort(reports)
    expect(out.submissionCount).toBe(2)
    // colour avg 30, balance avg 80 → colour first (weakest)
    expect(out.principles.map((p) => p.principleId)).toEqual(['colour', 'balance'])
    const colour = out.principles[0]
    expect(colour.avg).toBe(30)
    expect(colour.samples).toBe(2)
    expect(colour.needsWork).toBe(2) // both 'watch'
    expect(out.principles[1].avg).toBe(80)
  })

  it('maps principle ids to display names', () => {
    const out = aggregateCohort([r([['balance', 50, 'tip']])])
    expect(out.principles[0].name).toBe('Balance')
  })

  it('skips empty/null reports and reports overall average', () => {
    const out = aggregateCohort([null, [], r([['depth', 40, 'watch'], ['balance', 60, 'tip']])])
    expect(out.submissionCount).toBe(1)
    expect(out.overallAvg).toBe(50) // (40 + 60) / 2
  })

  it('returns an empty, null-average result for no data', () => {
    const out = aggregateCohort([null, []])
    expect(out.submissionCount).toBe(0)
    expect(out.overallAvg).toBeNull()
    expect(out.principles).toEqual([])
  })
})
