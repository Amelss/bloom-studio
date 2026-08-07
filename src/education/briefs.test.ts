import { describe, expect, it } from 'vitest'
import { blankDocument, starterTemplate } from '../domain/templates'
import { generateId, type DesignDocument, type PlacedStem } from '../domain/types'
import { computeMetrics } from './metrics'
import { BRIEF_INDEX, evaluateBrief } from './briefs'

function docWith(
  stems: Array<Partial<PlacedStem> & { varietyId: string }>,
  overrides: Partial<DesignDocument> = {},
): DesignDocument {
  const doc = blankDocument()
  doc.stems = stems.map(
    (s, i): PlacedStem => ({
      id: generateId(),
      colorwayId: 'default',
      x: 300,
      y: 320,
      rotation: 0,
      scale: 1,
      flipX: false,
      band: 'body',
      order: i,
      ...s,
    }),
  )
  return { ...doc, ...overrides }
}

describe('computeMetrics', () => {
  it('is zeroed for an empty design', () => {
    const m = computeMetrics(blankDocument())
    expect(m.stemCount).toBe(0)
    expect(m.focalCount).toBe(0)
    expect(m.paletteType).toBe('none')
    expect(m.balanceLean).toBeNull()
    expect(m.materialCost).toBe(0)
  })

  it('counts categories, varieties, and a tight palette', () => {
    const m = computeMetrics(
      docWith([
        { varietyId: 'garden-rose', colorwayId: 'blush' },
        { varietyId: 'garden-rose', colorwayId: 'blush' },
        { varietyId: 'peony', colorwayId: 'pink' },
        { varietyId: 'eucalyptus', colorwayId: 'silver' },
      ]),
    )
    expect(m.stemCount).toBe(4)
    expect(m.focalCount).toBe(3) // two roses + one peony are all focal
    expect(m.byCategory.foliage).toBe(1)
    expect(m.varietyCount).toBe(3)
    expect(m.paletteType).toBe('mono') // blush + pink sit in one hue family
  })
})

describe('evaluateBrief', () => {
  it('meets nothing on an empty canvas and completes only when every goal is met', () => {
    const brief = BRIEF_INDEX['balanced-beginnings']
    const empty = evaluateBrief(brief, computeMetrics(blankDocument()))
    expect(empty.met).toBe(0)
    expect(empty.complete).toBe(false)
    expect(empty.total).toBe(brief.constraints.length)

    // The worked starter bouquet should satisfy several of the goals.
    const starter = evaluateBrief(brief, computeMetrics(starterTemplate()))
    expect(starter.met).toBeGreaterThan(0)
  })

  it('grades the £45 budget constraint from live material cost', () => {
    const brief = BRIEF_INDEX['budget-compote']
    const cheap = evaluateBrief(
      brief,
      computeMetrics(docWith([{ varietyId: 'eucalyptus', colorwayId: 'silver' }], { vesselId: 'compote' })),
    )
    const budget = cheap.results.find((r) => r.constraint.id === 'under-budget')
    const vessel = cheap.results.find((r) => r.constraint.id === 'use-compote')
    expect(budget?.met).toBe(true) // one foliage stem is well under budget
    expect(vessel?.met).toBe(true)
  })
})
