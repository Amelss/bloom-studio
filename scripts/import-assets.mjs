/**
 * Import hand-supplied flower assets into Bloom Studio.
 *
 *   node scripts/import-assets.mjs
 *
 * Reads the images in asset-work/incoming/ (identified VISUALLY, not by
 * filename — see the MAP below), cuts out the background, normalises each to
 * the sprite layout contract (head centre 26.25%, binding 93.75%, 1280×2048),
 * writes public/flowers/<variety>-<colorway>-<variant>.png and rebuilds the
 * manifest + provenance ledger.
 *
 * The MAP is the human-in-the-loop identification: each incoming file number
 * → the flower it depicts (by inspection), its variety/colorway slot, and any
 * per-image cutout tuning or rotation.
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('..', import.meta.url).pathname
const IN_DIR = path.join(ROOT, 'asset-work/incoming')
const OUT_DIR = path.join(ROOT, 'public/flowers')

const EXPORT_W = 1280
const EXPORT_H = 2048

// Every frame represents the SAME real-world box (PHOTO_FRAME_MM wide), and
// each flower is scaled to its true natural width inside it — so all flowers
// render at correct proportions relative to one another. Must match
// PHOTO_FRAME_MM in src/render/textures.ts.
const PHOTO_FRAME_MM = 340
const PX_PER_MM = EXPORT_W / PHOTO_FRAME_MM

// True width of each flower at its WIDEST point (bloom diameter / spread /
// spike width), mm — the measure the importer scales every asset to.
const SPREAD_MM = {
  'garden-rose': 115,
  peony: 130,
  ranunculus: 70,
  lisianthus: 80,
  carnation: 85,
  hydrangea: 150,
  delphinium: 55,
  gypsophila: 160,
  astilbe: 70,
  eucalyptus: 70,
  ruscus: 45,
  leatherleaf: 110,
  dahlia: 120,
  gerbera: 105,
  lily: 165,
  snapdragon: 55,
  stock: 50,
  sunflower: 150,
}

/**
 * Visual identification of each incoming image (NOT from its filename).
 * tol/soft/shadow tune the background cut; rotate straightens diagonal stems.
 */
const MAP = [
  { n: '01', variety: 'delphinium', colorway: 'blue', variant: 0, tol: 46, soft: 1.7, shadow: 1.7 },
  // The supplied rose is deep red → the BURGUNDY colourway; blush and coral
  // are derived programmatically (bloom hue-remap, foliage untouched).
  {
    n: '02', variety: 'garden-rose', colorway: 'burgundy', variant: 0, tol: 46, soft: 1.7, shadow: 1.9,
    recolors: [
      { colorway: 'blush', hex: '#e8b4bc' },
      { colorway: 'coral', hex: '#ea9077' },
    ],
  },
  { n: '03', variety: 'astilbe', colorway: 'pink', variant: 0, tol: 40, soft: 1.5, shadow: 1.8 },
  { n: '04', variety: 'dahlia', colorway: 'burgundy', variant: 0, tol: 52, soft: 1.7, shadow: 1.6 },
  { n: '05', variety: 'eucalyptus', colorway: 'silver', variant: 0, tol: 50, soft: 1.6, shadow: 1.5, rotate: -37 },
  { n: '06', variety: 'leatherleaf', colorway: 'green', variant: 0, tol: 46, soft: 1.6, shadow: 1.6 },
  { n: '07', variety: 'gerbera', colorway: 'coral', variant: 0, tol: 52, soft: 1.7, shadow: 1.6 },
  { n: '08', variety: 'gypsophila', colorway: 'white', variant: 0, tol: 32, soft: 1.5, shadow: 2.0 },
  { n: '09', variety: 'hydrangea', colorway: 'dusty-blue', variant: 0, tol: 50, soft: 1.6, shadow: 1.6 },
  { n: '10', variety: 'ruscus', colorway: 'green', variant: 0, tol: 44, soft: 1.6, shadow: 1.7 },
  { n: '11', variety: 'lily', colorway: 'white', variant: 0, tol: 42, soft: 1.6, shadow: 1.8 },
  { n: '12', variety: 'lisianthus', colorway: 'lilac', variant: 0, tol: 50, soft: 1.6, shadow: 1.6 },
  { n: '13', variety: 'carnation', colorway: 'dusty-pink', variant: 0, tol: 44, soft: 1.6, shadow: 1.8 },
  { n: '14', variety: 'peony', colorway: 'pink', variant: 0, tol: 42, soft: 1.6, shadow: 1.8 },
  { n: '15', variety: 'ranunculus', colorway: 'pink', variant: 0, tol: 46, soft: 1.6, shadow: 1.7 },
  { n: '16', variety: 'snapdragon', colorway: 'pink', variant: 0, tol: 48, soft: 1.6, shadow: 1.7 },
  { n: '17', variety: 'stock', colorway: 'lavender', variant: 0, tol: 26, soft: 1.3, shadow: 1.25 },
  { n: '18', variety: 'sunflower', colorway: 'yellow', variant: 0, tol: 52, soft: 1.7, shadow: 1.6 },
  { n: '19', variety: 'sunflower', colorway: 'yellow', variant: 1, tol: 46, soft: 1.6, shadow: 1.7 },
]

