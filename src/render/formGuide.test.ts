import { describe, expect, it } from 'vitest'
import { formSilhouette, nearestOnFormEllipse } from './formGuide'
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
