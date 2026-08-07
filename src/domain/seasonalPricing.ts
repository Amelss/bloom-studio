import type { Season } from './types'

/**
 * Month-by-month wholesale price index per variety (Jan = index 0 … Dec = 11).
 * Each number multiplies the variety's in-season guide price (`guidePriceGBP`,
 * the 1.0 anchor). It encodes real UK cut-flower seasonality: peak-season months
 * sit at ~1.0; imported / shoulder months lift; scarce deep-off-season months
 * carry an import premium. Foliage and true year-round stems stay flat.
 *
 * Grounded in published UK wholesale availability windows (peony Apr–mid-Jun,
 * peak May; ranunculus Jan–May; hydrangea/dahlia/lily/sunflower summer–autumn;
 * gypsophila & foliage year-round), from:
 *  - Triangle Nursery flower guides (trianglenursery.co.uk)
 *  - Flowers Box London "seasonal flowers by month"
 *  - Plants & Flowers Foundation Holland monthly flower calendar
 * These are teaching guide figures, not a live price feed — see docs/pricing.
 */
export const SEASONAL_INDEX: Record<string, number[]> = {
  // focal
  'garden-rose': [1.05, 1.3, 1.05, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.15], // imported year-round, Valentine's spike
  peony: [2.6, 2.6, 2.0, 1.2, 1.0, 1.0, 1.3, 2.2, 2.6, 2.6, 2.4, 2.4], // UK Apr–Jun; rare/pricey otherwise
  dahlia: [2.4, 2.4, 2.2, 1.9, 1.5, 1.2, 1.0, 1.0, 1.0, 1.05, 1.6, 2.2], // UK Jul–Oct
  gerbera: [1.05, 1.05, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.1], // imported year-round
  lily: [1.15, 1.15, 1.1, 1.05, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.1, 1.2], // imported year-round, summer peak
  sunflower: [2.0, 2.0, 1.8, 1.5, 1.2, 1.05, 1.0, 1.0, 1.0, 1.3, 1.7, 2.0], // UK Jul–Sep
  // secondary
  ranunculus: [1.3, 1.0, 1.0, 1.0, 1.2, 2.0, 2.4, 2.4, 2.2, 1.8, 1.5, 1.3], // UK Jan–May
  lisianthus: [1.2, 1.2, 1.1, 1.05, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.15, 1.2], // imported year-round, summer peak
  carnation: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], // year-round, stable
  hydrangea: [1.5, 1.5, 1.4, 1.2, 1.05, 1.0, 1.0, 1.0, 1.0, 1.1, 1.35, 1.5], // UK Jun–Oct
  // line
  delphinium: [1.8, 1.8, 1.4, 1.15, 1.0, 1.0, 1.0, 1.0, 1.1, 1.4, 1.7, 1.9], // UK Jun–Aug
  snapdragon: [1.4, 1.4, 1.25, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.25, 1.4], // UK Jun–Oct
  stock: [1.25, 1.15, 1.0, 1.0, 1.0, 1.0, 1.05, 1.3, 1.5, 1.5, 1.4, 1.3], // UK spring–summer, winter wedding imports
  // filler
  gypsophila: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], // year-round
  astilbe: [1.7, 1.7, 1.5, 1.3, 1.1, 1.0, 1.0, 1.0, 1.15, 1.4, 1.6, 1.7], // UK Jun–Aug
  // foliage
  eucalyptus: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05, 1.15], // year-round, Christmas demand
  ruscus: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.05], // year-round
  leatherleaf: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], // year-round
}

/** Coarse fallback for varieties not yet in the monthly table (matches the old model). */
const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter']
export function monthToSeason(month: number): Season {
  const m = ((month % 12) + 12) % 12
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'autumn'
  return 'winter'
}
function coarseSeasonMultiplier(seasons: Season[], month: number): number {
  if (seasons.includes('year-round')) return 1
  const now = monthToSeason(month)
  if (seasons.includes(now)) return 1
  const i = SEASON_ORDER.indexOf(now)
  const adjacent = [SEASON_ORDER[(i + 1) % 4], SEASON_ORDER[(i + 3) % 4]]
  return seasons.some((s) => adjacent.includes(s)) ? 1.6 : 2.5
}

/**
 * Seasonal multiplier on a variety's in-season guide price for a given month
 * (0–11). Uses the real monthly table when available, else the coarse
 * season-based fallback.
 */
export function seasonalMultiplier(varietyId: string, seasons: Season[], month: number): number {
  const table = SEASONAL_INDEX[varietyId]
  if (table) return table[((month % 12) + 12) % 12]
  return coarseSeasonMultiplier(seasons, month)
}
