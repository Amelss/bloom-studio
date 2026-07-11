/**
 * The filler brush: paint a stroke and stems scatter along it with natural
 * density, perpendicular spread, and rotation variation — filler is placed
 * in dozens, not singles. Pure sampling maths; interactions drive it.
 */

export interface BrushPlacement {
  x: number
  y: number
  rotation: number
  scale: number
  flipX: boolean
}

export interface BrushParams {
  /** Distance between placements along the stroke, mm. */
  spacingMm: number
  /** Perpendicular scatter, mm. */
  spreadMm: number
  /** Rotation jitter, degrees. */
  rotationJitterDeg: number
}

export class BrushSampler {
  private accumulated = 0
  private last: { x: number; y: number } | null = null
  private readonly rng: () => number

  constructor(
    private readonly params: BrushParams,
    seed = 1,
  ) {
    let a = seed >>> 0
    this.rng = () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /** Feed a stroke point; returns any placements it produced. */
  addPoint(x: number, y: number): BrushPlacement[] {
    if (!this.last) {
      this.last = { x, y }
      return [this.place(x, y, 0)]
    }
    const placements: BrushPlacement[] = []
    let cursor: { x: number; y: number } = this.last
    let dx = x - cursor.x
    let dy = y - cursor.y
    let dist = Math.hypot(dx, dy)
    while (this.accumulated + dist >= this.params.spacingMm) {
      const remaining = this.params.spacingMm - this.accumulated
      const t = remaining / dist
      const tangent = Math.atan2(dy, dx)
      cursor = { x: cursor.x + dx * t, y: cursor.y + dy * t }
      placements.push(this.place(cursor.x, cursor.y, tangent))
      dx = x - cursor.x
      dy = y - cursor.y
      dist = Math.hypot(dx, dy)
      this.accumulated = 0
    }
    this.accumulated += dist
    this.last = { x, y }
    return placements
  }

  private place(x: number, y: number, tangentRad: number): BrushPlacement {
    const j = (amount: number) => (this.rng() * 2 - 1) * amount
    // Scatter perpendicular to the stroke direction.
    const offset = j(this.params.spreadMm)
    const px = x + Math.cos(tangentRad + Math.PI / 2) * offset
    const py = y + Math.sin(tangentRad + Math.PI / 2) * offset
    // Stems lean gently with the stroke's horizontal direction.
    const lean = Math.cos(tangentRad) * 12
    return {
      x: Math.round(px * 10) / 10,
      y: Math.round(py * 10) / 10,
      rotation: Math.round(lean + j(this.params.rotationJitterDeg)),
      scale: Math.min(1.15, Math.max(0.85, +(0.95 + j(0.12)).toFixed(2))),
      flipX: this.rng() > 0.5,
    }
  }
}
