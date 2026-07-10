import { describe, expect, it } from 'vitest'
import { Camera, MAX_SCALE, MIN_SCALE } from './camera'

function makeCamera(): Camera {
  const camera = new Camera()
  camera.setViewport(1200, 900)
  camera.set(300, 225, 1)
  return camera
}

describe('Camera', () => {
  it('round-trips world ↔ screen', () => {
    const camera = makeCamera()
    const world = camera.worldFromScreen(150, 640)
    const screen = camera.screenFromWorld(world.x, world.y)
    expect(screen.x).toBeCloseTo(150)
    expect(screen.y).toBeCloseTo(640)
  })

  it('zoomAt keeps the world point under the cursor stationary', () => {
    const camera = makeCamera()
    const cursor = { x: 200, y: 700 }
    const before = camera.worldFromScreen(cursor.x, cursor.y)
    camera.zoomAt(cursor.x, cursor.y, 2)
    const after = camera.worldFromScreen(cursor.x, cursor.y)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
    expect(camera.scale).toBe(2)

    camera.zoomAt(cursor.x, cursor.y, 0.25)
    const again = camera.worldFromScreen(cursor.x, cursor.y)
    expect(again.x).toBeCloseTo(before.x)
    expect(again.y).toBeCloseTo(before.y)
  })

  it('clamps zoom to the allowed range', () => {
    const camera = makeCamera()
    camera.zoomAt(600, 450, 10_000)
    expect(camera.scale).toBe(MAX_SCALE)
    camera.zoomAt(600, 450, 0.000001)
    expect(camera.scale).toBe(MIN_SCALE)
  })

  it('pans in world units scaled by zoom', () => {
    const camera = makeCamera()
    camera.set(300, 225, 2)
    camera.panByScreen(100, -50)
    expect(camera.x).toBeCloseTo(300 - 100 / 2)
    expect(camera.y).toBeCloseTo(225 + 50 / 2)
  })

  it('fitBounds centres the bounds at the largest scale that fits', () => {
    const camera = makeCamera()
    camera.fitBounds({ x: 0, y: 0, width: 600, height: 450 }, 50)
    // scale = min((1200−100)/600, (900−100)/450) = min(1.833…, 1.777…)
    expect(camera.scale).toBeCloseTo(800 / 450)
    expect(camera.x).toBeCloseTo(300)
    expect(camera.y).toBeCloseTo(225)
  })

  it('transform maps the camera centre to the viewport centre', () => {
    const camera = makeCamera()
    camera.set(100, 50, 2)
    const t = camera.transform()
    expect(100 * t.scale + t.tx).toBeCloseTo(600) // viewport centre x
    expect(50 * t.scale + t.ty).toBeCloseTo(450) // viewport centre y
  })
})
