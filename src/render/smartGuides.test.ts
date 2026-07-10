import { describe, expect, it } from 'vitest'
import { findSmartSnap } from './smartGuides'

describe('findSmartSnap', () => {
  it('snaps each axis to the nearest target within threshold', () => {
    const result = findSmartSnap(103, 250, [100, 300], [200], 5)
    expect(result.x).toBe(100)
    expect(result.y).toBe(250) // 200 is 50mm away — no snap
    expect(result.guides).toEqual([{ axis: 'v', position: 100 }])
  })

  it('prefers the closest of several candidates', () => {
    const result = findSmartSnap(104, 0, [100, 106], [], 5)
    expect(result.x).toBe(106)
  })

  it('returns the input unchanged when nothing is close', () => {
    const result = findSmartSnap(50, 60, [100], [100], 5)
    expect(result).toEqual({ x: 50, y: 60, guides: [] })
  })
})
