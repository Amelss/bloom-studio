import {
  CATEGORY_BAND,
  DEFAULT_ARTBOARD,
  DESIGN_DOC_VERSION,
  STEM_SCALE_MAX,
  STEM_SCALE_MIN,
  type DepthBand,
  type DesignDocument,
  type PlacedStem,
} from './types'
import { FLOWER_INDEX } from '../data/catalog'

/**
 * The single entry point for any document entering the app (import, storage,
 * cloud later). Migrations are cumulative and never removed.
 */
export function migrateDocument(raw: unknown): DesignDocument {
  if (!raw || typeof raw !== 'object') throw new Error('Not a design document')
  let doc = raw as Record<string, unknown>
  if (typeof doc.version !== 'number' || !Array.isArray(doc.stems)) {
    throw new Error('Not a Bloom Studio design file')
  }
  if (doc.version > DESIGN_DOC_VERSION) {
    throw new Error(
      `This design was made with a newer version of Bloom Studio (format v${doc.version}).`,
    )
  }
  if (doc.version === 1) doc = migrateV1toV2(doc)
  return doc as unknown as DesignDocument
}

/* ------------------------------- v1 → v2 ------------------------------- */

// v1 world: a 900 × 640 px canvas; stem (x, y) was the HEAD anchor at 26% of
// a 192·scale px sprite whose rotation pivot (binding point) sat at 95%.
// v2 world: millimetres on a 600 × 450 mm artboard; stem (x, y) is the
// BINDING POINT; depth is {band, order} instead of raw z.
const V1_CANVAS = { width: 900, height: 640 }
const V1_SPRITE_HEIGHT_PX = 192
const V1_HEAD_TO_BINDING = 0.95 - 0.26

interface V1Stem {
  id: string
  varietyId: string
  colorwayId: string
  x: number
  y: number
  rotation: number
  scale: number
  flipX: boolean
  z: number
}

function migrateV1toV2(v1: Record<string, unknown>): Record<string, unknown> {
  const k = DEFAULT_ARTBOARD.width / V1_CANVAS.width // uniform px → mm
  const yOffset = (DEFAULT_ARTBOARD.height - V1_CANVAS.height * k) / 2

  const stems = (v1.stems as V1Stem[]).map((s): PlacedStem => {
    // v1 rotation pivoted around the binding point, which sat a fixed
    // (unrotated) distance straight below the stored head anchor.
    const bindingYpx = s.y + V1_HEAD_TO_BINDING * V1_SPRITE_HEIGHT_PX * s.scale
    const category = FLOWER_INDEX[s.varietyId]?.category ?? 'filler'
    const band: DepthBand = CATEGORY_BAND[category]
    return {
      id: s.id,
      varietyId: s.varietyId,
      colorwayId: s.colorwayId,
      x: round1(s.x * k),
      y: round1(bindingYpx * k + yOffset),
      rotation: s.rotation,
      // v1 scales were compensating for missing real-world sizes; v2 sizes
      // are physically true, so scale becomes bounded botanical variation.
      scale: clamp(s.scale, STEM_SCALE_MIN, STEM_SCALE_MAX),
      flipX: s.flipX,
      band,
      order: s.z, // preserves relative depth within each band
    }
  })

  const v1Canvas = v1.canvas as { width?: number; height?: number } | undefined
  void v1Canvas

  return {
    ...v1,
    version: 2,
    canvas: undefined,
    artboards: [{ id: 'main', ...DEFAULT_ARTBOARD }],
    stems,
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
