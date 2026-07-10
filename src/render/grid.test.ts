import { describe, expect, it } from 'vitest'
import { gridSteps, snapToGrid } from './grid'

describe('gridSteps', () => {
  it('keeps on-screen spacing above the minimum at every zoom', () => {
    for (const scale of [0.02, 0.1, 0.5, 1, 2, 4, 8, 16]) {
      const { minor, major } = gridSteps(scale)
      expect(minor * scale).toBeGreaterThanOrEqual(14)
      expect(major).toBe(minor * 5)
    }
  })

  it('follows a 1–2–5 progression as zoom changes', () => {
    expect(gridSteps(1).minor).toBe(20) // 14px min → 20mm at 100%
    expect(gridSteps(2).minor).toBe(10)
    expect(gridSteps(4).minor).toBe(5)
    expect(gridSteps(16).minor).toBe(1)
    expect(gridSteps(0.1).minor).toBe(200)
  })

  it('caps at the coarsest step when zoomed far out', () => {
    expect(gridSteps(0.001).minor).toBe(1000)
  })
})

describe('snapToGrid', () => {
  it('snaps to the nearest multiple', () => {
    expect(snapToGrid(23, 10)).toBe(20)
    expect(snapToGrid(25, 10)).toBe(30)
    expect(snapToGrid(-7, 5)).toBe(-5)
    expect(snapToGrid(300.4, 25)).toBe(300)
  })
})
