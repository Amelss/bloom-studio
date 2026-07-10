import { describe, expect, it } from 'vitest'
import { buildRecipe, recipeToCSV } from './recipe'
import { blankDocument } from './templates'
import { generateId, type DesignDocument, type PlacedStem } from './types'

function docWith(
  stems: Array<{ varietyId: string; colorwayId: string }>,
  overrides: Partial<DesignDocument> = {},
): DesignDocument {
  const doc = blankDocument()
  doc.stems = stems.map(
    (s, i): PlacedStem => ({
      id: generateId(),
      varietyId: s.varietyId,
      colorwayId: s.colorwayId,
      x: 100 + i,
      y: 100,
      rotation: 0,
      scale: 1,
      flipX: false,
      band: 'body',
      order: i,
    }),
  )
  return { ...doc, ...overrides }
}

describe('buildRecipe', () => {
  it('counts stems grouped by variety and colourway', () => {
    const recipe = buildRecipe(
      docWith([
        { varietyId: 'garden-rose', colorwayId: 'blush' },
        { varietyId: 'garden-rose', colorwayId: 'blush' },
        { varietyId: 'garden-rose', colorwayId: 'cream' },
        { varietyId: 'eucalyptus', colorwayId: 'silver' },
      ]),
    )
    expect(recipe.stemCount).toBe(4)
    expect(recipe.lines).toHaveLength(3)
    const blush = recipe.lines.find((l) => l.colorwayName === 'Blush')
    expect(blush?.count).toBe(2)
  })

  it('costs from guide prices and applies the markup', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush' }, // £2.80
      { varietyId: 'eucalyptus', colorwayId: 'silver' }, // £1.10
    ])
    const recipe = buildRecipe(doc)
    expect(recipe.flowerCost).toBeCloseTo(3.9)
    expect(recipe.markup).toBe(3)
    expect(recipe.suggestedRetail).toBeCloseTo(11.7)
  })

  it('respects per-variety price overrides', () => {
    const doc = docWith([{ varietyId: 'peony', colorwayId: 'pink' }])
    doc.pricing.priceOverrides.peony = 6
    const recipe = buildRecipe(doc)
    expect(recipe.lines[0].unitPrice).toBe(6)
    expect(recipe.lines[0].isOverride).toBe(true)
    expect(recipe.flowerCost).toBe(6)
  })

  it('includes the vessel in material cost and retail', () => {
    const doc = docWith([{ varietyId: 'garden-rose', colorwayId: 'blush' }], { vesselId: 'compote' })
    const recipe = buildRecipe(doc)
    expect(recipe.vessel?.name).toBe('Footed Compote Bowl')
    expect(recipe.materialCost).toBeCloseTo(2.8 + 8)
    expect(recipe.suggestedRetail).toBeCloseTo((2.8 + 8) * 3)
  })

  it('exports a CSV with totals and mechanics', () => {
    const doc = docWith(
      [
        { varietyId: 'garden-rose', colorwayId: 'blush' },
        { varietyId: 'garden-rose', colorwayId: 'blush' },
      ],
      { vesselId: 'kraft-wrap' },
    )
    const csv = recipeToCSV(buildRecipe(doc), 'Test "quoted" design')
    expect(csv).toContain('"Garden Rose","Blush","2"')
    expect(csv).toContain('"Total stems","2"')
    expect(csv).toContain('Hand-tied spiral')
    expect(csv).toContain('""quoted""') // CSV-escaped quotes
  })
})
