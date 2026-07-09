import type { DesignDocument, StemCategory } from '../domain/types'
import { FLOWER_INDEX, VESSEL_INDEX, getColorway } from '../data/catalog'

/**
 * The live feedback engine — the educational heart of Bloom Studio.
 *
 * Because a design is structured data (which stems, how many, where, at what
 * depth), design-principle feedback can be *computed*, not guessed: visual
 * balance from the weighted distribution of blooms, colour harmony from hue
 * spread, dominance from the focal ratio, depth from z-ordering. Every
 * insight links to the principle it comes from, so students learn the "why"
 * while they design.
 */

export type InsightTone = 'positive' | 'tip' | 'watch'

export interface Insight {
  id: string
  principleId: string
  tone: InsightTone
  title: string
  body: string
}

const VISUAL_WEIGHT: Record<StemCategory, number> = {
  focal: 3,
  secondary: 2,
  line: 1.5,
  filler: 1,
  foliage: 1,
}

export function analyzeDesign(doc: DesignDocument): Insight[] {
  const insights: Insight[] = []
  const stems = doc.stems

  if (stems.length === 0) {
    insights.push({
      id: 'empty-canvas',
      principleId: 'process',
      tone: 'tip',
      title: 'Start with a foliage skeleton',
      body: 'Professional designs are built in layers: foliage first to set the silhouette, then mass flowers, then focals, then filler. Add 5–7 foliage stems to define your outline.',
    })
    return insights
  }

  const byCategory = countByCategory(stems.map((s) => FLOWER_INDEX[s.varietyId]?.category ?? 'filler'))

  // Build order: flowers placed but no foliage base yet.
  if ((byCategory.foliage ?? 0) === 0 && stems.length >= 3) {
    insights.push({
      id: 'no-foliage',
      principleId: 'process',
      tone: 'tip',
      title: 'No foliage base yet',
      body: 'You have flowers but no foliage. A foliage skeleton sets the silhouette, supports the blooms, and stretches the budget — most designs are 30–50% foliage.',
    })
  }

  // Visual balance: weighted horizontal centre of mass.
  if (stems.length >= 5) {
    const cx = doc.canvas.width / 2
    let weighted = 0
    let totalWeight = 0
    for (const stem of stems) {
      const category = FLOWER_INDEX[stem.varietyId]?.category ?? 'filler'
      const weight = VISUAL_WEIGHT[category] * stem.scale
      weighted += weight * (stem.x - cx)
      totalWeight += weight
    }
    const lean = weighted / (totalWeight * (doc.canvas.width / 2))
    if (Math.abs(lean) <= 0.12) {
      insights.push({
        id: 'balance-good',
        principleId: 'balance',
        tone: 'positive',
        title: 'Visually balanced',
        body: 'The visual weight of your blooms is evenly resolved around the central axis — the design reads as stable.',
      })
    } else if (Math.abs(lean) <= 0.3) {
      const side = lean > 0 ? 'right' : 'left'
      insights.push({
        id: 'balance-asym',
        principleId: 'balance',
        tone: 'tip',
        title: `Asymmetrical balance (weighted ${side})`,
        body: `Your visual weight sits to the ${side}. Asymmetry can be beautiful when it looks deliberate — counterweight the opposite side with a smaller cluster placed slightly lower, or lean into the diagonal.`,
      })
    } else {
      const side = lean > 0 ? 'right' : 'left'
      insights.push({
        id: 'balance-lean',
        principleId: 'balance',
        tone: 'watch',
        title: `Design is leaning ${side}`,
        body: `Most of the visual weight is on the ${side} side. Unless you are building a deliberate crescent or diagonal, move or add material on the other side to resolve the balance.`,
      })
    }
  }

  // Dominance / focal point.
  const focalCount = byCategory.focal ?? 0
  if (focalCount === 0 && stems.length >= 6) {
    insights.push({
      id: 'no-focal',
      principleId: 'dominance',
      tone: 'tip',
      title: 'No focal flower yet',
      body: 'The design has no clear place for the eye to land. Add 1–3 focal blooms (garden rose, peony) low and slightly off-centre to anchor the composition.',
    })
  } else if (focalCount > 0) {
    const focalRatio = focalCount / stems.length
    if (focalRatio > 0.45) {
      insights.push({
        id: 'focal-heavy',
        principleId: 'dominance',
        tone: 'watch',
        title: 'All stars, no supporting cast',
        body: `${Math.round(focalRatio * 100)}% of your stems are focal blooms. When everything demands attention, nothing leads. Recess some, or swap a few for secondary flowers and texture.`,
      })
    } else if (focalCount % 2 === 0 && focalCount <= 6) {
      insights.push({
        id: 'focal-even',
        principleId: 'dominance',
        tone: 'tip',
        title: `${focalCount} focal blooms — try an odd number`,
        body: 'Even numbers of focal flowers tend to pair off into static rows. Odd counts (1, 3, 5) are easier to compose into a natural triangle or sweep.',
      })
    } else {
      insights.push({
        id: 'focal-good',
        principleId: 'dominance',
        tone: 'positive',
        title: 'Clear focal presence',
        body: `${focalCount} focal ${focalCount === 1 ? 'bloom gives' : 'blooms give'} the eye somewhere to land, supported by the rest of the design.`,
      })
    }
  }

  // Colour harmony from hue spread of non-neutral petals.
  const hues = uniqueHues(doc)
  if (hues.length >= 2) {
    const span = circularSpan(hues)
    const hasComplement = hasComplementaryPair(hues)
    if (span <= 30) {
      insights.push({
        id: 'colour-mono',
        principleId: 'colour',
        tone: 'positive',
        title: 'Monochromatic palette',
        body: 'Your colours sit within one hue family — an elegant, cohesive scheme. Vary tints and depths within the hue so it doesn\'t flatten.',
      })
    } else if (span <= 100) {
      insights.push({
        id: 'colour-analogous',
        principleId: 'colour',
        tone: 'positive',
        title: 'Analogous palette',
        body: 'Your hues are neighbours on the colour wheel — the workhorse scheme of wedding work. Harmonious by construction; add tonal depth for interest.',
      })
    } else if (hasComplement) {
      insights.push({
        id: 'colour-complementary',
        principleId: 'colour',
        tone: 'tip',
        title: 'Complementary contrast',
        body: 'You have near-opposite hues in play — bold and energetic. Keep one side of the pairing clearly dominant and use the other as the accent, or they will fight.',
      })
    } else {
      insights.push({
        id: 'colour-busy',
        principleId: 'colour',
        tone: 'watch',
        title: 'Palette may read as busy',
        body: 'Your hues are spread widely without a clear scheme. Try naming the palette ("analogous blush-to-terracotta") and removing whichever colour doesn\'t belong to it.',
      })
    }
  }

  // Proportion: arrangement height vs vessel height (upright vessels only).
  const vessel = doc.vesselId ? VESSEL_INDEX[doc.vesselId] : null
  if (vessel && vessel.renderMode === 'behind' && stems.length >= 3) {
    // Vessel geometry constants match VesselSprite in the canvas renderer.
    const vesselTop = doc.canvas.height - 150
    const vesselHeight = 140
    const highestBloom = Math.min(...stems.map((s) => s.y))
    const arrangementHeight = Math.max(0, vesselTop - highestBloom)
    const ratio = arrangementHeight / vesselHeight
    if (ratio >= 1.3 && ratio <= 2.2) {
      insights.push({
        id: 'proportion-good',
        principleId: 'proportion',
        tone: 'positive',
        title: 'Classic proportions',
        body: `Your arrangement stands about ${ratio.toFixed(1)}× the height of the vessel — right in the classical 1.5–2× range.`,
      })
    } else if (ratio < 1.3) {
      insights.push({
        id: 'proportion-squat',
        principleId: 'proportion',
        tone: 'tip',
        title: 'Arrangement sits low in the vessel',
        body: `The flowers stand about ${ratio.toFixed(1)}× the vessel height; the classical guideline is 1.5–2×. Lift some line material higher — or commit fully to a low, lush "meadow" style.`,
      })
    } else {
      insights.push({
        id: 'proportion-tall',
        principleId: 'proportion',
        tone: 'tip',
        title: 'Very tall for this vessel',
        body: `At roughly ${ratio.toFixed(1)}× the vessel height the design may feel top-heavy (and physically tip). Widen the base or shorten the tallest stems.`,
      })
    }
  }

  // Depth: foliage should sit behind focal blooms on average.
  const focalZ = meanZ(doc, 'focal')
  const foliageZ = meanZ(doc, 'foliage')
  if (focalZ != null && foliageZ != null) {
    if (foliageZ > focalZ) {
      insights.push({
        id: 'depth-foliage-front',
        principleId: 'depth',
        tone: 'tip',
        title: 'Greenery is covering your focal blooms',
        body: 'Your foliage sits in front of the focal flowers in the layer order. Recess it (send backward) so the hero blooms advance — depth is what separates professional work from flat collage.',
      })
    } else {
      insights.push({
        id: 'depth-good',
        principleId: 'depth',
        tone: 'positive',
        title: 'Good depth layering',
        body: 'Foliage recedes behind the focal blooms, which advance — the design reads as three-dimensional.',
      })
    }
  }

  return insights
}

