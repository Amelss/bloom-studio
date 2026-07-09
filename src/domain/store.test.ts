import { beforeEach, describe, expect, it } from 'vitest'
import { createStudioStore } from './store'

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

  it('inserts foliage behind existing stems', () => {
    store.getState().addStem('garden-rose')
    store.getState().addStem('eucalyptus')
    const [rose, euc] = store.getState().doc.stems
    expect(euc.z).toBeLessThan(rose.z)
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

  it('duplicate offsets the copy and renders it in front', () => {
    store.getState().addStem('garden-rose')
    const original = store.getState().doc.stems[0]
    store.getState().duplicateSelected()
    const stems = store.getState().doc.stems
    expect(stems).toHaveLength(2)
    const copy = stems.find((s) => s.id !== original.id)!
    expect(copy.x).toBeGreaterThan(original.x)
    expect(copy.z).toBeGreaterThan(original.z)
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

  it('starter template is a complete, teachable design', () => {
    store.getState().newDesign('starter')
    const { doc } = store.getState()
    expect(doc.stems.length).toBeGreaterThanOrEqual(15)
    expect(doc.vesselId).toBe('kraft-wrap')
  })
})
