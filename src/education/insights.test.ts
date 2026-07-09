import { describe, expect, it } from 'vitest'
import { analyzeDesign } from './insights'
import { blankDocument, starterTemplate } from '../domain/templates'
import { generateId, type DesignDocument, type PlacedStem } from '../domain/types'

function docWith(
  stems: Array<Partial<PlacedStem> & { varietyId: string }>,
  overrides: Partial<DesignDocument> = {},
): DesignDocument {
  const doc = blankDocument()
  doc.stems = stems.map(
    (s, i): PlacedStem => ({
      id: generateId(),
      colorwayId: 'default',
      x: 450,
      y: 300,
      rotation: 0,
      scale: 1,
      flipX: false,
      z: i,
      ...s,
    }),
  )
  return { ...doc, ...overrides }
}

const ids = (doc: DesignDocument) => analyzeDesign(doc).map((i) => i.id)

describe('analyzeDesign', () => {
  it('guides an empty canvas toward the professional build order', () => {
    expect(ids(blankDocument())).toEqual(['empty-canvas'])
  })

  it('notices a missing foliage base', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush' },
      { varietyId: 'garden-rose', colorwayId: 'blush' },
      { varietyId: 'peony', colorwayId: 'pink' },
    ])
    expect(ids(doc)).toContain('no-foliage')
  })

  it('reports symmetric weight as balanced', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 350 },
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 550 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 300 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 600 },
      { varietyId: 'ranunculus', colorwayId: 'pink', x: 450 },
    ])
    expect(ids(doc)).toContain('balance-good')
  })

  it('flags a design leaning hard to one side', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 820 },
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 840 },
      { varietyId: 'peony', colorwayId: 'pink', x: 860 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 800 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 830 },
    ])
    const insights = analyzeDesign(doc)
    const lean = insights.find((i) => i.id === 'balance-lean')
    expect(lean).toBeDefined()
    expect(lean?.title).toContain('right')
  })

  it('suggests odd focal counts for even numbers', () => {
    // 2 focal of 6 stems: under the focal-heavy threshold, but an even count.
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 400 },
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 500 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 350 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 550 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 450 },
      { varietyId: 'gypsophila', colorwayId: 'white', x: 450 },
    ])
    expect(ids(doc)).toContain('focal-even')
  })

  it('classifies an analogous palette', () => {
    // Blush rose (350°) + lilac lisianthus (280°): 70° apart — neighbours.
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 400 },
      { varietyId: 'lisianthus', colorwayId: 'lilac', x: 500 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 450 },
    ])
    expect(ids(doc)).toContain('colour-analogous')
  })

  it('classifies a single-hue-family palette as monochromatic', () => {
    // Blush rose (350°) + coral peony (15°) are only 25° apart on the wheel.
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 400 },
      { varietyId: 'peony', colorwayId: 'coral', x: 500 },
    ])
    expect(ids(doc)).toContain('colour-mono')
  })

  it('flags complementary contrast', () => {
    // Blue hydrangea (218°) vs coral peony (15°) — near-opposites.
    const doc = docWith([
      { varietyId: 'hydrangea', colorwayId: 'dusty-blue', x: 400 },
      { varietyId: 'peony', colorwayId: 'coral', x: 500 },
    ])
    expect(ids(doc)).toContain('colour-complementary')
  })

  it('flags foliage rendered in front of focal blooms', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', z: 1 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', z: 5 },
    ])
    expect(ids(doc)).toContain('depth-foliage-front')
  })

  it('praises the starter template (it is built to be exemplary)', () => {
    const insightIds = ids(starterTemplate())
    expect(insightIds).toContain('balance-good')
    expect(insightIds).toContain('depth-good')
    expect(insightIds).not.toContain('no-foliage')
  })
})
