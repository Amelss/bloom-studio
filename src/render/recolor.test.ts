import { describe, it, expect } from 'vitest'
import { recolorBloom, rgbToHsl } from './recolor'

/** Builds a tiny image: petals (rows 0..h/2) + green foliage (rows h/2..h). */
function makeImage(width: number, height: number, petal: [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const foliage = y >= height / 2
      const [r, g, b] = foliage ? [60, 130, 60] : petal
      // A little per-pixel lightness variation so percentiles are meaningful.
      const j = ((x % 3) - 1) * 12
      data[i] = r + j
      data[i + 1] = g + j
      data[i + 2] = b + j
      data[i + 3] = 255
    }
  }
  return { data, width, height }
}

describe('recolorBloom', () => {
  it('shifts petal hue toward the target swatch', () => {
    const img = makeImage(8, 8, [232, 180, 188]) // blush pink petals
    recolorBloom(img, '#6f2639') // burgundy target
    // Sample a petal pixel (top half).
    const [h] = rgbToHsl(img.data[0], img.data[1], img.data[2])
    const [targetH] = rgbToHsl(0x6f, 0x26, 0x39)
    expect(Math.abs(((h - targetH + 540) % 360) - 180)).toBeLessThan(25)
  })

  it('leaves green foliage untouched', () => {
    const img = makeImage(8, 8, [232, 180, 188])
    const before = [...img.data.slice(8 * 4 * 4, 8 * 4 * 4 + 4)] // first foliage row pixel
    recolorBloom(img, '#6f2639')
    const after = [...img.data.slice(8 * 4 * 4, 8 * 4 * 4 + 4)]
    expect(after).toEqual(before)
  })

  it('preserves a dark core when preserveDarkBelow is set', () => {
    // A bright petal pixel + a near-black core pixel, both saturated red.
    const data = new Uint8ClampedArray([230, 60, 70, 255, 20, 6, 8, 255])
    const img = { data, width: 2, height: 1 }
    const core = [data[4], data[5], data[6]]
    recolorBloom(img, '#6f2699', { preserveDarkBelow: 0.2 }) // purple target
    expect([data[4], data[5], data[6]]).toEqual(core) // dark core untouched
    expect([data[0], data[1], data[2]]).not.toEqual([230, 60, 70]) // petal shifted
  })

  it('does not touch transparent pixels', () => {
    const img = makeImage(4, 4, [232, 180, 188])
    img.data[3] = 0 // make first pixel transparent
    img.data[0] = 111
    recolorBloom(img, '#6f2639')
    expect(img.data[0]).toBe(111)
  })
})
