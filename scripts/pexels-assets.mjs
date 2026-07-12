/**
 * Pexels → Bloom Studio asset pipeline (pilot: rose, hydrangea, eucalyptus).
 *
 *   node scripts/pexels-assets.mjs fetch [target]
 *     Searches Pexels for each target, downloads the top candidates to
 *     asset-work/raw/, and prints them with photographer credits.
 *
 *   node scripts/pexels-assets.mjs process <target> <index> [options]
 *     Cuts the background out of a downloaded candidate, auto-fits it to the
 *     sprite layout contract (head centre 26.25%, binding 93.75%, 1280×2048),
 *     writes public/flowers/<variety>-<colorway>-<variant>.png, and updates
 *     the manifest + provenance ledger.
 *
 *     --variant <n>       variant slot (default 0)
 *     --tolerance <n>     background colour distance 0-255 (default 30)
 *     --head <x,y>        override auto-detected bloom-centre pixel (source px)
 *     --binding <x,y>     override auto-detected stem-base pixel (source px)
 *
 * Requires PEXELS_API_KEY in .env (Pexels License: free commercial use and
 * modification; provenance is recorded in public/flowers/provenance.json).
 */

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('..', import.meta.url).pathname
const RAW_DIR = path.join(ROOT, 'asset-work/raw')
const CUT_DIR = path.join(ROOT, 'asset-work/cut')
const OUT_DIR = path.join(ROOT, 'public/flowers')

const EXPORT_W = 1280
const EXPORT_H = 2048
const HEAD_Y = 0.2625 * EXPORT_H // 537.6
const BIND_Y = 0.9375 * EXPORT_H // 1920
const CENTER_X = EXPORT_W / 2

/** The pilot targets. Queries are tuned for clean, cuttable backgrounds. */
const TARGETS = {
  rose: {
    varietyId: 'garden-rose',
    colorwayId: 'blush',
    query: 'single pink rose flower with stem isolated on white background',
  },
  hydrangea: {
    varietyId: 'hydrangea',
    colorwayId: 'dusty-blue',
    query: 'blue hydrangea flower with stem isolated on white background',
  },
  eucalyptus: {
    varietyId: 'eucalyptus',
    colorwayId: 'silver',
    query: 'silver dollar eucalyptus stem on white background',
  },
}

/* --------------------------------- env --------------------------------- */