/* --------------------------- cutout (flood fill) ----------------------- */

function colorDist(data, i, r, g, b) {
  return Math.sqrt((data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2)
}

function removeBackground(data, width, height, tolerance, soft, shadow) {
  const border = []
  for (let x = 0; x < width; x++) border.push((0 * width + x) * 4, ((height - 1) * width + x) * 4)
  for (let y = 0; y < height; y++) border.push((y * width + 0) * 4, (y * width + width - 1) * 4)
  const channel = (o) => {
    const v = border.map((i) => data[i + o]).sort((a, b) => a - b)
    return v[Math.floor(v.length / 2)]
  }
  const [bgR, bgG, bgB] = [channel(0), channel(1), channel(2)]
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB
  const tolAt = (i) => {
    if (shadow <= 1) return tolerance
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    return lum < bgLum - 5 ? tolerance * shadow : tolerance
  }

  const cleared = new Uint8Array(width * height)
  const queue = []
  for (const i of border) {
    const p = i / 4
    if (!cleared[p] && colorDist(data, i, bgR, bgG, bgB) < tolAt(i)) {
      cleared[p] = 1
      queue.push(p)
    }
  }
  while (queue.length) {
    const p = queue.pop()
    const x = p % width
    const y = (p / width) | 0
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const np = ny * width + nx
      if (cleared[np]) continue
      if (colorDist(data, np * 4, bgR, bgG, bgB) < tolAt(np * 4)) {
        cleared[np] = 1
        queue.push(np)
      }
    }
  }
  // Graduated soft matte for the near-background band (soft shadows / AA edge).
  const softTol = tolerance * soft
  if (soft > 1) {
    const seen = new Uint8Array(width * height)
    const q2 = []
    const consider = (np) => {
      if (cleared[np] || seen[np]) return
      if (colorDist(data, np * 4, bgR, bgG, bgB) < (tolAt(np * 4) / tolerance) * softTol) {
        seen[np] = 1
        q2.push(np)
      }
    }
    for (let p = 0; p < width * height; p++) {
      if (!cleared[p]) continue
      const x = p % width
      const y = (p / width) | 0
      if (x > 0) consider(p - 1)
      if (x < width - 1) consider(p + 1)
      if (y > 0) consider(p - width)
      if (y < height - 1) consider(p + width)
    }
    while (q2.length) {
      const p = q2.pop()
      const x = p % width
      const y = (p / width) | 0
      if (x > 0) consider(p - 1)
      if (x < width - 1) consider(p + 1)
      if (y > 0) consider(p - width)
      if (y < height - 1) consider(p + width)
    }
    for (let p = 0; p < width * height; p++) {
      if (!seen[p]) continue
      const dist = colorDist(data, p * 4, bgR, bgG, bgB)
      const t = Math.max(0, Math.min(1, (dist - tolerance) / (softTol - tolerance)))
      data[p * 4 + 3] = Math.min(data[p * 4 + 3], Math.round(t * t * 235))
    }
  }
  for (let p = 0; p < width * height; p++) if (cleared[p]) data[p * 4 + 3] = 0
  return { bgR, bgG, bgB }
}

/* ------------------------- programmatic recolour ------------------------ */

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h * 360, s, l]
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]
}

const isFoliageHue = (h, s) => s > 0.1 && h > 55 && h < 185

/**
 * Recolours the BLOOM of a cutout toward a target swatch while preserving all
 * shading: each petal pixel keeps its relative lightness (remapped into a
 * range centred on the target colour) and a trace of its original hue
 * variation. Green/brown foliage and near-neutral pixels are left untouched,
 * so stems and leaves survive. Returns a recoloured copy.
 */
