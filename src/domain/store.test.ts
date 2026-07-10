import { beforeEach, describe, expect, it } from 'vitest'
import { createStudioStore } from './store'
import { depthValue } from './types'

// Fresh, non-persisted store per test.
let store: ReturnType<typeof createStudioStore>

beforeEach(() => {
  store = createStudioStore()
  store.getState().newDesign('blank')
})

describe('studio store', () => {
  it('adds a stem and selects it', () => {
    store.getState().addStem('garden-rose')
    const { doc, selectedId } = store.getState()
    expect(doc.stems).toHaveLength(1)
    expect(doc.stems[0].varietyId).toBe('garden-rose')
    expect(selectedId).toBe(doc.stems[0].id)
  })

  it('assigns depth bands by design role: foliage recedes, focals advance', () => {
    store.getState().addStem('garden-rose')
    store.getState().addStem('eucalyptus')
    const [rose, euc] = store.getState().doc.stems
    expect(rose.band).toBe('focal')
    expect(euc.band).toBe('background')
    expect(depthValue(euc)).toBeLessThan(depthValue(rose))
  })

  it('undo and redo round-trip an add', () => {
    store.getState().addStem('peony')
    expect(store.getState().doc.stems).toHaveLength(1)

    store.getState().undo()
    expect(store.getState().doc.stems).toHaveLength(0)
    expect(store.getState().selectedId).toBeNull()

    store.getState().redo()
    expect(store.getState().doc.stems).toHaveLength(1)
    expect(store.getState().doc.stems[0].varietyId).toBe('peony')
  })

  it('commits a drag gesture as a single undoable command', () => {
    store.getState().addStem('garden-rose')
    const id = store.getState().doc.stems[0].id
    const originalX = store.getState().doc.stems[0].x

    store.getState().beginTransform(id)
    store.getState().setStemTransient(id, { x: originalX + 5 })
    store.getState().setStemTransient(id, { x: originalX + 50 })
    store.getState().endTransform(id)

    expect(store.getState().doc.stems[0].x).toBe(originalX + 50)
    // add + drag = exactly two history entries; one undo restores position.
    expect(store.getState().past).toHaveLength(2)
    store.getState().undo()
    expect(store.getState().doc.stems[0].x).toBe(originalX)
  })

  it('does not record history for a no-op drag', () => {
    store.getState().addStem('garden-rose')
    const id = store.getState().doc.stems[0].id
    store.getState().beginTransform(id)
    store.getState().endTransform(id)
    expect(store.getState().past).toHaveLength(1) // just the add
  })

  it('a new action clears the redo stack', () => {
    store.getState().addStem('garden-rose')
    store.getState().undo()
    expect(store.getState().future).toHaveLength(1)
    store.getState().addStem('peony')
    expect(store.getState().future).toHaveLength(0)
  })

  it('duplicate offsets the copy and renders it in front within its band', () => {
    store.getState().addStem('garden-rose')
    const original = store.getState().doc.stems[0]
    store.getState().duplicateSelected()
    const stems = store.getState().doc.stems
    expect(stems).toHaveLength(2)
    const copy = stems.find((s) => s.id !== original.id)!
    expect(copy.x).toBeGreaterThan(original.x)
    expect(copy.band).toBe(original.band)
    expect(copy.order).toBeGreaterThan(original.order)
  })

  it('layer moves stay inside the band; band moves cross it', () => {
    store.getState().addStem('garden-rose')
    const id = store.getState().doc.stems[0].id
    store.getState().select(id)

    store.getState().layerSelected('backward')
    expect(store.getState().doc.stems[0].band).toBe('focal')

    store.getState().bandSelected('forward')
    expect(store.getState().doc.stems[0].band).toBe('accents')
    store.getState().bandSelected('forward') // already at the front band
    expect(store.getState().doc.stems[0].band).toBe('accents')

    store.getState().bandSelected('backward')
    expect(store.getState().doc.stems[0].band).toBe('focal')
  })

  it('clamps scale to the botanical-variation bounds', () => {
    store.getState().addStem('garden-rose')
    for (let i = 0; i < 10; i++) store.getState().scaleSelected(0.05)
    expect(store.getState().doc.stems[0].scale).toBe(1.15)
    for (let i = 0; i < 20; i++) store.getState().scaleSelected(-0.05)
    expect(store.getState().doc.stems[0].scale).toBe(0.85)
  })

  it('markup and price overrides flow through undo', () => {
    store.getState().setMarkup(4)
    expect(store.getState().doc.pricing.markup).toBe(4)
    store.getState().setPriceOverride('peony', 5.5)
    expect(store.getState().doc.pricing.priceOverrides.peony).toBe(5.5)
    store.getState().undo()
    expect(store.getState().doc.pricing.priceOverrides.peony).toBeUndefined()
    store.getState().undo()
    expect(store.getState().doc.pricing.markup).toBe(3)
  })

  it('starter template is a complete, teachable design in millimetres', () => {
    store.getState().newDesign('starter')
    const { doc } = store.getState()
    expect(doc.stems.length).toBeGreaterThanOrEqual(15)
    expect(doc.vesselId).toBe('kraft-wrap')
    expect(doc.artboards[0].width).toBe(600)
    // A true spiral: every binding point sits in the hand's grip zone.
    for (const stem of doc.stems) {
      expect(stem.x).toBeGreaterThan(280)
      expect(stem.x).toBeLessThan(320)
      expect(stem.y).toBeGreaterThan(305)
      expect(stem.y).toBeLessThan(345)
    }
  })
})
