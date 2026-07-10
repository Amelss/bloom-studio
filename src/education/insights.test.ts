import { describe, expect, it } from 'vitest'
import { analyzeDesign } from './insights'
import { blankDocument, starterTemplate } from '../domain/templates'
import { generateId, type DesignDocument, type PlacedStem } from '../domain/types'

/**
 * Fixtures are in v2 physical units: mm on a 600 × 450 artboard (centre
 * x = 300). Stems store binding points; rotation 0 puts the head directly
 * above the binding, so head x = binding x in these fixtures.
 */
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
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 250, band: 'focal' },
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 350, band: 'focal' },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 200, band: 'background' },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 400, band: 'background' },
      { varietyId: 'ranunculus', colorwayId: 'pink', x: 300 },
    ])
    expect(ids(doc)).toContain('balance-good')
  })

  it('flags a design leaning hard to one side', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 520, band: 'focal' },
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 540, band: 'focal' },
      { varietyId: 'peony', colorwayId: 'pink', x: 560, band: 'focal' },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 510, band: 'background' },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 530, band: 'background' },
    ])
    const insights = analyzeDesign(doc)
    const lean = insights.find((i) => i.id === 'balance-lean')
    expect(lean).toBeDefined()
    expect(lean?.title).toContain('right')
  })

  it('suggests odd focal counts for even numbers', () => {
    // 2 focal of 6 stems: under the focal-heavy threshold, but an even count.
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 270, band: 'focal' },
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 330, band: 'focal' },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 250, band: 'background' },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 350, band: 'background' },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 300, band: 'background' },
      { varietyId: 'gypsophila', colorwayId: 'white', x: 300, band: 'accents' },
    ])
    expect(ids(doc)).toContain('focal-even')
  })

  it('classifies an analogous palette', () => {
    // Blush rose (350°) + lilac lisianthus (280°): 70° apart — neighbours.
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 270 },
      { varietyId: 'lisianthus', colorwayId: 'lilac', x: 330 },
      { varietyId: 'eucalyptus', colorwayId: 'silver', x: 300, band: 'background' },
    ])
    expect(ids(doc)).toContain('colour-analogous')
  })

  it('classifies a single-hue-family palette as monochromatic', () => {
    // Blush rose (350°) + coral peony (15°) are only 25° apart on the wheel.
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', x: 270 },
      { varietyId: 'peony', colorwayId: 'coral', x: 330 },
    ])
    expect(ids(doc)).toContain('colour-mono')
  })

  it('flags complementary contrast', () => {
    // Blue hydrangea (218°) vs coral peony (15°) — near-opposites.
    const doc = docWith([
      { varietyId: 'hydrangea', colorwayId: 'dusty-blue', x: 270 },
      { varietyId: 'peony', colorwayId: 'coral', x: 330 },
    ])
    expect(ids(doc)).toContain('colour-complementary')
  })

  it('flags foliage rendered in front of focal blooms', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush', band: 'focal', order: 1 },
      // Foliage deliberately moved to the front band — covering the rose.
      { varietyId: 'eucalyptus', colorwayId: 'silver', band: 'accents', order: 5 },
    ])
    expect(ids(doc)).toContain('depth-foliage-front')
  })

  it('measures proportion against the real vessel size', () => {
    // Compote (behind-render): heads far above the rim → top-heavy warning.
    const doc = docWith(
      [
        { varietyId: 'delphinium', colorwayId: 'blue', y: 40, band: 'background' },
        { varietyId: 'garden-rose', colorwayId: 'blush', y: 320, band: 'focal' },
        { varietyId: 'eucalyptus', colorwayId: 'silver', y: 330, band: 'background' },
      ],
      { vesselId: 'compote' },
    )
    expect(ids(doc)).toContain('proportion-tall')
  })

  it('praises the starter template (it is built to be exemplary)', () => {
    const insightIds = ids(starterTemplate())
    expect(insightIds).toContain('balance-good')
    expect(insightIds).toContain('depth-good')
    expect(insightIds).not.toContain('no-foliage')
  })
})
