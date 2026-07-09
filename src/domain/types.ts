/**
 * The design document is Bloom Studio's core data structure. Every feature —
 * the canvas, the recipe, the learning feedback — derives from it. It is
 * explicitly versioned from day one so files remain openable as the format
 * evolves (see docs/ARCHITECTURE.md for migration rules).
 */
export const DESIGN_DOC_VERSION = 1

export const CANVAS_WIDTH = 900
export const CANVAS_HEIGHT = 640

export type StemCategory = 'focal' | 'secondary' | 'filler' | 'line' | 'foliage'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'year-round'

export type Fragility = 'low' | 'medium' | 'high'

export interface Colorway {
  id: string
  name: string
  /** Main petal colour (hex). */
  petal: string
  /** Shading/centre colour (hex). */
  accent: string
  /** Hue in degrees (0–360) used for colour-harmony analysis. */
  hue: number
  /** Whites/creams/greens are excluded from harmony analysis. */
  neutral?: boolean
}

export interface EducationNotes {
  /** What job this flower does in a design (focal, mass, line…). */
  role: string
  /** Real-world conditioning/handling guidance. */
  conditioning: string
  /** A practical design tip specific to this variety. */
  designTip: string
}

export interface FlowerVariety {
  id: string
  commonName: string
  botanicalName: string
  category: StemCategory
  colorways: Colorway[]
  /** Typical wholesale price per stem, GBP. Users can override per design. */
  guidePriceGBP: number
  seasons: Season[]
  stemLengthCm: number
  fragility: Fragility
  /** Key into the sketch asset registry (placeholder art until the photo pipeline lands in M2). */
  sketch: string
  education: EducationNotes
}

export interface VesselDef {
  id: string
  name: string
  priceGBP: number
  sketch: string
  /** Suggested mechanics shown in the recipe output. */
  mechanics: string
  /** 'behind' = stems render in front (vases); 'front' = vessel overlaps stem bases (wraps). */
  renderMode: 'behind' | 'front'
  education: string
}

export interface PlacedStem {
  id: string
  varietyId: string
  colorwayId: string
  /** Design-space coordinates of the bloom head centre. */
  x: number
  y: number
  /** Degrees; pivots around the stem base ("binding point"), like a real spiral. */
  rotation: number
  scale: number
  flipX: boolean
  /** Depth: higher renders in front. Fractional values allowed. */
  z: number
}

export interface DesignPricing {
  /** Retail markup multiplier applied to material cost (2–4× is industry-typical). */
  markup: number
  /** Per-variety wholesale price overrides, GBP per stem. */
  priceOverrides: Record<string, number>
}

export interface DesignDocument {
  version: number
  id: string
  name: string
  createdAt: string
  updatedAt: string
  canvas: { width: number; height: number }
  vesselId: string | null
  stems: PlacedStem[]
  pricing: DesignPricing
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
