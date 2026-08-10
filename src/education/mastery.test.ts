import { describe, expect, it } from 'vitest'
import { computeMastery } from './mastery'
import type { SkillSample } from '../lib/types'

let seq = 0
/** A sample with an auto-incrementing timestamp (so order is deterministic). */
function sample(principle_id: string, score: number, tone: SkillSample['tone'] = 'tip'): SkillSample {
  seq += 1
  return {
    id: `s${seq}`,
    design_id: 'd1',
    principle_id,
    score,
    tone,
    created_at: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
  }
}

describe('computeMastery', () => {
  it('averages only the most recent samples per principle', () => {
    // Six 'balance' samples; mastery should reflect the last five (10..50), not the first.
    const samples = [
      sample('balance', 100),
      sample('balance', 10),
      sample('balance', 20),
      sample('balance', 30),
      sample('balance', 40),
      sample('balance', 50),
    ]
    const [m] = computeMastery(samples)
    expect(m.principleId).toBe('balance')
    expect(m.mastery).toBe(30) // mean of 10,20,30,40,50
    expect(m.samples).toBe(6)
  })

  it('sorts weakest principle first', () => {
    const out = computeMastery([sample('balance', 90), sample('rhythm', 30), sample('depth', 60)])
    expect(out.map((m) => m.principleId)).toEqual(['rhythm', 'depth', 'balance'])
  })

  it('flags an upward trend when recent scores beat earlier ones', () => {
    const rising = [20, 25, 30, 80, 85, 90].map((n) => sample('contrast', n))
    const [m] = computeMastery(rising)
    expect(m.trend).toBe('up')
  })

  it('flags a downward trend when recent scores fall', () => {
    const falling = [90, 85, 80, 30, 25, 20].map((n) => sample('contrast', n))
    const [m] = computeMastery(falling)
    expect(m.trend).toBe('down')
  })

  it('reports steady when scores barely move', () => {
    const flat = [60, 61, 59, 60, 62, 60].map((n) => sample('harmony', n))
    const [m] = computeMastery(flat)
    expect(m.trend).toBe('steady')
  })

  it('resolves the principle display name', () => {
    const [m] = computeMastery([sample('balance', 70)])
    expect(m.name).toBe('Balance')
  })

  it('returns nothing for no samples', () => {
    expect(computeMastery([])).toEqual([])
  })
})
