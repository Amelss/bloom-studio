import type { Recipe } from './recipe'

/**
 * M6 — Professional Outputs: the proposal builder. A client-facing document
 * that combines the design (image), the recipe's client pricing and the
 * florist's terms into one branded PDF the florist can send or a graduating
 * student can carry in a portfolio. Purely presentational: it reads a `Recipe`
 * (already costed by buildRecipe) — it never re-does pricing.
 */

export interface ProposalDetails {
  /** The florist's business name — the document's masthead. */
  businessName: string
  clientName: string
  /** Occasion, e.g. "Spring wedding". */
  eventName: string
  /** Free text so "14 June 2026" or "TBC" both work. */
  eventDate: string
  /** A short cover note above the design. */
  intro: string
  /** Terms & conditions, shown at the foot of the proposal. */
  terms: string
  /** Free text, e.g. "30 days from issue". */
  validUntil: string
}

export const DEFAULT_TERMS =
  'A 50% non-refundable deposit secures your date; the balance is due 14 days before the event. ' +
  'Stem counts and varieties may be substituted for blooms of equal value and character as seasonal ' +
  'availability dictates. Prices are valid for 30 days from the date of this proposal.'

const DEFAULT_INTRO =
  'Thank you for considering us for your florals. We’d be delighted to bring this design to life for ' +
  'you — here’s everything included, with pricing and terms below.'

export function defaultProposalDetails(opts: { businessName?: string } = {}): ProposalDetails {
  return {
    businessName: opts.businessName ?? '',
    clientName: '',
    eventName: '',
    eventDate: '',
    intro: DEFAULT_INTRO,
    terms: DEFAULT_TERMS,
    validUntil: '30 days from issue',
  }
}

/** £ formatting, matching the recipe panel. */
export function gbp(n: number): string {
  return `£${n.toFixed(2)}`
}

export interface IncludedItem {
  label: string
  count: number
}

/**
 * The client-facing "what's included" list: varieties and stem counts, with the
 * vessel appended — deliberately WITHOUT per-stem prices (that's the florist's
 * recipe, not the client's proposal).
 */
export function clientIncludedItems(recipe: Recipe): IncludedItem[] {
  const items: IncludedItem[] = recipe.lines.map((line) => ({
    label: line.colorwayName ? `${line.varietyName} (${line.colorwayName})` : line.varietyName,
    count: line.count,
  }))
  if (recipe.vessel) items.push({ label: recipe.vessel.name, count: 1 })
  return items
}

/** Deep-green brand ink for the PDF (matches the "White & Deep Green" palette). */
const BRAND: [number, number, number] = [47, 74, 56]
const INK: [number, number, number] = [38, 42, 40]
const MUTED: [number, number, number] = [120, 128, 122]

/**
 * Render the proposal to a branded A4 PDF. Dynamically imports `jspdf` so it
 * stays out of the main bundle (same pattern as recipeToPdf).
 */
export async function proposalToPdf(input: {
  recipe: Recipe
  designName: string
  /** PNG data URL of the design, or null to omit the image. */
  designImage: string | null
  details: ProposalDetails
}): Promise<Blob> {
  const { recipe, designName, designImage, details } = input
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 48
  const contentW = pageW - margin * 2
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage()
      y = margin
    }
  }

  // ── Masthead ──────────────────────────────────────────────────────────────
  pdf.setTextColor(...BRAND)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.text(details.businessName.trim() || 'Floral proposal', margin, y + 6)
  y += 18
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...MUTED)
  pdf.text('Floral proposal', margin, y + 6)
  y += 16
  pdf.setDrawColor(...BRAND)
  pdf.setLineWidth(1.5)
  pdf.line(margin, y, pageW - margin, y)
  y += 24

  // ── Prepared for ───────────────────────────────────────────────────────────
  pdf.setTextColor(...INK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  if (details.clientName.trim()) {
    pdf.text(`Prepared for ${details.clientName.trim()}`, margin, y)
    y += 16
  }
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(...MUTED)
  const eventBits = [details.eventName.trim(), details.eventDate.trim()].filter(Boolean)
  if (eventBits.length) {
    pdf.text(eventBits.join('  ·  '), margin, y)
    y += 16
  }
  y += 6

  // ── Cover note ─────────────────────────────────────────────────────────────
  if (details.intro.trim()) {
    pdf.setTextColor(...INK)
    pdf.setFontSize(11)
    const intro = pdf.splitTextToSize(details.intro.trim(), contentW)
    ensureSpace(intro.length * 15 + 8)
    pdf.text(intro, margin, y)
    y += intro.length * 15 + 12
  }

  // ── Design image ───────────────────────────────────────────────────────────
  if (designImage) {
    try {
      const props = pdf.getImageProperties(designImage)
      const maxH = 300
      const scale = Math.min(contentW / props.width, maxH / props.height)
      const w = props.width * scale
      const h = props.height * scale
      ensureSpace(h + 16)
      pdf.addImage(designImage, 'PNG', margin + (contentW - w) / 2, y, w, h)
      y += h + 20
    } catch {
      // A bad/blank capture just omits the image rather than failing the export.
    }
  }

  // ── What's included ─────────────────────────────────────────────────────────
  const items = clientIncludedItems(recipe)
  if (items.length) {
    ensureSpace(28)
    pdf.setTextColor(...BRAND)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text('Your arrangement', margin, y)
    y += 16
    pdf.setTextColor(...INK)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    for (const item of items) {
      ensureSpace(15)
      pdf.text(`•  ${item.label}`, margin + 6, y)
      pdf.text(`×${item.count}`, pageW - margin, y, { align: 'right' })
      y += 15
    }
    y += 10
  }

  // ── Investment ──────────────────────────────────────────────────────────────
  ensureSpace(50)
  pdf.setDrawColor(220, 224, 220)
  pdf.setLineWidth(0.75)
  pdf.line(margin, y, pageW - margin, y)
  y += 22
  pdf.setTextColor(...INK)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('Total investment', margin, y)
  pdf.setTextColor(...BRAND)
  pdf.setFontSize(16)
  pdf.text(gbp(recipe.suggestedRetail), pageW - margin, y, { align: 'right' })
  y += 16
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  pdf.text(
    recipe.vatEnabled
      ? `Includes VAT at ${Math.round(recipe.vatRate * 100)}%.`
      : 'VAT not applicable.',
    margin,
    y,
  )
  y += 24

  // ── Terms ────────────────────────────────────────────────────────────────────
  if (details.terms.trim()) {
    ensureSpace(40)
    pdf.setTextColor(...BRAND)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('Terms & conditions', margin, y)
    y += 14
    pdf.setTextColor(...MUTED)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const terms = pdf.splitTextToSize(details.terms.trim(), contentW)
    ensureSpace(terms.length * 12)
    pdf.text(terms, margin, y)
    y += terms.length * 12 + 6
  }

  // ── Footer on every page ─────────────────────────────────────────────────────
  const pages = pdf.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p)
    pdf.setFontSize(8)
    pdf.setTextColor(...MUTED)
    const footer = [details.businessName.trim() || designName]
    if (details.validUntil.trim()) footer.push(`Valid ${details.validUntil.trim()}`)
    pdf.text(footer.join('  ·  '), margin, pageH - 24)
    pdf.text(`${p} / ${pages}`, pageW - margin, pageH - 24, { align: 'right' })
  }

  return pdf.output('blob')
}
