/**
 * The design document is Bloom Studio's core data structure. Every feature —
 * the canvas, the recipe, the learning feedback — derives from it.
 *
 * Format v2: the world unit is the REAL MILLIMETRE. Flowers have true sizes;
 * proportion rules become measurable; recipes stay physically honest. Designs
 * live on cm-true artboards inside an infinite workspace, and depth is
 * organised in named bands (the florist's mental model) instead of raw z.
 * Migration rules live in domain/migrate.ts.
 */
export const DESIGN_DOC_VERSION = 2

/** Depth bands, back → front. The florist's build order is the render order. */
export const DEPTH_BANDS = ['background', 'body', 'focal', 'accents'] as const
export type DepthBand = (typeof DEPTH_BANDS)[number]

export function bandRank(band: DepthBand): number {
  return DEPTH_BANDS.indexOf(band)
}

export const BAND_LABELS: Record<DepthBand, string> = {
  background: 'Background',
  body: 'Body',
  focal: 'Focal',
  accents: 'Accents',
}

/** Composite depth value: band first, fine order within band second. */
export function depthValue(stem: { band: DepthBand; order: number }): number {
  return bandRank(stem.band) * 1_000_000 + stem.order
}

export type PaperOption = 'white' | 'ivory' | 'blush' | 'charcoal'

export interface Artboard {
  id: string
  name: string
  /** World position of the top-left corner, mm. */
  x: number
  y: number
  /** Physical size, mm. */
  width: number
  height: number
  paper: PaperOption
}

/** Default frame: a 600 × 450 mm presentation board. */
export const DEFAULT_ARTBOARD: Omit<Artboard, 'id'> = {
  name: 'Bouquet',
  x: 0,
  y: 0,
  width: 600,
  height: 450,
  paper: 'white',
}

export type StemCategory = 'focal' | 'secondary' | 'filler' | 'line' | 'foliage'

/** Default depth band per design role. Always overridable per stem. */
export const CATEGORY_BAND: Record<StemCategory, DepthBand> = {
  foliage: 'background',
  line: 'background',
  secondary: 'body',
  focal: 'focal',
  filler: 'accents',
}

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
  role: string
  conditioning: string
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
  /** Key into the sketch asset registry. */
  sketch: string
  /** Real visual width of the sprite (bloom + foliage spread) at scale 1, mm. */
  widthMm: number
  education: EducationNotes
}

export interface VesselDef {
  id: string
  name: string
  priceGBP: number
  sketch: string
  /** Real width, mm. Height derives from the artwork's 1.3 aspect ratio. */
  widthMm: number
  mechanics: string
  /** 'behind' = stems render in front (vases); 'front' = vessel overlaps stem bases (wraps). */
  renderMode: 'behind' | 'front'
  education: string
}

export interface PlacedStem {
  id: string
  varietyId: string
  colorwayId: string
  /**
   * World position of the BINDING POINT (where the hand/tie holds the stem),
   * mm. Rotation pivots here, like a spiralled bunch. Head position derives —
   * see domain/geometry.ts.
   */
  x: number
  y: number
  /** Degrees, clockwise. */
  rotation: number
  /** Bounded botanical variation of the real size: 0.85–1.15. */
  scale: number
  flipX: boolean
  band: DepthBand
  /** Fine depth order within the band. */
  order: number
  /**
   * Cluster membership: stems wired together as one textural unit (the real
   * floristry technique). Cluster members select and transform together.
   */
  clusterId?: string
}

export const STEM_SCALE_MIN = 0.85
export const STEM_SCALE_MAX = 1.15

export interface DesignPricing {
  markup: number
  priceOverrides: Record<string, number>
}

export interface DesignDocument {
  version: number
  id: string
  name: string
  createdAt: string
  updatedAt: string
  artboards: Artboard[]
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