function countByCategory(categories: StemCategory[]): Partial<Record<StemCategory, number>> {
  const counts: Partial<Record<StemCategory, number>> = {}
  for (const c of categories) counts[c] = (counts[c] ?? 0) + 1
  return counts
}

function uniqueHues(doc: DesignDocument): number[] {
  const hues = new Set<number>()
  for (const stem of doc.stems) {
    const variety = FLOWER_INDEX[stem.varietyId]
    if (!variety || variety.category === 'foliage') continue
    const colorway = getColorway(stem.varietyId, stem.colorwayId)
    if (colorway && !colorway.neutral) hues.add(colorway.hue)
  }
  return [...hues]
}

/** Smallest arc that contains all hues (360 − largest gap between neighbours). */
function circularSpan(hues: number[]): number {
  if (hues.length < 2) return 0
  const sorted = [...hues].sort((a, b) => a - b)
  let maxGap = 360 - sorted[sorted.length - 1] + sorted[0]
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1])
  }
  return 360 - maxGap
}

function hasComplementaryPair(hues: number[]): boolean {
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      let diff = Math.abs(hues[i] - hues[j])
      if (diff > 180) diff = 360 - diff
      if (diff >= 150) return true
    }
  }
  return false
}

function meanZ(doc: DesignDocument, category: StemCategory): number | null {
  const zs = doc.stems
    .filter((s) => FLOWER_INDEX[s.varietyId]?.category === category)
    .map((s) => s.z)
  if (zs.length === 0) return null
  return zs.reduce((a, b) => a + b, 0) / zs.length
}