async function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!existsSync(envPath)) return
  const text = await readFile(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

/* -------------------------------- fetch -------------------------------- */

async function fetchCommand(only) {
  const key = process.env.PEXELS_API_KEY
  if (!key) {
    console.error('✗ PEXELS_API_KEY is empty — add it to .env first.')
    process.exit(1)
  }
  await mkdir(RAW_DIR, { recursive: true })
  const candidates = existsSync(path.join(RAW_DIR, 'candidates.json'))
    ? JSON.parse(await readFile(path.join(RAW_DIR, 'candidates.json'), 'utf8'))
    : {}

  for (const [name, target] of Object.entries(TARGETS)) {
    if (only && only !== name) continue
    console.log(`\n── ${name} — "${target.query}"`)
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(target.query)}&per_page=6&orientation=portrait`
    const response = await fetch(url, { headers: { Authorization: key } })
    if (!response.ok) {
      console.error(`✗ Pexels API ${response.status}: ${await response.text()}`)
      process.exit(1)
    }
    const data = await response.json()
    candidates[name] = []
    let index = 0
    for (const photo of data.photos ?? []) {
      const file = `${name}-${index}-${photo.id}.jpg`
      const imgResponse = await fetch(photo.src.large2x ?? photo.src.original)
      await writeFile(path.join(RAW_DIR, file), Buffer.from(await imgResponse.arrayBuffer()))
      candidates[name].push({
        index,
        id: photo.id,
        file,
        photographer: photo.photographer,
        url: photo.url,
        alt: photo.alt,
      })
      console.log(`  [${index}] ${photo.alt || '(no alt)'} — ${photo.photographer}`)
      console.log(`      ${photo.url}`)
      index++
    }
    if (!candidates[name].length) console.log('  (no results — try adjusting the query)')
  }
  await writeFile(path.join(RAW_DIR, 'candidates.json'), JSON.stringify(candidates, null, 2))
  console.log(`\n✓ Candidates saved to asset-work/raw/. Inspect them, then run e.g.:`)
  console.log('  node scripts/pexels-assets.mjs process rose 0')
}

/* ------------------------- cutout (flood fill) ------------------------- */

function colorDist(data, i, r, g, b) {
  return Math.sqrt((data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2)
}

/**
 * Removes the (near-uniform) background by flood-filling from the borders,
 * then feathers the cut edge one pixel. Works best on studio/white grounds.
 */
function removeBackground(data, width, height, tolerance, soft = 1.8, shadow = 1) {
  // Estimate the background colour from the median of the border pixels.
  const border = []
  for (let x = 0; x < width; x++) border.push((0 * width + x) * 4, ((height - 1) * width + x) * 4)
  for (let y = 0; y < height; y++) border.push((y * width + 0) * 4, (y * width + width - 1) * 4)
  const channel = (offset) => {
    const values = border.map((i) => data[i + offset]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }
  const [bgR, bgG, bgB] = [channel(0), channel(1), channel(2)]
  const bgLum = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB

  /** Shadows are darker than the background; brighter pixels stay strict. */
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
  // Soft matte band: extend the fill into near-background pixels (soft
  // shadows) with a graduated alpha ramp instead of a hard cut.
  const softTol = tolerance * soft
  if (soft > 1) {
    const softQueue = []
    const softAlpha = new Uint8Array(width * height)
    for (let p = 0; p < width * height; p++) {
      if (!cleared[p]) continue
      const x = p % width
      const y = (p / width) | 0
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const np = ny * width + nx
        if (!cleared[np] && !softAlpha[np]) {
          const dist = colorDist(data, np * 4, bgR, bgG, bgB)
          if (dist < (tolAt(np * 4) / tolerance) * softTol) {
            softAlpha[np] = 1
            softQueue.push(np)
          }
        }
      }
    }
    while (softQueue.length) {
      const p = softQueue.pop()
      const x = p % width
      const y = (p / width) | 0
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const np = ny * width + nx
        if (cleared[np] || softAlpha[np]) continue
        const dist = colorDist(data, np * 4, bgR, bgG, bgB)
        if (dist < (tolAt(np * 4) / tolerance) * softTol) {
          softAlpha[np] = 1
          softQueue.push(np)
        }
      }
    }
    for (let p = 0; p < width * height; p++) {
      if (!softAlpha[p]) continue
      const dist = colorDist(data, p * 4, bgR, bgG, bgB)
      const t = Math.max(0, Math.min(1, (dist - tolerance) / (softTol - tolerance)))
      data[p * 4 + 3] = Math.min(data[p * 4 + 3], Math.round(t * t * 235))
    }
  }

  // Apply alpha + feather the boundary.
  for (let p = 0; p < width * height; p++) {
    if (cleared[p]) data[p * 4 + 3] = 0
  }
  for (let p = 0; p < width * height; p++) {
    if (cleared[p]) continue
    const x = p % width
    const y = (p / width) | 0
    const nearCut =
      (x > 0 && cleared[p - 1]) ||
      (x < width - 1 && cleared[p + 1]) ||
      (y > 0 && cleared[p - width]) ||
      (y < height - 1 && cleared[p + width])
    if (nearCut) data[p * 4 + 3] = Math.min(data[p * 4 + 3], 140)
  }
  return { bgR, bgG, bgB }
}

/* --------------------------- anchor detection -------------------------- */

function detectAnchors(data, width, height) {
  let minX = width, maxX = -1, minY = height, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('Cutout is empty — tolerance too high?')

  // Bloom centre: alpha centroid of the top 45% of the content.
  const headLimit = minY + (maxY - minY) * 0.45
  let hx = 0, hy = 0, hn = 0
  for (let y = minY; y <= headLimit; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        hx += x
        hy += y
        hn++
      }
    }
  }
  // Stem base: centroid of the bottom 1.5% of the content.
  const bindStart = maxY - Math.max(4, (maxY - minY) * 0.015)
  let bx = 0, bn = 0
  for (let y = Math.floor(bindStart); y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * width + x) * 4 + 3] > 40) {
        bx += x
        bn++
      }
    }
  }
  return {
    head: { x: hx / hn, y: hy / hn },
    binding: { x: bx / bn, y: maxY },
    bounds: { minX, maxX, minY, maxY },
  }
}

/* ------------------------------- process -------------------------------- */

function parseArgs(argv) {
  const options = { variant: 0, tolerance: 30, head: null, binding: null, colorway: null, rotate: 0, soft: 1.8, shadow: 1 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--variant') options.variant = Number(argv[++i])
    else if (argv[i] === '--tolerance') options.tolerance = Number(argv[++i])
    else if (argv[i] === '--head') options.head = argv[++i].split(',').map(Number)
    else if (argv[i] === '--binding') options.binding = argv[++i].split(',').map(Number)
    else if (argv[i] === '--colorway') options.colorway = argv[++i]
    else if (argv[i] === '--rotate') options.rotate = Number(argv[++i])
    else if (argv[i] === '--soft') options.soft = Number(argv[++i])
    else if (argv[i] === '--shadow') options.shadow = Number(argv[++i])
  }
  return options
}

async function processCommand(name, index, options) {
  const target = TARGETS[name]
  if (!target) {
    console.error(`✗ Unknown target "${name}". Targets: ${Object.keys(TARGETS).join(', ')}`)
    process.exit(1)
  }
  const rawFiles = await readdir(RAW_DIR)
  const file = rawFiles.find((f) => f.startsWith(`${name}-${index}-`))
  if (!file) {
    console.error(`✗ No downloaded candidate ${name}[${index}] — run fetch first.`)
    process.exit(1)
  }

  const colorwayId = options.colorway ?? target.colorwayId
  // 1. Cut out the background.
  let source = sharp(path.join(RAW_DIR, file)).rotate() // respect EXIF
  if (options.rotate) source = sharp(await source.toBuffer()).rotate(options.rotate)
  const { data, info } = await source.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { bgR, bgG, bgB } = removeBackground(data, info.width, info.height, options.tolerance, options.soft, options.shadow)
  console.log(`  background ≈ rgb(${bgR}, ${bgG}, ${bgB}), tolerance ${options.tolerance}`)

  await mkdir(CUT_DIR, { recursive: true })
  const cutPath = path.join(CUT_DIR, `${name}-${index}.png`)
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(cutPath)

  // 2. Anchors (auto-detected, or overridden by eye).
  const auto = detectAnchors(data, info.width, info.height)
  const head = options.head ? { x: options.head[0], y: options.head[1] } : auto.head
  const binding = options.binding
    ? { x: options.binding[0], y: options.binding[1] }
    : auto.binding
  console.log(
    `  anchors: head (${Math.round(head.x)}, ${Math.round(head.y)})` +
      ` · binding (${Math.round(binding.x)}, ${Math.round(binding.y)})` +
      `${options.head || options.binding ? ' (manual)' : ' (auto — verify visually!)'}`,
  )
  if (binding.y - head.y < 40) {
    console.error('✗ Head and binding are too close — pass --head/--binding manually.')
    process.exit(1)
  }

  // 3. Fit to the layout contract: head → (640, 537.6), binding → y 1920.
  let scale = (BIND_Y - HEAD_Y) / (binding.y - head.y)
  const anchorX = (head.x + binding.x) / 2
  const scaledW = info.width * scale
  if (scaledW > EXPORT_W * 2.2) {
    console.warn('  ! very wide source — content may crop at the frame edges')
  }
  const left = Math.round(CENTER_X - anchorX * scale)
  const top = Math.round(HEAD_Y - head.y * scale)

  const resized = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(Math.max(1, Math.round(info.width * scale)), Math.max(1, Math.round(info.height * scale)))
    .png()
    .toBuffer()

  // Composite onto the transparent frame, cropping whatever falls outside.
  const meta = await sharp(resized).metadata()
  const srcLeft = Math.max(0, -left)
  const srcTop = Math.max(0, -top)
  const dstLeft = Math.max(0, left)
  const dstTop = Math.max(0, top)
  const visibleW = Math.min(meta.width - srcLeft, EXPORT_W - dstLeft)
  const visibleH = Math.min(meta.height - srcTop, EXPORT_H - dstTop)
  if (visibleW <= 0 || visibleH <= 0) throw new Error('Nothing visible after fitting')
  const cropped = await sharp(resized)
    .extract({ left: srcLeft, top: srcTop, width: visibleW, height: visibleH })
    .toBuffer()

  await mkdir(OUT_DIR, { recursive: true })
  const outName = `${target.varietyId}-${colorwayId}-${options.variant}.png`
  await sharp({
    create: { width: EXPORT_W, height: EXPORT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: cropped, left: dstLeft, top: dstTop }])
    .png()
    .toFile(path.join(OUT_DIR, outName))

  // 4. Manifest + provenance.
  const manifestPath = path.join(OUT_DIR, 'manifest.json')
  const manifest = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : { version: 1, assets: [] }
  const entry = {
    varietyId: target.varietyId,
    colorwayId,
    variant: options.variant,
    src: `/flowers/${outName}`,
  }
  manifest.assets = manifest.assets.filter(
    (a) =>
      !(a.varietyId === entry.varietyId && a.colorwayId === entry.colorwayId && a.variant === entry.variant),
  )
  manifest.assets.push(entry)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  const candidatesPath = path.join(RAW_DIR, 'candidates.json')
  const candidates = existsSync(candidatesPath)
    ? JSON.parse(await readFile(candidatesPath, 'utf8'))
    : {}
  const meta2 = candidates[name]?.find((c) => c.index === Number(index))
  const provenancePath = path.join(OUT_DIR, 'provenance.json')
  const provenance = existsSync(provenancePath)
    ? JSON.parse(await readFile(provenancePath, 'utf8'))
    : []
  provenance.push({
    file: outName,
    source: 'pexels',
    photoId: meta2?.id ?? null,
    photographer: meta2?.photographer ?? null,
    photoUrl: meta2?.url ?? null,
    license: 'Pexels License (free commercial use, modified)',
    retrieved: new Date().toISOString().slice(0, 10),
  })
  await writeFile(provenancePath, JSON.stringify(provenance, null, 2))

  console.log(`✓ public/flowers/${outName} + manifest + provenance updated`)
  console.log('  QA: open /asset-normalizer.html to eyeball anchors, or toggle Photo in the app.')
}

/* --------------------------------- main --------------------------------- */

await loadEnv()
const [, , command, ...rest] = process.argv
if (command === 'fetch') {
  await fetchCommand(rest[0])
} else if (command === 'process') {
  const [name, index, ...flags] = rest
  if (!name || index === undefined) {
    console.error('Usage: node scripts/pexels-assets.mjs process <target> <index> [--variant n] [--tolerance n] [--head x,y] [--binding x,y]')
    process.exit(1)
  }
  await processCommand(name, index, parseArgs(flags))
} else {
  console.log('Usage: node scripts/pexels-assets.mjs <fetch [target] | process <target> <index>>')
  console.log(`Targets: ${Object.keys(TARGETS).join(', ')}`)
}
