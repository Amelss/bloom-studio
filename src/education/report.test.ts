import { describe, expect, it } from 'vitest'
import { scoreDesign } from './report'
import { blankDocument, starterTemplate } from '../domain/templates'

describe('scoreDesign', () => {
  it('has no score for an empty design', () => {
    const report = scoreDesign(blankDocument())
    expect(report.overall).toBeNull()
    expect(report.evaluated).toBe(0)
  })

  it('grades the exemplary starter template well', () => {
    const report = scoreDesign(starterTemplate())
    expect(report.overall).not.toBeNull()
    expect(report.overall!).toBeGreaterThanOrEqual(70) // "Solid" or better
    expect(report.evaluated).toBeGreaterThan(3)
    expect(report.strong).toBeGreaterThan(0)
    // Weakest principle sorts first.
    const sorted = report.scores.every((s, i, a) => i === 0 || a[i - 1].score <= s.score)
    expect(sorted).toBe(true)
  })
})
