import type { Artboard } from '../domain/types'

/**
 * Form guides as *magnetic* curves: drag a stem near the silhouette and its
 * head snaps onto the form line, auto-rotating so the stem radiates the way it
 * would from the arrangement's binding point — the splay of a real spiral.
 * Teaching and assistance in the same gesture.
 *
 * Four classic silhouettes: the domed round bouquet, the low wide compote dome,
 * the asymmetric crescent, and the trailing cascade. Each is expressed as a
 * sampled curve plus a *pivot* — the point stems radiate from — so rendering and
 * snapping share one representation.
 */

export type FormGuideKind = 'round' | 'compote' | 'crescent' | 'cascade'

export const FORM_GUIDE_KINDS: { id: FormGuideKind; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'compote', label: 'Compote' },
  { id: 'crescent', label: 'Crescent' },
  { id: 'cascade', label: 'Cascade' },
]

export interface FormEllipse {
  cx: number
  cy: number
  rx: number
  ry: number
}

/** Round-bouquet silhouette ellipse + focal zone, in artboard-relative geometry. */
export const FORM_SILHOUETTE = { cy: 210, rx: 135, ry: 85 }
export const FORM_FOCAL_ZONE = { cy: 222, r: 48 }

export function formSilhouette(artboard: Artboard): FormEllipse {
  return {
    cx: artboard.x + artboard.width / 2,
    cy: artboard.y + FORM_SILHOUETTE.cy,
    rx: FORM_SILHOUETTE.rx,
    ry: FORM_SILHOUETTE.ry,
  }
}

export interface FormSnapPoint {
  x: number
  y: number
  /** Distance from the query point, mm. */
  distance: number
  /**
   * Stem rotation (degrees, our convention: 0 = head straight up, clockwise
   * positive) that points the stem radially outward from the pivot.
   */
  radialRotationDeg: number
}

export interface Vec2 {
  x: number
  y: number
}

/** A form guide resolved to world geometry: the drawable curve + its pivot. */
export interface FormCurve {
  kind: FormGuideKind
  /** Sampled silhouette points, world mm. */
  points: Vec2[]
  /** Whether the last point joins back to the first. */
  closed: boolean
  /** The binding point stems radiate from — the snap rotation origin. */
  pivot: Vec2
  /** Round bouquet only: the focal-flower ring. */
  focal?: { x: number; y: number; r: number }
}

const RAD = Math.PI / 180

/** Radial stem rotation (0 = up, cw+) that points outward from `pivot`. */
function radialRotation(x: number, y: number, pivot: Vec2): number {
  return (Math.atan2(x - pivot.x, -(y - pivot.y)) * 180) / Math.PI
}

/** Sample an elliptical arc between two angles (radians, screen coords y-down). */
function sampleArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  steps: number,
): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps
    out.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) })
  }
  return out
}

/** Sample a quadratic Bézier from p0 through control c to p1 (endpoint excluded). */
function sampleQuad(p0: Vec2, c: Vec2, p1: Vec2, steps: number): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const u = 1 - t
    out.push({
      x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
      y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    })
  }
  return out
}

/**
 * Resolve a form guide to world geometry for the given artboard. All four kinds
 * are centred on the artboard's horizontal midline and sit above a low binding
 * point, mirroring how each style is actually built in the hand or the vessel.
 */
export function formGuideCurve(kind: FormGuideKind, artboard: Artboard): FormCurve {
  const cx = artboard.x + artboard.width / 2
  const ay = artboard.y

  if (kind === 'compote') {
    // A low, wide dome sitting on the vessel rim; stems radiate from the rim.
    const pivot = { x: cx, y: ay + 255 }
    const points = sampleArc(pivot.x, pivot.y, 155, 118, 180 * RAD, 360 * RAD, 64)
    return { kind, points, closed: false, pivot }
  }

  if (kind === 'crescent') {
    // An asymmetric C: arms sweep from an off-centre arc centre; the long lower
    // arm is the classic crescent signature. Stems radiate off the concave side.
    const arcC = { x: cx + 58, y: ay + 202 }
    const points = sampleArc(arcC.x, arcC.y, 168, 168, 112 * RAD, 246 * RAD, 56)
    return { kind, points, closed: false, pivot: arcC }
  }

  if (kind === 'cascade') {
    // A rounded top mass that tapers into a trailing tail flowing downward.
    const top = { x: cx, y: ay + 185 }
    const tail = { x: cx + 16, y: ay + 402 }
    const rightBase = { x: cx + 105, y: ay + 185 }
    const leftBase = { x: cx - 105, y: ay + 185 }
    const points = [
      ...sampleArc(top.x, top.y, 105, 82, 180 * RAD, 360 * RAD, 40), // left → over top → right
      ...sampleQuad(rightBase, { x: cx + 92, y: ay + 300 }, tail, 22), // right flank down to tail
      tail,
      ...sampleQuad(tail, { x: cx - 92, y: ay + 300 }, leftBase, 22), // tail back up left flank
    ]
    return { kind, points, closed: true, pivot: { x: cx, y: ay + 215 } }
  }

  // Round bouquet — the closed domed ellipse with its focal ring.
  const e = formSilhouette(artboard)
  const points = sampleArc(e.cx, e.cy, e.rx, e.ry, 0, 360 * RAD, 96)
  return {
    kind: 'round',
    points,
    closed: true,
    pivot: { x: e.cx, y: e.cy },
    focal: { x: e.cx, y: ay + FORM_FOCAL_ZONE.cy, r: FORM_FOCAL_ZONE.r },
  }
}

/**
 * Nearest point on the round silhouette ellipse (parametric approximation —
 * exact on the axes, within a couple of mm elsewhere). Retained for the round
 * bouquet's exactness and its unit tests.
 */
export function nearestOnFormEllipse(ellipse: FormEllipse, px: number, py: number): FormSnapPoint {
  const t = Math.atan2((py - ellipse.cy) / ellipse.ry, (px - ellipse.cx) / ellipse.rx)
  const x = ellipse.cx + ellipse.rx * Math.cos(t)
  const y = ellipse.cy + ellipse.ry * Math.sin(t)
  const radialRotationDeg = radialRotation(x, y, { x: ellipse.cx, y: ellipse.cy })
  return { x, y, distance: Math.hypot(px - x, py - y), radialRotationDeg }
}

/**
 * Nearest point on any form curve: projects the query point onto each polyline
 * segment, keeps the closest, and derives the radial stem rotation from the
 * curve's pivot. The round bouquet routes through the exact ellipse solution.
 */
export function nearestOnFormCurve(curve: FormCurve, px: number, py: number): FormSnapPoint {
  if (curve.kind === 'round') {
    const e = { cx: curve.pivot.x, cy: curve.pivot.y, rx: FORM_SILHOUETTE.rx, ry: FORM_SILHOUETTE.ry }
    return nearestOnFormEllipse(e, px, py)
  }

  const pts = curve.points
  const segEnd = curve.closed ? pts.length : pts.length - 1
  let best: Vec2 | null = null
  let bestDist = Infinity
  for (let i = 0; i < segEnd; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2))
    const x = a.x + t * dx
    const y = a.y + t * dy
    const d = Math.hypot(px - x, py - y)
    if (d < bestDist) {
      bestDist = d
      best = { x, y }
    }
  }

  const p = best ?? curve.pivot
  return {
    x: p.x,
    y: p.y,
    distance: bestDist === Infinity ? Math.hypot(px - curve.pivot.x, py - curve.pivot.y) : bestDist,
    radialRotationDeg: radialRotation(p.x, p.y, curve.pivot),
  }
}
