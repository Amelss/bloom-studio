import type { DesignDocument } from './types'
import { FLOWER_INDEX, VESSEL_INDEX, getColorway } from '../data/catalog'
import { seasonalMultiplier } from './seasonalPricing'

/**
 * The recipe is derived, never entered: because the design is structured data
 * (which stems, how many, where), the stem count, cost, and suggested retail
 * fall out of the canvas automatically. The costing mirrors how a UK studio
 * actually prices: seasonal wholesale stem prices + conditioning wastage,
 * marked up; the container at a lower hard-goods markup; labour on top; and an
 * optional VAT line. Every input is editable per design.
 */

export const PRICING_DEFAULTS = {
  labourRatePerHour: 18,
  minutesPerStem: 1.5,
  vesselMarkup: 2,
  wastageRate: 0.1,
  vatEnabled: false,
  vatRate: 0.2,
} as const

const round2 = (n: number) => Math.round(n * 100) / 100

export interface RecipeLine {
  key: string
  varietyId: string
  varietyName: string
  colorwayName: string
  count: number
  unitPrice: number
  lineTotal: number
  isOverride: boolean
  /** Applied seasonal multiplier (1 when in season or overridden). */
  seasonMultiplier: number
  /** True when a seasonal uplift is inflating the price (not overridden). */
  outOfSeason: boolean
}

export interface Recipe {
  lines: RecipeLine[]
  stemCount: number
  /** Month (0–11) the seasonal pricing was computed for. */
  month: number
  /** Seasonal wholesale flower cost, before wastage or markup. */
  flowerCost: number
  /** Conditioning-wastage allowance added to flower cost. */
  wastage: number
  /** Flowers (cost + wastage) at the retail markup. */
  flowerRetail: number
  vessel: { name: string; price: number; mechanics: string } | null
  /** Vessel at the hard-goods markup. */
  vesselRetail: number
  /** Labour charge. */
  labour: number
  /** Raw materials cost (flowers + vessel), pre-markup — the "what it cost you". */
  materialCost: number
  markup: number
  /** Retail before VAT (flowers + vessel + labour). */
  subtotal: number
  vat: number
  vatEnabled: boolean
  vatRate: number
  suggestedRetail: number
}

