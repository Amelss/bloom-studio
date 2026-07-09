import { describe, expect, it } from 'vitest'
import { applyCommand, invertCommand, type Command } from './commands'
import { blankDocument } from './templates'
import type { PlacedStem } from './types'

const stem = (overrides: Partial<PlacedStem> = {}): PlacedStem => ({
  id: 's1',
  varietyId: 'garden-rose',
  colorwayId: 'blush',
  x: 450,
  y: 300,
  rotation: 0,
  scale: 1,
  flipX: false,
  z: 1,
  ...overrides,
})

describe('applyCommand', () => {
  it('adds and removes stems', () => {
    const doc = blankDocument()
    const added = applyCommand(doc, { type: 'add_stem', stem: stem() })
    expect(added.stems).toHaveLength(1)

    const removed = applyCommand(added, { type: 'remove_stem', stem: stem() })
    expect(removed.stems).toHaveLength(0)
  })

  it('patches only the targeted stem', () => {
    let doc = blankDocument()
    doc = applyCommand(doc, { type: 'add_stem', stem: stem() })
    doc = applyCommand(doc, { type: 'add_stem', stem: stem({ id: 's2', x: 100 }) })
    doc = applyCommand(doc, {
      type: 'update_stem',
      stemId: 's2',
      next: { x: 200, rotation: 15 },
      prev: { x: 100, rotation: 0 },
    })
    expect(doc.stems.find((s) => s.id === 's1')?.x).toBe(450)
    expect(doc.stems.find((s) => s.id === 's2')?.x).toBe(200)
    expect(doc.stems.find((s) => s.id === 's2')?.rotation).toBe(15)
  })

  it('sets and clears price overrides', () => {
    let doc = blankDocument()
    doc = applyCommand(doc, { type: 'set_price_override', varietyId: 'peony', next: 5.2, prev: null })
    expect(doc.pricing.priceOverrides.peony).toBe(5.2)
    doc = applyCommand(doc, { type: 'set_price_override', varietyId: 'peony', next: null, prev: 5.2 })
    expect(doc.pricing.priceOverrides.peony).toBeUndefined()
  })
})

describe('invertCommand', () => {
  const cases: Command[] = [
    { type: 'add_stem', stem: stem({ id: 's-new' }) },
    { type: 'remove_stem', stem: stem() },
    { type: 'update_stem', stemId: 's1', next: { x: 10, scale: 1.2 }, prev: { x: 450, scale: 1 } },
    { type: 'set_vessel', next: 'compote', prev: null },
    { type: 'set_markup', next: 4, prev: 3 },
    { type: 'set_price_override', varietyId: 'peony', next: 5, prev: null },
    { type: 'rename', next: 'Renamed design', prev: 'Untitled design' },
  ]

  it.each(cases.map((c) => [c.type, c] as const))(
    'apply → invert → apply restores the document (%s)',
    (_type, cmd) => {
      let doc = blankDocument()
      // Seed a stem so update/remove have something to act on.
      doc = applyCommand(doc, { type: 'add_stem', stem: stem() })
      const before = structuredClone(doc)
      const after = applyCommand(doc, cmd)
      const restored = applyCommand(after, invertCommand(cmd))
      // remove_stem/add_stem may reorder the array; compare as sets by id.
      expect(new Set(restored.stems.map((s) => s.id))).toEqual(new Set(before.stems.map((s) => s.id)))
      expect(restored.pricing).toEqual(before.pricing)
      expect(restored.vesselId).toEqual(before.vesselId)
      expect(restored.name).toEqual(before.name)
    },
  )

  it('double inversion is the original command', () => {
    for (const cmd of cases) {
      expect(invertCommand(invertCommand(cmd))).toEqual(cmd)
    }
  })
})
