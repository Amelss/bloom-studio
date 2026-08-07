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
        { varietyId: 'garden-rose', colorwayId: 'coral' },
        { varietyId: 'eucalyptus', colorwayId: 'silver' },
      ]),
    )
    expect(recipe.stemCount).toBe(4)
    expect(recipe.lines).toHaveLength(3)
    const blush = recipe.lines.find((l) => l.colorwayName === 'Blush')
    expect(blush?.count).toBe(2)
  })

  it('costs seasonal flowers with wastage, markup and labour', () => {
    const doc = docWith([
      { varietyId: 'garden-rose', colorwayId: 'blush' }, // £2.80, year-round
      { varietyId: 'eucalyptus', colorwayId: 'silver' }, // £1.10, year-round
    ])
    const recipe = buildRecipe(doc)
    expect(recipe.flowerCost).toBeCloseTo(3.9)
    expect(recipe.wastage).toBeCloseTo(0.39) // 10% conditioning allowance
    expect(recipe.flowerRetail).toBeCloseTo(12.87) // (3.9 + 0.39) × 3
    expect(recipe.labour).toBeCloseTo(0.9) // 2 stems × 1.5 min × £18/hr
    expect(recipe.suggestedRetail).toBeCloseTo(13.77) // flowers + labour, no vessel/VAT
  })

  it('applies a seasonal uplift out of season', () => {
    const summer = docWith([{ varietyId: 'delphinium', colorwayId: 'blue' }]) // summer flower
    summer.pricing.month = 6 // July — in season
    expect(buildRecipe(summer).lines[0].unitPrice).toBeCloseTo(2.4)

    const winter = docWith([{ varietyId: 'delphinium', colorwayId: 'blue' }])
    winter.pricing.month = 0 // January — out of season
    const line = buildRecipe(winter).lines[0]
    expect(line.unitPrice).toBeCloseTo(6) // £2.40 × 2.5
    expect(line.outOfSeason).toBe(true)
  })

  it('enables a VAT line when configured', () => {
    const doc = docWith([{ varietyId: 'garden-rose', colorwayId: 'blush' }])
    doc.pricing.vatEnabled = true
    const recipe = buildRecipe(doc)
    expect(recipe.vat).toBeCloseTo(recipe.subtotal * 0.2)
    expect(recipe.suggestedRetail).toBeCloseTo(recipe.subtotal + recipe.vat)
  })

  it('respects per-variety price overrides', () => {
    const doc = docWith([{ varietyId: 'peony', colorwayId: 'pink' }])
    doc.pricing.priceOverrides.peony = 6
    const recipe = buildRecipe(doc)
    expect(recipe.lines[0].unitPrice).toBe(6)
    expect(recipe.lines[0].isOverride).toBe(true)
    expect(recipe.flowerCost).toBe(6)
  })

  it('adds the vessel at the hard-goods markup, not the flower markup', () => {
    const doc = docWith([{ varietyId: 'garden-rose', colorwayId: 'blush' }], { vesselId: 'compote' })
    const recipe = buildRecipe(doc)
    expect(recipe.vessel?.name).toBe('Footed Compote Bowl')
    expect(recipe.materialCost).toBeCloseTo(2.8 + 8) // raw cost of goods
    expect(recipe.vesselRetail).toBeCloseTo(16) // £8 × 2×, not the flower 3×
    // flowers (2.8+0.28)×3 = 9.24 + vessel 16 + labour 0.45 = 25.69
    expect(recipe.suggestedRetail).toBeCloseTo(25.69)
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
