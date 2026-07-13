import {
  CATEGORY_BAND,
  DEFAULT_ARTBOARD,
  DESIGN_DOC_VERSION,
  generateId,
  type DepthBand,
  type DesignDocument,
  type PlacedStem,
} from './types'
import { FLOWER_INDEX } from '../data/catalog'

export function blankDocument(name = 'Untitled design'): DesignDocument {
  const now = new Date().toISOString()
  return {
    version: DESIGN_DOC_VERSION,
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    artboards: [{ id: 'main', ...DEFAULT_ARTBOARD }],
    vesselId: null,
    stems: [],
    pricing: { markup: 3, priceOverrides: {} },
  }
}

interface StarterStem {
  varietyId: string
  colorwayId: string
  /** Binding point, mm. */
  x: number
  y: number
  rotation: number
  scale?: number
  flipX?: boolean
}

/**
 * The first-run template: a blush hand-tied bouquet built as a TRUE SPIRAL —
 * every binding point clustered where the hand would hold the bunch
 * (~300, 320 mm), heads fanning outward through rotation alone. The layer
 * stack follows the professional build order (foliage skeleton → secondary →
 * focal → filler), so the template itself teaches both technique and depth.
 */
export function starterTemplate(): DesignDocument {
  const doc = blankDocument('Blush hand-tied bouquet')
  doc.vesselId = 'kraft-wrap'

  const placements: StarterStem[] = [
    // Foliage skeleton — wide fan
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 297, y: 320, rotation: -42, scale: 1.05 },
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 303, y: 320, rotation: 42, scale: 1.05, flipX: true },
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 298, y: 318, rotation: -18 },
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 302, y: 318, rotation: 18, flipX: true },
    { varietyId: 'eucalyptus', colorwayId: 'silver', x: 300, y: 316, rotation: 0, scale: 0.95 },
    { varietyId: 'leatherleaf', colorwayId: 'green', x: 295, y: 330, rotation: -66, scale: 1.05 },
    { varietyId: 'leatherleaf', colorwayId: 'green', x: 305, y: 331, rotation: 64, scale: 1.05, flipX: true },
    { varietyId: 'ruscus', colorwayId: 'green', x: 294, y: 326, rotation: -58, scale: 1.1 },
    { varietyId: 'ruscus', colorwayId: 'green', x: 306, y: 328, rotation: 56, scale: 1.1, flipX: true },
    // Secondary blooms — mid fan
    { varietyId: 'lisianthus', colorwayId: 'white', x: 296, y: 316, rotation: -30, scale: 0.95 },
    { varietyId: 'lisianthus', colorwayId: 'white', x: 304, y: 316, rotation: 30, scale: 0.95, flipX: true },
    { varietyId: 'ranunculus', colorwayId: 'cream', x: 295, y: 318, rotation: -36, scale: 0.95 },
    { varietyId: 'ranunculus', colorwayId: 'cream', x: 305, y: 316, rotation: 34, scale: 0.95, flipX: true },
    { varietyId: 'ranunculus', colorwayId: 'pink', x: 302, y: 314, rotation: 4 },
    // Focal roses — the heart, low and central
    { varietyId: 'garden-rose', colorwayId: 'blush', x: 297, y: 322, rotation: -14 },
    { varietyId: 'garden-rose', colorwayId: 'blush', x: 303, y: 321, rotation: 12, flipX: true },
    { varietyId: 'garden-rose', colorwayId: 'coral', x: 300, y: 330, rotation: 0, scale: 1.05 },
    { varietyId: 'garden-rose', colorwayId: 'blush', x: 296, y: 334, rotation: -26 },
    { varietyId: 'garden-rose', colorwayId: 'blush', x: 298, y: 334, rotation: 24, flipX: true },
    // Filler — floating slightly beyond the outline
    { varietyId: 'gypsophila', colorwayId: 'white', x: 296, y: 318, rotation: -34, scale: 0.9 },
    { varietyId: 'gypsophila', colorwayId: 'white', x: 304, y: 320, rotation: 34, scale: 0.9, flipX: true },
  ]

  const orderByBand: Partial<Record<DepthBand, number>> = {}
  doc.stems = placements.map((p): PlacedStem => {
    const category = FLOWER_INDEX[p.varietyId]?.category ?? 'filler'
    const band = CATEGORY_BAND[category]
    const order = (orderByBand[band] = (orderByBand[band] ?? 0) + 1)
    return {
      id: generateId(),
      varietyId: p.varietyId,
      colorwayId: p.colorwayId,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      scale: p.scale ?? 1,
      flipX: p.flipX ?? false,
      band,
      order,
    }
  })

  return doc
}

/**
 * Synthetic document for performance benchmarking (`?perf=N`): N stems of
 * mixed varieties spread across the artboard. Deterministic layout so runs
 * are comparable.
 */
export function perfDocument(stemCount: number): DesignDocument {
  const doc = blankDocument(`Perf — ${stemCount} stems`)
  const varieties = Object.values(FLOWER_INDEX)
  const orderByBand: Partial<Record<DepthBand, number>> = {}
  for (let i = 0; i < stemCount; i++) {
    const variety = varieties[i % varieties.length]
    const band = CATEGORY_BAND[variety.category]
    const order = (orderByBand[band] = (orderByBand[band] ?? 0) + 1)
    // Deterministic pseudo-random spread (low-discrepancy-ish).
    const fx = ((i * 0.754877666) % 1)
    const fy = ((i * 0.569840296) % 1)
    doc.stems.push({
      id: `perf-${i}`,
      varietyId: variety.id,
      colorwayId: variety.colorways[i % variety.colorways.length].id,
      x: Math.round(30 + fx * 540),
      y: Math.round(60 + fy * 360),
      rotation: Math.round(((i * 37) % 90) - 45),
      scale: 0.85 + ((i * 13) % 7) * 0.05,
      flipX: i % 3 === 0,
      band,
      order,
    })
  }
  return doc
}
