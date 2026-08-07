import type { FlowerVariety, VesselDef } from '../domain/types'
import catalogData from './catalog.data.json'

/**
 * Flower catalog. Variety + colourway data is GENERATED from the Supabase
 * `varieties` / `variety_colorways` tables into `catalog.data.json`
 * (`npm run assets:catalog` → scripts/generate-catalog.mjs): the database is the
 * source of truth, so do NOT hand-edit `catalog.data.json` — edit the DB and
 * regenerate. We generate at build time rather than fetch at runtime so the
 * catalog stays bundled and instant, which the offline-first classroom
 * constraint requires (docs/ASSET-CLOUD.md). Vessels remain in code below —
 * there is no vessel table yet.
 */
export const FLOWER_CATALOG = (catalogData as unknown as { varieties: FlowerVariety[] }).varieties

export const VESSEL_CATALOG: VesselDef[] = [
  {
    id: 'kraft-wrap',
    name: 'Hand-Tied Wrap',
    priceGBP: 2.5,
    sketch: 'wrap',
    // Photographic kraft + patterned bouquet wrap (public/vessels/), split into
    // two layers so the flowers nestle inside it: `photoBack` renders behind the
    // stems, `photoFront` (the front lip + ribbon) in front. The `wrap` sketch
    // above stays as the offline fallback. aspect = 768/910.
    photoBack: '/vessels/kraft-wrap-back.png',
    photoFront: '/vessels/kraft-wrap-front.png',
    widthMm: 240,
    aspect: 0.844,
    mechanics: 'Hand-tied spiral, twine bind, kraft wrap',
    renderMode: 'front',
    education:
      'The hand-tied spiral is the foundational bouquet technique: every stem added at the same angle around a central binding point, so the bouquet stands on its own stems.',
  },
  {
    id: 'compote',
    name: 'Footed Compote Bowl',
    priceGBP: 8,
    sketch: 'compote',
    widthMm: 210,
    mechanics: 'Chicken-wire pillow + pot tape (foam-free)',
    renderMode: 'behind',
    education:
      'Compote designs use a low, footed bowl with chicken wire mechanics — the modern, sustainable alternative to floral foam, and the default for garden-style centrepieces.',
  },
]

export const FLOWER_INDEX: Record<string, FlowerVariety> = Object.fromEntries(
  FLOWER_CATALOG.map((f) => [f.id, f]),
)

export const VESSEL_INDEX: Record<string, VesselDef> = Object.fromEntries(
  VESSEL_CATALOG.map((v) => [v.id, v]),
)

export function getColorway(varietyId: string, colorwayId: string) {
  const variety = FLOWER_INDEX[varietyId]
  return variety?.colorways.find((c) => c.id === colorwayId) ?? variety?.colorways[0]
}
