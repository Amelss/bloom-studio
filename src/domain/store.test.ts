import { beforeEach, describe, expect, it } from 'vitest'
import { createStudioStore } from './store'
import { depthValue } from './types'

// Fresh, non-persisted store per test.
let store: ReturnType<typeof createStudioStore>

const s = () => store.getState()

beforeEach(() => {
  store = createStudioStore()
  s().newDesign('blank')
})

describe('studio store — basics', () => {
  it('adds a stem and selects it', () => {
    s().addStem('garden-rose')
    const { doc, selectedIds } = s()
    expect(doc.stems).toHaveLength(1)
    expect(doc.stems[0].varietyId).toBe('garden-rose')
    expect(selectedIds).toEqual([doc.stems[0].id])
  })

  it('addStemAt places at the requested point', () => {
    s().addStemAt('peony', 'coral', 120, 80)
    const stem = s().doc.stems[0]
    expect(stem.x).toBe(120)
    expect(stem.y).toBe(80)
    expect(stem.colorwayId).toBe('coral')
  })

  it('assigns depth bands by design role: foliage recedes, focals advance', () => {
    s().addStem('garden-rose')
    s().addStem('eucalyptus')
    const [rose, euc] = s().doc.stems
    expect(rose.band).toBe('focal')
    expect(euc.band).toBe('background')
    expect(depthValue(euc)).toBeLessThan(depthValue(rose))
  })

  it('undo and redo round-trip an add', () => {
    s().addStem('peony')
    s().undo()
    expect(s().doc.stems).toHaveLength(0)
    expect(s().selectedIds).toEqual([])
    s().redo()
    expect(s().doc.stems).toHaveLength(1)
  })

  it('clamps scale to the botanical-variation bounds', () => {
    s().addStem('garden-rose')
    for (let i = 0; i < 10; i++) s().scaleSelected(0.05)
    expect(s().doc.stems[0].scale).toBe(1.15)
    for (let i = 0; i < 20; i++) s().scaleSelected(-0.05)
    expect(s().doc.stems[0].scale).toBe(0.85)
  })

  it('markup and price overrides flow through undo', () => {
    s().setMarkup(4)
    s().setPriceOverride('peony', 5.5)
    expect(s().doc.pricing.priceOverrides.peony).toBe(5.5)
    s().undo()
    expect(s().doc.pricing.priceOverrides.peony).toBeUndefined()
    s().undo()
    expect(s().doc.pricing.markup).toBe(3)
  })

  it('starter template is a true spiral in millimetres', () => {
    s().newDesign('starter')
    const { doc } = s()
    expect(doc.stems.length).toBeGreaterThanOrEqual(15)
    expect(doc.vesselId).toBe('kraft-wrap')
    for (const stem of doc.stems) {
      expect(stem.x).toBeGreaterThan(280)
      expect(stem.x).toBeLessThan(320)
      expect(stem.y).toBeGreaterThan(305)
      expect(stem.y).toBeLessThan(345)
    }
  })
})

describe('studio store — multi-select', () => {
  const addThree = () => {
    s().addStem('garden-rose')
    s().addStem('peony')
    s().addStem('eucalyptus')
    return s().doc.stems.map((st) => st.id)
  }

  it('toggleSelect builds and shrinks the selection', () => {
    const [a, b] = addThree()
    s().setSelection([])
    s().toggleSelect(a)
    s().toggleSelect(b)
    expect(new Set(s().selectedIds)).toEqual(new Set([a, b]))
    s().toggleSelect(a)
    expect(s().selectedIds).toEqual([b])
  })

  it('selectAll skips hidden and locked bands', () => {
    addThree() // rose: focal, peony: focal, euc: background
    s().toggleBandHidden('background')
    s().selectAll()
    expect(s().selectedIds).toHaveLength(2)
    s().toggleBandLocked('focal')
    s().selectAll()
    expect(s().selectedIds).toHaveLength(0)
  })

  it('selectSame targets variety and colourway', () => {
    s().addStemAt('garden-rose', 'blush', 100, 100)
    s().addStemAt('garden-rose', 'blush', 120, 100)
    s().addStemAt('garden-rose', 'cream', 140, 100)
    s().addStemAt('peony', 'pink', 160, 100)
    s().selectSame('garden-rose')
    expect(s().selectedIds).toHaveLength(3)
    s().selectSame('garden-rose', 'blush')
    expect(s().selectedIds).toHaveLength(2)
  })

  it('multi-delete is a single undo step', () => {
    addThree()
    s().selectAll()
    const before = s().doc.stems.length
    s().removeSelected()
    expect(s().doc.stems).toHaveLength(0)
    s().undo()
    expect(s().doc.stems).toHaveLength(before)
  })

  it('a multi-stem gesture commits as one undoable batch', () => {
    addThree()
    s().selectAll()
    const ids = s().selectedIds
    const startXs = s().doc.stems.map((st) => st.x)
    s().beginTransform(ids)
    const patches = Object.fromEntries(
      s().doc.stems.map((st) => [st.id, { x: st.x + 40 }]),
    )
    s().setStemsTransient(patches)
    s().endTransform()
    expect(s().past.at(-1)?.type).toBe('batch')
    s().undo()
    expect(s().doc.stems.map((st) => st.x)).toEqual(startXs)
  })
})

