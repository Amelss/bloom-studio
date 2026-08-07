import type { DesignDocument, StemCategory } from '../domain/types'
import { FLOWER_INDEX, VESSEL_INDEX } from '../data/catalog'
import { buildRecipe } from '../domain/recipe'
import { headPosition, vesselRimY, VESSEL_ASPECT } from '../domain/geometry'
import {
  computeBalancePoint,
  uniqueHues,
  circularSpan,
  hasComplementaryPair,
  meanDepth,
} from './insights'

/**
 * A structured, machine-readable summary of a design — the shared substrate for
 * both the live insights ([analyzeDesign]) and the exercise/brief scoring
 * ([evaluateBrief]). Computing one metrics object per design means feedback and
 * grading always agree, and new exercises are just predicates over these fields.
 */
export type PaletteType = 'mono' | 'analogous' | 'complementary' | 'busy' | 'none'

export interface DesignMetrics {
  stemCount: number
  byCategory: Partial<Record<StemCategory, number>>
  /** Foliage stems as a fraction of the whole (0–1). */
  foliageRatio: number
  focalCount: number
  focalRatio: number
  /** Horizontal visual lean, −1 (left) … +1 (right); null until enough stems. */
  balanceLean: number | null
  paletteType: PaletteType
  /** Circular hue spread in degrees, null with fewer than two coloured stems. */
  hueSpan: number | null
  /** Distinct varieties — a proxy for textural variety. */
  varietyCount: number
  /** Arrangement height ÷ vessel height (upright vessels only), else null. */
  proportionRatio: number | null
  /** True when foliage recedes behind the focal blooms on average; null if N/A. */
  depthOk: boolean | null
  /** Material cost (flowers + vessel), GBP. */
  materialCost: number
  vesselId: string | null
}

export function computeMetrics(doc: DesignDocument): DesignMetrics {
  const stems = doc.stems
  const stemCount = stems.length

  const byCategory: Partial<Record<StemCategory, number>> = {}
  for (const s of stems) {
    const cat = FLOWER_INDEX[s.varietyId]?.category ?? 'filler'
    byCategory[cat] = (byCategory[cat] ?? 0) + 1
  }
  const focalCount = byCategory.focal ?? 0
  const foliageCount = byCategory.foliage ?? 0

  const balance = computeBalancePoint(doc)

  const hues = uniqueHues(doc)
  const hueSpan = hues.length >= 2 ? circularSpan(hues) : null
  let paletteType: PaletteType = 'none'
  if (hueSpan != null) {
    if (hueSpan <= 30) paletteType = 'mono'
    else if (hueSpan <= 100) paletteType = 'analogous'
    else if (hasComplementaryPair(hues)) paletteType = 'complementary'
    else paletteType = 'busy'
  }

  const varietyCount = new Set(stems.map((s) => s.varietyId)).size

  // Proportion — only meaningful for upright vessels (stems rise out of a rim).
  let proportionRatio: number | null = null
  const vessel = doc.vesselId ? VESSEL_INDEX[doc.vesselId] : null
  const artboard = doc.artboards[0]
  if (vessel && vessel.renderMode === 'behind' && stemCount >= 1 && artboard) {
    const rimY = vesselRimY(vessel, artboard)
    const vesselHeight = vessel.widthMm / (vessel.aspect ?? VESSEL_ASPECT)
    const highestBloom = Math.min(
      ...stems.map((s) => {
        const v = FLOWER_INDEX[s.varietyId]
        return v ? headPosition(s, v).y : s.y
      }),
    )
    proportionRatio = vesselHeight > 0 ? Math.max(0, rimY - highestBloom) / vesselHeight : null
  }

  const focalZ = meanDepth(doc, 'focal')
  const foliageZ = meanDepth(doc, 'foliage')
  const depthOk = focalZ != null && foliageZ != null ? foliageZ <= focalZ : null

  return {
    stemCount,
    byCategory,
    foliageRatio: stemCount ? foliageCount / stemCount : 0,
    focalCount,
    focalRatio: stemCount ? focalCount / stemCount : 0,
    balanceLean: balance ? balance.lean : null,
    paletteType,
    hueSpan,
    varietyCount,
    proportionRatio,
    depthOk,
    materialCost: buildRecipe(doc).materialCost,
    vesselId: doc.vesselId,
  }
}
