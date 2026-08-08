import { describe, expect, it } from 'vitest'
import {
  FORM_GUIDE_KINDS,
  formGuideCurve,
  formSilhouette,
  nearestOnFormCurve,
  nearestOnFormEllipse,
  type FormGuideKind,
} from './formGuide'
import { DEFAULT_ARTBOARD } from '../domain/types'

const artboard = { id: 'main', ...DEFAULT_ARTBOARD }
const ellipse = formSilhouette(artboard) // cx 300, cy 210, rx 135, ry 85

describe('nearestOnFormEllipse', () => {
  it('is exact on the axes', () => {
    const top = nearestOnFormEllipse(ellipse, 300, 50)
    expect(top.x).toBeCloseTo(300)
    expect(top.y).toBeCloseTo(210 - 85)

    const right = nearestOnFormEllipse(ellipse, 600, 210)
    expect(right.x).toBeCloseTo(300 + 135)
    expect(right.y).toBeCloseTo(210)
  })

  it('reports the distance from the query point', () => {
    const p = nearestOnFormEllipse(ellipse, 300, 125) // exactly on the top of the ellipse
    expect(p.distance).toBeCloseTo(0)
  })

  it('gives radial stem rotations: up at the top, sideways at the flanks', () => {
    expect(nearestOnFormEllipse(ellipse, 300, 50).radialRotationDeg).toBeCloseTo(0)
    expect(nearestOnFormEllipse(ellipse, 600, 210).radialRotationDeg).toBeCloseTo(90)
    expect(nearestOnFormEllipse(ellipse, 0, 210).radialRotationDeg).toBeCloseTo(-90)
  })
})

const artboardFull = { id: 'main', ...DEFAULT_ARTBOARD }

describe('formGuideCurve', () => {
  it('resolves every kind to a non-empty curve with a pivot', () => {
    for (const { id } of FORM_GUIDE_KINDS) {
      const curve = formGuideCurve(id, artboardFull)
      expect(curve.kind).toBe(id)
      expect(curve.points.length).toBeGreaterThan(4)
      expect(Number.isFinite(curve.pivot.x)).toBe(true)
      expect(Number.isFinite(curve.pivot.y)).toBe(true)
    }
  })

  it('gives the round bouquet a focal ring, the open forms none', () => {
    expect(formGuideCurve('round', artboardFull).focal).toBeDefined()
    expect(formGuideCurve('crescent', artboardFull).focal).toBeUndefined()
    expect(formGuideCurve('cascade', artboardFull).focal).toBeUndefined()
  })

  it('marks round and cascade closed, compote and crescent open', () => {
    expect(formGuideCurve('round', artboardFull).closed).toBe(true)
    expect(formGuideCurve('cascade', artboardFull).closed).toBe(true)
    expect(formGuideCurve('compote', artboardFull).closed).toBe(false)
    expect(formGuideCurve('crescent', artboardFull).closed).toBe(false)
  })
})

describe('nearestOnFormCurve', () => {
  const kinds: FormGuideKind[] = ['round', 'compote', 'crescent', 'cascade']

  it('projects onto the curve and reports a finite radial rotation', () => {
    for (const kind of kinds) {
      const curve = formGuideCurve(kind, artboardFull)
      const near = nearestOnFormCurve(curve, curve.points[0].x, curve.points[0].y)
      expect(near.distance).toBeLessThan(2) // already on the curve
      expect(Number.isFinite(near.radialRotationDeg)).toBe(true)
    }
  })

  it('snaps a far point back onto the silhouette (distance shrinks)', () => {
    const curve = formGuideCurve('crescent', artboardFull)
    const near = nearestOnFormCurve(curve, curve.pivot.x, curve.pivot.y)
    // The pivot sits off the arc, so the nearest point is a real distance away
    // but still lands on a sampled vertex.
    expect(near.distance).toBeGreaterThan(0)
    const onCurve = curve.points.some(
      (p) => Math.hypot(p.x - near.x, p.y - near.y) < 5,
    )
    expect(onCurve).toBe(true)
  })

  it('the compote dome points stems upward at its apex', () => {
    const curve = formGuideCurve('compote', artboardFull)
    // Apex = highest (smallest y) sample point, directly above the pivot.
    const apex = curve.points.reduce((a, b) => (b.y < a.y ? b : a))
    const near = nearestOnFormCurve(curve, apex.x, apex.y)
    expect(Math.abs(near.radialRotationDeg)).toBeLessThan(15)
  })
})
