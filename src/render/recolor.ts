/**
 * Runtime bloom recolour — the browser twin of `recolorBloom` in
 * scripts/import-assets.mjs. Recolorable varieties ship ONE base asset (see
 * docs/ASSET-CLOUD.md); every other colorway is derived here at texture-load
 * time instead of shipping a file per colour.
 *
 * It is a lightness-preserving HSL remap, NOT a multiply tint: each petal pixel
 * keeps its relative lightness (remapped into a range centred on the target
 * swatch) and ~25% of its own hue variation, while foliage and near-neutral
 * pixels are left untouched so green stems and leaves survive. The maths must
 * stay identical to the build script so runtime output matches baked assets.
 */

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((((h % 360) + 360) % 360) / 360)
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]
}

/** Green/brown foliage — protected from the bloom remap. */
const isFoliageHue = (h: number, s: number) => s > 0.1 && h > 55 && h < 185

/**
 * Recolours the bloom pixels of `img` (in place) toward `targetHex`. Foliage
 * and near-neutral pixels are preserved. Mirrors `recolorBloom` in the import
 * script exactly.
 */
export interface RecolorOptions {
  /**
   * Petal pixels darker than this lightness (0–1) are left untouched — for
   * flowers with a dark central disc that must stay near-black whatever the
   * petal colour (e.g. a gerbera eye). 0 (default) preserves nothing, keeping
   * output byte-identical to the original single-argument behaviour.
   */
  preserveDarkBelow?: number
}

export function recolorBloom(
  img: { data: Uint8ClampedArray; width: number; height: number },
  targetHex: string,
  { preserveDarkBelow = 0 }: RecolorOptions = {},
): void {
  const data = img.data
  const n = img.width * img.height
  const tr = parseInt(targetHex.slice(1, 3), 16)
  const tg = parseInt(targetHex.slice(3, 5), 16)
  const tb = parseInt(targetHex.slice(5, 7), 16)
  const [th, ts, tl] = rgbToHsl(tr, tg, tb)

  // Pass 1: petal statistics (lightness percentiles + dominant hue).
  const Ls: number[] = []
  let sinSum = 0
  let cosSum = 0
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] < 12) continue
    const [h, s, l] = rgbToHsl(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
    if (isFoliageHue(h, s) || s < 0.1 || l < preserveDarkBelow) continue
    Ls.push(l)
    const rad = (h * Math.PI) / 180
    sinSum += Math.sin(rad)
    cosSum += Math.cos(rad)
  }
  if (!Ls.length) return
  Ls.sort((a, b) => a - b)
  const l5 = Ls[Math.floor(Ls.length * 0.05)]
  const l95 = Ls[Math.floor(Ls.length * 0.95)]
  const domHue = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360

  // Pass 2: remap petal pixels around the target swatch.
  const SPREAD = 0.5 // output lightness contrast range
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] < 12) continue
    const [h, s, l] = rgbToHsl(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
    if (isFoliageHue(h, s) || s < 0.1 || l < preserveDarkBelow) continue
    const t = Math.max(0, Math.min(1, (l - l5) / (l95 - l5 || 1)))
    const nl = Math.max(0.05, Math.min(0.97, tl + (t - 0.6) * SPREAD))
    const ns = Math.max(0, Math.min(1, ts * (0.85 + (1 - t) * 0.35)))
    // Keep a quarter of the source's own hue variation for organic colour.
    let dh = h - domHue
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360
    const [r, g, b] = hslToRgb(th + dh * 0.25, ns, nl)
    data[p * 4] = r
    data[p * 4 + 1] = g
    data[p * 4 + 2] = b
  }
}
