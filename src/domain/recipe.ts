import type { DesignDocument } from './types'
import { FLOWER_INDEX, VESSEL_INDEX, getColorway } from '../data/catalog'

/**
 * The recipe is derived, never entered: because the design is structured data
 * (which stems, how many, where), the stem count, cost, and suggested retail
 * fall out of the canvas automatically.
 */

export interface RecipeLine {
  key: string
  varietyId: string
  varietyName: string
  colorwayName: string
  count: number
  unitPrice: number
  lineTotal: number
  isOverride: boolean
}

export interface Recipe {
  lines: RecipeLine[]
  stemCount: number
  flowerCost: number
  vessel: { name: string; price: number; mechanics: string } | null
  materialCost: number
  markup: number
  suggestedRetail: number
}

export function buildRecipe(doc: DesignDocument): Recipe {
  const grouped = new Map<string, RecipeLine>()

  for (const stem of doc.stems) {
    const variety = FLOWER_INDEX[stem.varietyId]
    if (!variety) continue
    const colorway = getColorway(stem.varietyId, stem.colorwayId)
    const key = `${stem.varietyId}:${colorway?.id ?? 'default'}`
    const override = doc.pricing.priceOverrides[stem.varietyId]
    const unitPrice = override ?? variety.guidePriceGBP

    const line = grouped.get(key)
    if (line) {
      line.count += 1
      line.lineTotal = round2(line.count * line.unitPrice)
    } else {
      grouped.set(key, {
        key,
        varietyId: stem.varietyId,
        varietyName: variety.commonName,
        colorwayName: colorway?.name ?? '',
        count: 1,
        unitPrice,
        lineTotal: round2(unitPrice),
        isOverride: override != null,
      })
    }
  }

  const lines = [...grouped.values()].sort(
    (a, b) => a.varietyName.localeCompare(b.varietyName) || a.colorwayName.localeCompare(b.colorwayName),
  )

  const vesselDef = doc.vesselId ? VESSEL_INDEX[doc.vesselId] : null
  const vessel = vesselDef
    ? { name: vesselDef.name, price: vesselDef.priceGBP, mechanics: vesselDef.mechanics }
    : null

  const stemCount = doc.stems.length
  const flowerCost = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0))
  const materialCost = round2(flowerCost + (vessel?.price ?? 0))
  const suggestedRetail = round2(materialCost * doc.pricing.markup)

  return { lines, stemCount, flowerCost, vessel, materialCost, markup: doc.pricing.markup, suggestedRetail }
}

export function recipeToCSV(recipe: Recipe, designName: string): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const rows: string[] = []
  rows.push(['Design', designName].map(esc).join(','))
  rows.push('')
  rows.push(['Item', 'Colour', 'Stems', 'Unit price (GBP)', 'Line total (GBP)'].map(esc).join(','))
  for (const line of recipe.lines) {
    rows.push([line.varietyName, line.colorwayName, line.count, line.unitPrice.toFixed(2), line.lineTotal.toFixed(2)].map(esc).join(','))
  }
  if (recipe.vessel) {
    rows.push([recipe.vessel.name, '', 1, recipe.vessel.price.toFixed(2), recipe.vessel.price.toFixed(2)].map(esc).join(','))
  }
  rows.push('')
  rows.push(['Total stems', recipe.stemCount].map(esc).join(','))
  rows.push(['Material cost (GBP)', recipe.materialCost.toFixed(2)].map(esc).join(','))
  rows.push(['Markup', `${recipe.markup}x`].map(esc).join(','))
  rows.push(['Suggested retail (GBP)', recipe.suggestedRetail.toFixed(2)].map(esc).join(','))
  if (recipe.vessel) rows.push(['Mechanics', recipe.vessel.mechanics].map(esc).join(','))
  return rows.join('\n')
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
