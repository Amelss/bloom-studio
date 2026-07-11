import { describe, expect, it } from 'vitest'
import { BrushSampler } from './brush'

const params = { spacingMm: 50, spreadMm: 10, rotationJitterDeg: 20 }

describe('BrushSampler', () => {
  it('places a stem immediately at the stroke start', () => {
    const sampler = new BrushSampler(params, 7)
    const first = sampler.addPoint(100, 100)
    expect(first).toHaveLength(1)
    expect(Math.hypot(first[0].x - 100, first[0].y - 100)).toBeLessThanOrEqual(params.spreadMm)
  })

  it('spaces placements along the stroke at the requested density', () => {
    const sampler = new BrushSampler(params, 7)
    sampler.addPoint(0, 100)
    const placements = [
      ...sampler.addPoint(80, 100),
      ...sampler.addPoint(160, 100),
      ...sampler.addPoint(240, 100),
    ]
    // 240mm of stroke at 50mm spacing → 4 more placements (excluding the seed).
    expect(placements.length).toBe(4)
    // Scatter stays within the perpendicular spread.
    for (const p of placements) {
      expect(Math.abs(p.y - 100)).toBeLessThanOrEqual(params.spreadMm + 0.01)
    }
  })

  it('keeps scale inside the botanical bounds and varies rotation', () => {
    const sampler = new BrushSampler(params, 11)
    const placements = [...sampler.addPoint(0, 0), ...sampler.addPoint(500, 0)]
    expect(placements.length).toBeGreaterThan(5)
    const rotations = new Set(placements.map((p) => p.rotation))
    expect(rotations.size).toBeGreaterThan(1)
    for (const p of placements) {
      expect(p.scale).toBeGreaterThanOrEqual(0.85)
      expect(p.scale).toBeLessThanOrEqual(1.15)
    }
  })

  it('is deterministic for a given seed', () => {
    const run = () => {
      const sampler = new BrushSampler(params, 42)
      return [...sampler.addPoint(0, 0), ...sampler.addPoint(300, 40)]
    }
    expect(run()).toEqual(run())
  })
})
