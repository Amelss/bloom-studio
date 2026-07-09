import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DESIGN_DOC_VERSION,
  generateId,
  type DesignDocument,
  type PlacedStem,
} from './types'

export function blankDocument(name = 'Untitled design'): DesignDocument {
  const now = new Date().toISOString()
  return {
    version: DESIGN_DOC_VERSION,
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    vesselId: null,
    stems: [],
    pricing: { markup: 3, priceOverrides: {} },
  }
}

interface StarterStem {
  varietyId: string
  colorwayId: string
  x: number
  y: number
  rotation: number
  scale?: number
  flipX?: boolean
}

/**
 * The first-run template: a blush hand-tied bouquet, built in the professional
 * order (foliage skeleton → mass → focal → filler) so its layer stack is
 * itself a teaching example.
 */
export function starterTemplate(): DesignDocument {
  const doc = blankDocument('Blush hand-tied bouquet')
  doc.vesselId = 'kraft-wrap'

  const placements: StarterStem[] = [
    // Foliage skeleton (back layers)
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 300, y: 298, rotation: -26, scale: 1.2 },
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 600, y: 302, rotation: 24, scale: 1.2, flipX: true },
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 362, y: 226, rotation: -12, scale: 1.1 },
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 545, y: 224, rotation: 12, scale: 1.1, flipX: true },
    { varietyId: 'ruscus', colorwayId: 'green', x: 282, y: 372, rotation: -42, scale: 1.15 },
    { varietyId: 'ruscus', colorwayId: 'green', x: 620, y: 376, rotation: 40, scale: 1.15, flipX: true },
    // Secondary blooms (mid layers)
    { varietyId: 'lisianthus', colorwayId: 'white', x: 368, y: 214, rotation: -14, scale: 0.9 },
    { varietyId: 'lisianthus', colorwayId: 'white', x: 540, y: 212, rotation: 12, scale: 0.9, flipX: true },
    { varietyId: 'ranunculus', colorwayId: 'cream', x: 318, y: 262, rotation: -18, scale: 0.85 },
    { varietyId: 'ranunculus', colorwayId: 'cream', x: 588, y: 260, rotation: 16, scale: 0.85, flipX: true },
    { varietyId: 'ranunculus', colorwayId: 'pink', x: 452, y: 238, rotation: 2, scale: 0.85 },
    // Focal roses (front layers)
    { varietyId: 'garden-rose', colorwayId: 'blush', x: 400, y: 300, rotation: -7 },
    { varietyId: 'garden-rose', colorwayId: 'blush', x: 506, y: 296, rotation: 8, flipX: true },
    { varietyId: 'garden-rose', colorwayId: 'cream', x: 452, y: 352, rotation: 0, scale: 1.05 },
    { varietyId: 'garden-rose', colorwayId: 'blush', x: 356, y: 356, rotation: -15 },
    { varietyId: 'garden-rose', colorwayId: 'cream', x: 550, y: 354, rotation: 14, flipX: true },
    // Filler (floating slightly above)
    { varietyId: 'gypsophila', colorwayId: 'white', x: 336, y: 300, rotation: -10, scale: 0.8 },
    { varietyId: 'gypsophila', colorwayId: 'white', x: 574, y: 306, rotation: 10, scale: 0.8, flipX: true },
    { varietyId: 'spray-rose', colorwayId: 'blush', x: 452, y: 200, rotation: 3, scale: 0.85 },
  ]

  doc.stems = placements.map(
    (p, i): PlacedStem => ({
      id: generateId(),
      varietyId: p.varietyId,
      colorwayId: p.colorwayId,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      scale: p.scale ?? 1,
      flipX: p.flipX ?? false,
      z: i + 1,
    }),
  )

  return doc
}
