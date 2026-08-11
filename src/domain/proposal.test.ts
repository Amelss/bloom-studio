import { describe, expect, it } from 'vitest'
import { clientIncludedItems, defaultProposalDetails, DEFAULT_TERMS, gbp } from './proposal'
import type { Recipe, RecipeLine } from './recipe'

function line(partial: Partial<RecipeLine>): RecipeLine {
  return {
    key: 'k',
    varietyId: 'v',
    varietyName: 'Rose',
    colorwayName: '',
    count: 1,
    unitPrice: 2,
    lineTotal: 2,
    isOverride: false,
    seasonMultiplier: 1,
    outOfSeason: false,
    ...partial,
  }
}

function recipe(partial: Partial<Recipe>): Recipe {
  return {
    lines: [],
    stemCount: 0,
    month: 0,
    flowerCost: 0,
    wastage: 0,
    flowerRetail: 0,
    vessel: null,
    vesselRetail: 0,
    labour: 0,
    materialCost: 0,
    markup: 3,
    subtotal: 0,
    vat: 0,
    vatEnabled: false,
    vatRate: 0.2,
    suggestedRetail: 0,
    ...partial,
  }
}

describe('clientIncludedItems', () => {
  it('lists varieties with counts and appends the vessel — no prices', () => {
    const r = recipe({
      lines: [
        line({ varietyName: 'Rose', colorwayName: 'Blush', count: 12 }),
        line({ varietyName: 'Eucalyptus', colorwayName: '', count: 5 }),
      ],
      vessel: { name: 'Kraft wrap', price: 4, mechanics: 'hand-tied' },
    })
    expect(clientIncludedItems(r)).toEqual([
      { label: 'Rose (Blush)', count: 12 },
      { label: 'Eucalyptus', count: 5 },
      { label: 'Kraft wrap', count: 1 },
    ])
  })

  it('omits the vessel line when there is none', () => {
    const r = recipe({ lines: [line({ count: 3 })], vessel: null })
    expect(clientIncludedItems(r)).toEqual([{ label: 'Rose', count: 3 }])
  })
})

describe('defaultProposalDetails', () => {
  it('seeds the business name and the standard terms', () => {
    const d = defaultProposalDetails({ businessName: 'Petal & Stem' })
    expect(d.businessName).toBe('Petal & Stem')
    expect(d.terms).toBe(DEFAULT_TERMS)
    expect(d.clientName).toBe('')
  })
})

describe('gbp', () => {
  it('formats to two decimals with a pound sign', () => {
    expect(gbp(152)).toBe('£152.00')
    expect(gbp(9.5)).toBe('£9.50')
  })
})