function recolorBloom(c, targetHex) {
  const data = new Uint8ClampedArray(c.data)
  const n = c.width * c.height
  const [tr, tg, tb] = [parseInt(targetHex.slice(1, 3), 16), parseInt(targetHex.slice(3, 5), 16), parseInt(targetHex.slice(5, 7), 16)]
  const [th, ts, tl] = rgbToHsl(tr, tg, tb)

  // Pass 1: petal statistics (lightness percentiles + dominant hue).
  const Ls = []
  let sinSum = 0, cosSum = 0
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] < 12) continue
    const [h, s, l] = rgbToHsl(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
    if (isFoliageHue(h, s) || s < 0.1) continue
    Ls.push(l)
    const rad = (h * Math.PI) / 180
    sinSum += Math.sin(rad); cosSum += Math.cos(rad)
  }
  if (!Ls.length) return c
  Ls.sort((a, b) => a - b)
  const l5 = Ls[Math.floor(Ls.length * 0.05)]
  const l95 = Ls[Math.floor(Ls.length * 0.95)]
  const domHue = ((Math.atan2(sinSum, cosSum) * 180) / Math.PI + 360) % 360

  // Pass 2: remap petal pixels around the target swatch.
  const SPREAD = 0.5 // output lightness contrast range
  for (let p = 0; p < n; p++) {
    if (data[p * 4 + 3] < 12) continue
    const [h, s, l] = rgbToHsl(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
    if (isFoliageHue(h, s) || s < 0.1) continue
    const t = Math.max(0, Math.min(1, (l - l5) / (l95 - l5 || 1)))
    const nl = Math.max(0.05, Math.min(0.97, tl + (t - 0.6) * SPREAD))
    const ns = Math.max(0, Math.min(1, ts * (0.85 + (1 - t) * 0.35)))
    // Keep a quarter of the source's own hue variation for organic colour.
    let dh = h - domHue
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360
    const [r, g, b] = hslToRgb(th + dh * 0.25, ns, nl)
    data[p * 4] = r; data[p * 4 + 1] = g; data[p * 4 + 2] = b
  }
  return { ...c, data }
}

/* -------------------- content bbox, stem, extension -------------------- */

const ALPHA_ON = 40

/** Tight bounding box of the visible content. */
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
  if (maxX < 0) throw new Error('empty cutout')
  return { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** Extract the content bbox into a fresh tight RGBA buffer. */
function crop(data, width, box) {
  const { minX, minY, w, h } = box
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    const sRow = ((minY + y) * width + minX) * 4
    out.set(data.subarray(sRow, sRow + w * 4), y * w * 4)
  }
  return { data: out, width: w, height: h }
}

/**
 * The flower's true visual width = its WIDEST opaque row (the bloom/spread),
 * NOT the bounding box (which an angled stem or side leaves would inflate,
 * shrinking the bloom). Uses a high percentile to ignore stray single rows.
 */
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

/**
 * Extends the stem straight down by `extraPx`, in the asset's own stem colour,
 * so cut flowers start with a slightly longer stem the user can trim. Samples
 * a solid row just above the base and tiles it — never invents anything but
 * more of the existing stem. Returns a taller buffer + the new stem-base x.
 */
function extendStem(c, extraPx) {
  if (extraPx <= 0) return { ...c, stemX: c.width / 2 }
  // Sample a solid row a few px above the very bottom (avoids soft AA edge).
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

/* --------------------------------- layout ------------------------------ */

// Every asset is placed WHOLE inside the frame with generous transparent
// padding, at uniform scale (never distorted, never cropped). The stem base
// sits near the bottom centre so all stems pivot consistently.
const PAD = 90
// Binding sits at the sprite's pivot fraction (BINDING_ANCHOR.y in geometry.ts).
const BIND_Y = Math.round(EXPORT_H * 0.9375)
const CONTENT_W_MAX = EXPORT_W - 2 * PAD
const CONTENT_H_MAX = BIND_Y - PAD

/* ------------------------------- process ------------------------------- */

async function processOne(entry) {
  const files = await readdir(IN_DIR)
  const file = files.find((f) => f === `${entry.n}.jpg`)
  if (!file) {
    console.error(`✗ ${entry.n}: no incoming image`)
    return null
  }

  let src = sharp(path.join(IN_DIR, file)).rotate() // EXIF
  let { data, info } = await src.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  removeBackground(data, info.width, info.height, entry.tol, entry.soft, entry.shadow)

  if (entry.rotate) {
    const rotated = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .rotate(entry.rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true })
    data = rotated.data
    info = rotated.info
  }

  // Trim to the visible flower, extend the stem, then CONTAIN-fit the whole
  // thing inside the padded frame at uniform scale (no crop, no distortion).
  const box = contentBox(data, info.width, info.height)
  const cropped = crop(data, info.width, box)
  const extraPx = Math.round(cropped.height * (entry.extend ?? 0.2))
  const c = extendStem(cropped, extraPx)

  // Scale so the flower's WIDEST ROW (its true bloom/spread) equals its real
  // width at the shared px/mm — so every flower is proportional regardless of
  // how much stem/foliage its source image happens to include. Capped so the
  // whole asset still fits the padded frame (uniform scale — never distorted).
  const spread = SPREAD_MM[entry.variety] ?? 110
  const bloomPx = widestRow(cropped)
  const trueScale = (spread * PX_PER_MM) / bloomPx
  const scale = Math.min(trueScale, CONTENT_W_MAX / c.width, CONTENT_H_MAX / c.height)

  // One frame per colourway: the source as-is, plus any programmatically
  // recoloured derivatives (bloom hue-remap; foliage protected).
  const outputs = [{ colorway: entry.colorway, buf: c, thumbBuf: cropped }]
  for (const rc of entry.recolors ?? []) {
    outputs.push({
      colorway: rc.colorway,
      buf: recolorBloom(c, rc.hex),
      thumbBuf: recolorBloom(cropped, rc.hex),
    })
  }

  const results = []
  for (const out of outputs) {
    const asset = await writeFrame(entry, out, scale)
    results.push(asset)
  }
  return results
}

