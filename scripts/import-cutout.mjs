/**
 * Import a single ALREADY-CUTOUT (transparent-background) flower PNG and
 * normalise it to Bloom Studio's sprite layout — without background removal.
 *
 *   node scripts/import-cutout.mjs <input.png> <variety> <colorway> [variant]
 *   e.g. node scripts/import-cutout.mjs ~/Downloads/lily.png lily white
 *
 * Use this for assets that already ship on transparency (the flood-fill in
 * import-assets.mjs is for opaque-background sources and would eat dark stems
 * on a transparent one). The layout math is identical to import-assets.mjs, so
 * the result sits at the same real-world scale and binding point as every other
 * sprite. Overwrites public/flowers/<variety>-<colorway>-<variant>.png (+ thumb);
 * the manifest entry (kept by filename) is unchanged.
 */

import { mkdir } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('..', import.meta.url).pathname
const OUT_DIR = path.join(ROOT, 'public/flowers')

const EXPORT_W = 1280
const EXPORT_H = 2048
const PHOTO_FRAME_MM = 340
const PX_PER_MM = EXPORT_W / PHOTO_FRAME_MM
const PAD = 90
const BIND_Y = Math.round(EXPORT_H * 0.9375)
const CONTENT_W_MAX = EXPORT_W - 2 * PAD
const CONTENT_H_MAX = BIND_Y - PAD
const ALPHA_ON = 40
const EXTEND = 0.2 // extra stem, fraction of content height

// Must match SPREAD_MM in import-assets.mjs (true widest width, mm).
const SPREAD_MM = {
  'garden-rose': 115, peony: 130, ranunculus: 70, lisianthus: 80, carnation: 85,
  hydrangea: 150, delphinium: 55, gypsophila: 160, astilbe: 70, eucalyptus: 70,
  ruscus: 45, leatherleaf: 110, dahlia: 120, gerbera: 105, lily: 165,
  snapdragon: 55, stock: 50, sunflower: 150,
}

function contentBox(data, width, height) {
  let minX = width, maxX = -1, minY = height, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_ON) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('empty cutout — no opaque pixels')
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function crop(data, width, box) {
  const { minX, minY, w, h } = box
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const sRow = ((minY + y) * width + minX) * 4
    out.set(data.subarray(sRow, sRow + w * 4), y * w * 4)
  }
  return { data: out, width: w, height: h }
}

function widestRow(c) {
  const widths = []
  for (let y = 0; y < c.height; y++) {
    let lo = c.width, hi = -1
    for (let x = 0; x < c.width; x++) {
      if (c.data[(y * c.width + x) * 4 + 3] > 40) {
        if (x < lo) lo = x
        if (x > hi) hi = x
      }
    }
    if (hi >= 0) widths.push(hi - lo + 1)
  }
  if (!widths.length) return c.width
  widths.sort((a, b) => a - b)
  return widths[Math.floor(widths.length * 0.97)]
}

function extendStem(c, extraPx) {
  if (extraPx <= 0) return { ...c, stemX: c.width / 2 }
  const sampleY = Math.max(0, c.height - 5)
  let sx0 = c.width, sx1 = -1, sum = 0, n = 0
  for (let x = 0; x < c.width; x++) {
    if (c.data[(sampleY * c.width + x) * 4 + 3] > 160) {
      if (x < sx0) sx0 = x
      if (x > sx1) sx1 = x
      sum += x
      n++
    }
  }
  if (n === 0) return { ...c, stemX: c.width / 2 }
  const stemX = sum / n
  const newH = c.height + extraPx
  const out = new Uint8ClampedArray(c.width * newH * 4)
  out.set(c.data, 0)
  const sampleRow = sampleY * c.width * 4
  for (let y = c.height; y < newH; y++) {
    for (let x = sx0; x <= sx1; x++) {
      const s = sampleRow + x * 4
      const d = (y * c.width + x) * 4
      out[d] = c.data[s]
      out[d + 1] = c.data[s + 1]
      out[d + 2] = c.data[s + 2]
      out[d + 3] = c.data[s + 3]
    }
  }
  return { data: out, width: c.width, height: newH, stemX }
}

async function main() {
  const [input, variety, colorway, variantArg] = process.argv.slice(2)
  if (!input || !variety || !colorway) {
    console.error('usage: node scripts/import-cutout.mjs <input.png> <variety> <colorway> [variant]')
    process.exit(1)
  }
  const variant = Number(variantArg ?? 0)

  const { data, info } = await sharp(readFileSync(input.replace(/^~/, process.env.HOME)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const transparent = (() => {
    let t = 0
    for (let i = 3; i < data.length; i += 4) if (data[i] < 10) t++
    return t / (info.width * info.height)
  })()
  if (transparent < 0.05) {
    console.error('This image looks opaque (no transparent background). Use import-assets.mjs instead.')
    process.exit(1)
  }

  const box = contentBox(data, info.width, info.height)
  const cropped = crop(data, info.width, box)
  const c = extendStem(cropped, Math.round(cropped.height * EXTEND))

  const spread = SPREAD_MM[variety] ?? 110
  const trueScale = (spread * PX_PER_MM) / widestRow(cropped)
  const scale = Math.min(trueScale, CONTENT_W_MAX / c.width, CONTENT_H_MAX / c.height)

  const scaledW = Math.max(1, Math.round(c.width * scale))
  const scaledH = Math.max(1, Math.round(c.height * scale))
  const resized = await sharp(c.data, { raw: { width: c.width, height: c.height, channels: 4 } })
    .resize(scaledW, scaledH, { fit: 'fill' })
    .png()
    .toBuffer()

  let left = Math.round(EXPORT_W / 2 - c.stemX * scale)
  let top = Math.round(BIND_Y - c.height * scale)
  left = Math.max(PAD, Math.min(EXPORT_W - PAD - scaledW, left))
  top = Math.max(PAD, Math.min(EXPORT_H - PAD - scaledH, top))

  const outName = `${variety}-${colorway}-${variant}.png`
  await mkdir(OUT_DIR, { recursive: true })
  await sharp({ create: { width: EXPORT_W, height: EXPORT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(path.join(OUT_DIR, outName))

  const thumbName = `${variety}-${colorway}-${variant}-thumb.png`
  const tScale = 256 / Math.max(cropped.width, cropped.height)
  await sharp(cropped.data, { raw: { width: cropped.width, height: cropped.height, channels: 4 } })
    .resize(Math.max(1, Math.round(cropped.width * tScale)), Math.max(1, Math.round(cropped.height * tScale)))
    .png()
    .toFile(path.join(OUT_DIR, thumbName))

  console.log(`✓ ${outName} (${scaledW}×${scaledH}) + ${thumbName}`)
  console.log(`  source: ${input}`)
  console.log('  Manifest unchanged (same filename). Verify on canvas.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
