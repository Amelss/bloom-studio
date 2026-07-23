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
  return [
    ['Total stems', String(recipe.stemCount)],
    ['Material cost', `£${recipe.materialCost.toFixed(2)}`],
    ['Markup', `${recipe.markup}×`],
    ['Suggested retail', `£${recipe.suggestedRetail.toFixed(2)}`],
  ]
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
