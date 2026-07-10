import { describe, expect, it } from 'vitest'
import {
  normalizeDeg,
  rotationPatches,
  scalePatches,
  selectionCentroid,
  type GestureSnapshot,
} from './transformGesture'

const stems: GestureSnapshot[] = [
  { id: 'a', x: 100, y: 200, rotation: 0, scale: 1 },
  { id: 'b', x: 200, y: 200, rotation: 30, scale: 1 },
]

describe('selectionCentroid', () => {
  it('is the mean of binding points', () => {
    expect(selectionCentroid(stems)).toEqual({ x: 150, y: 200 })
  })
})

describe('rotationPatches', () => {
  it('rotates positions around the centre and adds the delta to each rotation', () => {
    const patches = rotationPatches(stems, { x: 150, y: 200 }, 90)
    // (100,200) rotated 90° cw around (150,200) → (150, 150)
    expect(patches.a.x).toBeCloseTo(150)
    expect(patches.a.y).toBeCloseTo(150)
    expect(patches.a.rotation).toBe(90)
    expect(patches.b.x).toBeCloseTo(150)
    expect(patches.b.y).toBeCloseTo(250)
    expect(patches.b.rotation).toBe(120)
  })

  it('a single stem rotating around its own binding keeps its position', () => {
    const single = [stems[0]]
    const patches = rotationPatches(single, { x: 100, y: 200 }, 45)
    expect(patches.a.x).toBeCloseTo(100)
    expect(patches.a.y).toBeCloseTo(200)
    expect(patches.a.rotation).toBe(45)
  })

  it('normalizes rotations into (-180, 180]', () => {
    expect(normalizeDeg(190)).toBe(-170)
    expect(normalizeDeg(-190)).toBe(170)
    expect(normalizeDeg(180)).toBe(180)
    expect(normalizeDeg(360)).toBe(0)
  })
})

describe('scalePatches', () => {
  it('spreads positions and scales each stem within bounds', () => {
    const patches = scalePatches(stems, { x: 150, y: 200 }, 1.5)
    expect(patches.a.x).toBeCloseTo(75) // 150 + (100−150)×1.5
    expect(patches.a.scale).toBe(1.15) // clamped botanical bound
    expect(patches.b.x).toBeCloseTo(225)
  })

  it('clamps the position factor so the gesture cannot explode', () => {
    const patches = scalePatches(stems, { x: 150, y: 200 }, 50)
    expect(patches.a.x).toBeCloseTo(150 + (100 - 150) * 2)
  })
})