export function buildRecipe(doc: DesignDocument): Recipe {
  const p = doc.pricing
  const month = p.month ?? new Date().getMonth()
  const markup = p.markup
  const labourRatePerHour = p.labourRatePerHour ?? PRICING_DEFAULTS.labourRatePerHour
  const minutesPerStem = p.minutesPerStem ?? PRICING_DEFAULTS.minutesPerStem
  const vesselMarkup = p.vesselMarkup ?? PRICING_DEFAULTS.vesselMarkup
  const wastageRate = p.wastageRate ?? PRICING_DEFAULTS.wastageRate
  const vatEnabled = p.vatEnabled ?? PRICING_DEFAULTS.vatEnabled
  const vatRate = p.vatRate ?? PRICING_DEFAULTS.vatRate

  const grouped = new Map<string, RecipeLine>()
  for (const stem of doc.stems) {
    const variety = FLOWER_INDEX[stem.varietyId]
    if (!variety) continue
    const colorway = getColorway(stem.varietyId, stem.colorwayId)
    const key = `${stem.varietyId}:${colorway?.id ?? 'default'}`
    const override = p.priceOverrides[stem.varietyId]
    // A price the florist actually paid overrides everything; otherwise the
    // in-season guide price lifted by the real monthly seasonal index.
    const mult = seasonalMultiplier(stem.varietyId, variety.seasons, month)
    const unitPrice = override ?? round2(variety.guidePriceGBP * mult)

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
        seasonMultiplier: override != null ? 1 : mult,
        outOfSeason: override == null && mult > 1,
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
  const wastage = round2(flowerCost * wastageRate)
  const vesselCost = vessel?.price ?? 0
  const materialCost = round2(flowerCost + vesselCost)

  const flowerRetail = round2((flowerCost + wastage) * markup)
  const vesselRetail = round2(vesselCost * vesselMarkup)
  const labour = round2((stemCount * minutesPerStem * labourRatePerHour) / 60)
  const subtotal = round2(flowerRetail + vesselRetail + labour)
  const vat = vatEnabled ? round2(subtotal * vatRate) : 0
  const suggestedRetail = round2(subtotal + vat)

  return {
    lines,
    stemCount,
    month,
    flowerCost,
    wastage,
    flowerRetail,
    vessel,
    vesselRetail,
    labour,
    materialCost,
    markup,
    subtotal,
    vat,
    vatEnabled,
    vatRate,
    suggestedRetail,
  }
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
  for (const [label, value] of recipeSummaryRows(recipe)) {
    rows.push([label, value.replace('£', '')].map(esc).join(','))
  }
  if (recipe.vessel) rows.push(['Mechanics', recipe.vessel.mechanics].map(esc).join(','))
  return rows.join('\n')
}

/** Rows shared by the DOCX and PDF exporters: item lines then a summary block. */
function recipeTableRows(recipe: Recipe): { head: string[]; body: string[][] } {
  const head = ['Item', 'Colour', 'Stems', 'Unit £', 'Line total £']
  const body: string[][] = recipe.lines.map((line) => [
    line.varietyName,
    line.colorwayName,
    String(line.count),
    line.unitPrice.toFixed(2),
    line.lineTotal.toFixed(2),
  ])
  if (recipe.vessel) {
    body.push([recipe.vessel.name, '', '1', recipe.vessel.price.toFixed(2), recipe.vessel.price.toFixed(2)])
  }
  return { head, body }
}

function recipeSummaryRows(recipe: Recipe): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Total stems', String(recipe.stemCount)],
    ['Flower cost', `£${recipe.flowerCost.toFixed(2)}`],
    ['Wastage', `£${recipe.wastage.toFixed(2)}`],
    [`Flowers @ ${recipe.markup}×`, `£${recipe.flowerRetail.toFixed(2)}`],
  ]
  if (recipe.vessel) rows.push([`Vessel (${recipe.vessel.name})`, `£${recipe.vesselRetail.toFixed(2)}`])
  rows.push(['Labour', `£${recipe.labour.toFixed(2)}`])
  rows.push(['Subtotal', `£${recipe.subtotal.toFixed(2)}`])
  if (recipe.vatEnabled) rows.push([`VAT (${Math.round(recipe.vatRate * 100)}%)`, `£${recipe.vat.toFixed(2)}`])
  rows.push(['Suggested retail', `£${recipe.suggestedRetail.toFixed(2)}`])
  return rows
}

/** Build a Word (.docx) recipe. Dynamically imports `docx` so it stays out of the main bundle. */
export async function recipeToDocx(recipe: Recipe, designName: string): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType } =
    await import('docx')

  const { head, body } = recipeTableRows(recipe)
  const cell = (text: string, bold = false) =>
    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] })

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: head.map((h) => cell(h, true)) }),
      ...body.map((row) => new TableRow({ children: row.map((c) => cell(c)) })),
    ],
  })

  const summary = recipeSummaryRows(recipe).map(
    ([label, value]) =>
      new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] }),
  )

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: designName, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: 'Recipe & shopping list', heading: HeadingLevel.HEADING_2 }),
          table,
          new Paragraph({ text: '' }),
          ...summary,
          ...(recipe.vessel
            ? [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Mechanics: ', bold: true }),
                    new TextRun(recipe.vessel.mechanics),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  })

  return Packer.toBlob(doc)
}

/** Build a PDF recipe. Dynamically imports `jspdf` + autotable so they stay out of the main bundle. */
export async function recipeToPdf(recipe: Recipe, designName: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  pdf.setFontSize(18)
  pdf.text(designName, 40, 48)
  pdf.setFontSize(12)
  pdf.text('Recipe & shopping list', 40, 68)

  const { head, body } = recipeTableRows(recipe)
  autoTable(pdf, {
    head: [head],
    body,
    startY: 88,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [190, 130, 150] },
    margin: { left: 40, right: 40 },
  })

  // @ts-expect-error autotable stashes the final cursor position on the instance
  let y: number = (pdf.lastAutoTable?.finalY ?? 88) + 24
  pdf.setFontSize(11)
  for (const [label, value] of recipeSummaryRows(recipe)) {
    pdf.text(`${label}: ${value}`, 40, y)
    y += 18
  }
  if (recipe.vessel) {
    y += 6
    const lines = pdf.splitTextToSize(`Mechanics: ${recipe.vessel.mechanics}`, 515)
    pdf.text(lines, 40, y)
  }

  return pdf.output('blob')
}