describe('studio store — clusters', () => {
  const buildCluster = () => {
    s().addStemAt('ranunculus', 'pink', 100, 100)
    s().addStemAt('ranunculus', 'pink', 110, 100)
    s().addStemAt('ranunculus', 'pink', 120, 100)
    s().selectAll()
    s().groupSelected()
    return s().doc.stems.map((st) => st.id)
  }

  it('groups the selection under one cluster id', () => {
    buildCluster()
    const clusterIds = new Set(s().doc.stems.map((st) => st.clusterId))
    expect(clusterIds.size).toBe(1)
    expect([...clusterIds][0]).toBeTruthy()
  })

  it('selecting one member selects the whole cluster', () => {
    const ids = buildCluster()
    s().setSelection([])
    s().selectOne(ids[0])
    expect(s().selectedIds).toHaveLength(3)
  })

  it('entering the cluster selects members individually', () => {
    const ids = buildCluster()
    const clusterId = s().doc.stems[0].clusterId!
    s().enterCluster(clusterId, ids[1])
    expect(s().selectedIds).toEqual([ids[1]])
    s().selectOne(ids[2]) // still inside the cluster
    expect(s().selectedIds).toEqual([ids[2]])
  })

  it('ungroup clears cluster membership and is undoable', () => {
    buildCluster()
    s().ungroupSelected()
    expect(s().doc.stems.every((st) => st.clusterId === undefined)).toBe(true)
    s().undo()
    expect(s().doc.stems.every((st) => st.clusterId)).toBe(true)
  })

  it('duplicating a cluster keeps the copies clustered — separately', () => {
    buildCluster()
    const original = s().doc.stems[0].clusterId
    s().duplicateSelected()
    expect(s().doc.stems).toHaveLength(6)
    const copies = s().doc.stems.filter((st) => s().selectedIds.includes(st.id))
    expect(copies).toHaveLength(3)
    const copyCluster = new Set(copies.map((st) => st.clusterId))
    expect(copyCluster.size).toBe(1)
    expect([...copyCluster][0]).not.toBe(original)
  })
})

describe('studio store — depth', () => {
  it('layer moves spill across bands at the edges; band moves cross explicitly', () => {
    s().addStem('garden-rose') // lone focal rose — at both edges of its band
    // Alone in focal, sending it backward spills into the body band behind it.
    s().layerSelected('backward')
    expect(s().doc.stems[0].band).toBe('body')
    // Band moves jump whole bands.
    s().bandSelected('forward')
    expect(s().doc.stems[0].band).toBe('focal')
    s().bandSelected('forward')
    expect(s().doc.stems[0].band).toBe('accents')
    s().bandSelected('forward') // already at the front band
    expect(s().doc.stems[0].band).toBe('accents')
    s().bandSelected('backward')
    expect(s().doc.stems[0].band).toBe('focal')
  })

  it('layer moves stay within a band when the stem is not at its edge', () => {
    s().addStem('garden-rose') // order 0 (back of focal)
    s().addStem('garden-rose') // order 1 (front of focal, selected)
    s().layerSelected('backward') // front rose, not at the back edge → stays focal
    expect(s().doc.stems[s().doc.stems.length - 1].band).toBe('focal')
  })

  it('bring to front / send to back move a stem to the very front / back of the whole stack', () => {
    s().addStem('eucalyptus') // background band
    s().addStem('garden-rose') // focal band
    s().addStem('gypsophila') // accents band (front-most)
    const eucId = s().doc.stems[0].id
    s().selectOne(eucId)
    // Bring to front: lands in the front-most band, on top of its stack.
    s().bringToFront()
    const euc = s().doc.stems.find((x) => x.id === eucId)!
    expect(euc.band).toBe('accents')
    const accents = s().doc.stems.filter((x) => x.band === 'accents').map((x) => x.order)
    expect(euc.order).toBe(Math.max(...accents))
    // Send to back: lands in the back-most band, at the bottom of its stack.
    s().sendToBack()
    const euc2 = s().doc.stems.find((x) => x.id === eucId)!
    expect(euc2.band).toBe('background')
    const bg = s().doc.stems.filter((x) => x.band === 'background').map((x) => x.order)
    expect(euc2.order).toBe(Math.min(...bg))
  })

  it('solo hides every other band, and toggles back', () => {
    s().soloBand('focal')
    expect(new Set(s().hiddenBands)).toEqual(new Set(['background', 'body', 'accents']))
    s().soloBand('focal')
    expect(s().hiddenBands).toEqual([])
  })
})
