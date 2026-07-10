import type { StemPatch } from '../domain/commands'
import { STEM_SCALE_MAX, STEM_SCALE_MIN, type PlacedStem } from '../domain/types'

/**
 * Pure maths for rotate/scale gestures. Single stems pivot at their binding
 * point; multi-selections pivot around the combined binding centroid — the
 * whole selection behaves like a bunch turned in the hand.
 */

export interface GestureSnapshot {
  id: string
  x: number
  y: number
  rotation: number
  scale: number
}

export function snapshotStems(stems: PlacedStem[]): GestureSnapshot[] {
  return stems.map(({ id, x, y, rotation, scale }) => ({ id, x, y, rotation, scale }))
}

export function selectionCentroid(stems: { x: number; y: number }[]): { x: number; y: number } {
  const n = Math.max(1, stems.length)
  return {
    x: stems.reduce((sum, s) => sum + s.x, 0) / n,
    y: stems.reduce((sum, s) => sum + s.y, 0) / n,
  }
}

export function rotationPatches(
  start: GestureSnapshot[],
  center: { x: number; y: number },
  deltaDeg: number,
): Record<string, StemPatch> {
  const rad = (deltaDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const patches: Record<string, StemPatch> = {}
  for (const s of start) {
    const dx = s.x - center.x
    const dy = s.y - center.y
    patches[s.id] = {
      x: round1(center.x + dx * cos - dy * sin),
      y: round1(center.y + dx * sin + dy * cos),
      rotation: normalizeDeg(s.rotation + deltaDeg),
    }
  }
  return patches
}

export function scalePatches(
  start: GestureSnapshot[],
  center: { x: number; y: number },
  factor: number,
): Record<string, StemPatch> {
  // Positions spread with the gesture; each stem's own size stays inside the
  // botanical-variation bounds (flowers never stretch beyond real variation).
  const f = clamp(factor, 0.5, 2)
  const patches: Record<string, StemPatch> = {}
  for (const s of start) {
    patches[s.id] = {
      x: round1(center.x + (s.x - center.x) * f),
      y: round1(center.y + (s.y - center.y) * f),
      scale: clamp(+(s.scale * f).toFixed(2), STEM_SCALE_MIN, STEM_SCALE_MAX),
    }
  }
  return patches
}

export function normalizeDeg(deg: number): number {
  let d = ((deg + 180) % 360 + 360) % 360 - 180
  if (d === -180) d = 180
  return Math.round(d * 10) / 10
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