/** Contain-fit one buffer into the padded frame and write PNG + thumbnail. */
async function writeFrame(entry, { colorway, buf: c, thumbBuf }, scale) {
  const scaledW = Math.max(1, Math.round(c.width * scale))
  const scaledH = Math.max(1, Math.round(c.height * scale))

  const resized = await sharp(c.data, { raw: { width: c.width, height: c.height, channels: 4 } })
    .resize(scaledW, scaledH, { fit: 'fill' }) // uniform: both dims already · scale
    .png()
    .toBuffer()

  // Place the stem base at the bottom-centre binding point, then clamp so the
  // whole asset stays inside the padded frame (guaranteed room by contain-fit).
  let left = Math.round(EXPORT_W / 2 - c.stemX * scale)
  let top = Math.round(BIND_Y - c.height * scale)
  left = Math.max(PAD, Math.min(EXPORT_W - PAD - scaledW, left))
  top = Math.max(PAD, Math.min(EXPORT_H - PAD - scaledH, top))

  const outName = `${entry.variety}-${colorway}-${entry.variant}.png`
  await mkdir(OUT_DIR, { recursive: true })
  await sharp({ create: { width: EXPORT_W, height: EXPORT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .png()
    .toFile(path.join(OUT_DIR, outName))

  // A tightly-cropped thumbnail (just the flower, minimal padding) for the
  // library panel, so small flowers aren't lost in the true-scale frame.
  const thumbName = `${entry.variety}-${colorway}-${entry.variant}-thumb.png`
  const tScale = 256 / Math.max(thumbBuf.width, thumbBuf.height)
  await sharp(thumbBuf.data, { raw: { width: thumbBuf.width, height: thumbBuf.height, channels: 4 } })
    .resize(Math.max(1, Math.round(thumbBuf.width * tScale)), Math.max(1, Math.round(thumbBuf.height * tScale)))
    .png()
    .toFile(path.join(OUT_DIR, thumbName))

  console.log(`✓ ${entry.n} → ${outName} (${scaledW}×${scaledH})${colorway !== entry.colorway ? ' [recoloured]' : ''}`)
  return {
    varietyId: entry.variety,
    colorwayId: colorway,
    variant: entry.variant,
    src: `/flowers/${outName}`,
    thumb: `/flowers/${thumbName}`,
    recolored: colorway !== entry.colorway || undefined,
  }
}

async function main() {
  const assets = []
  const provenance = []
  for (const entry of MAP) {
    const produced = await processOne(entry)
    for (const asset of produced ?? []) {
      assets.push(asset)
      provenance.push({
        file: `${asset.varietyId}-${asset.colorwayId}-${asset.variant}.png`,
        source: 'supplied-3d-render',
        incoming: `${entry.n}.jpg`,
        note: asset.recolored
          ? 'derived colourway — programmatic bloom recolour of the supplied asset'
          : 'externally created production asset',
        imported: new Date().toISOString().slice(0, 10),
      })
    }
  }
  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify({ version: 1, assets }, null, 2))
  await writeFile(path.join(OUT_DIR, 'provenance.json'), JSON.stringify(provenance, null, 2))

  // Remove any stale PNGs no longer referenced by the manifest (keep thumbs).
  const keep = new Set(assets.flatMap((a) => [path.basename(a.src), path.basename(a.thumb)]))
  for (const f of await readdir(OUT_DIR)) {
    if (f.endsWith('.png') && !keep.has(f)) {
      await sharp // noop import guard
      const { unlink } = await import('node:fs/promises')
      await unlink(path.join(OUT_DIR, f))
      console.log(`  removed stale ${f}`)
    }
  }
  console.log(`\n✓ ${assets.length}/${MAP.length} assets → public/flowers/ (manifest + provenance written)`)
}

await main()
