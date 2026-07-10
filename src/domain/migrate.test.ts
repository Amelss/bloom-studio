import { describe, expect, it } from 'vitest'
import { migrateDocument } from './migrate'
import { blankDocument } from './templates'
import { DESIGN_DOC_VERSION } from './types'

/** A representative v1 document (px world, head-anchored stems, raw z). */
function v1Doc() {
  return {
    version: 1,
    id: 'v1-doc',
    name: 'Old design',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    canvas: { width: 900, height: 640 },
    vesselId: 'kraft-wrap',
    stems: [
      // Head anchor at canvas centre-ish, scale 1, z 5 — a focal rose.
      { id: 'a', varietyId: 'garden-rose', colorwayId: 'blush', x: 450, y: 300, rotation: -10, scale: 1, flipX: false, z: 5 },
      // Foliage with the old oversized default scale and a low z.
      { id: 'b', varietyId: 'eucalyptus', colorwayId: 'silver', x: 300, y: 298, rotation: -26, scale: 1.2, flipX: false, z: 1 },
    ],
    pricing: { markup: 3, priceOverrides: { peony: 5 } },
  }
}

describe('migrateDocument v1 → v2', () => {
  it('converts to millimetres on the default artboard', () => {
    const doc = migrateDocument(v1Doc())
    expect(doc.version).toBe(DESIGN_DOC_VERSION)
    expect(doc.artboards).toHaveLength(1)
    expect(doc.artboards[0].width).toBe(600)
    expect(doc.artboards[0].paper).toBe('white')

    const rose = doc.stems.find((s) => s.id === 'a')!
    // x: 450 px × (600/900) = 300 mm.
    expect(rose.x).toBe(300)
    // y: head 300 px + binding offset (0.69 × 192 × 1) px, × 2/3, + vertical
    // centring offset (450 − 640×2/3)/2 — lands inside the artboard.
    expect(rose.y).toBeGreaterThan(280)
    expect(rose.y).toBeLessThan(320)
    expect(rose.rotation).toBe(-10)
  })

  it('assigns depth bands from design roles and preserves order via z', () => {
    const doc = migrateDocument(v1Doc())
    const rose = doc.stems.find((s) => s.id === 'a')!
    const euc = doc.stems.find((s) => s.id === 'b')!
    expect(rose.band).toBe('focal')
    expect(euc.band).toBe('background')
    expect(rose.order).toBe(5)
    expect(euc.order).toBe(1)
  })

  it('clamps legacy scales into the botanical-variation bounds', () => {
    const doc = migrateDocument(v1Doc())
    expect(doc.stems.find((s) => s.id === 'b')!.scale).toBe(1.15)
  })

  it('preserves pricing, vessel, and identity fields', () => {
    const doc = migrateDocument(v1Doc())
    expect(doc.vesselId).toBe('kraft-wrap')
    expect(doc.pricing.priceOverrides.peony).toBe(5)
    expect(doc.name).toBe('Old design')
  })

  it('passes current-version documents through untouched', () => {
    const current = blankDocument('Fresh')
    expect(migrateDocument(structuredClone(current))).toEqual(current)
  })

  it('rejects documents from a newer format version', () => {
    expect(() => migrateDocument({ version: 99, stems: [] })).toThrow(/newer version/)
  })

  it('rejects non-documents', () => {
    expect(() => migrateDocument('nonsense')).toThrow()
    expect(() => migrateDocument({ foo: 1 })).toThrow()
  })
})
