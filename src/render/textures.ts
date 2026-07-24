import { Rectangle, Texture } from 'pixi.js'
import { VESSEL_SKETCHES, svgToDataUrl } from '../assets/vessels'
import { FLOWER_INDEX, getColorway } from '../data/catalog'
import { SPRITE_ASPECT, VESSEL_ASPECT } from '../domain/geometry'
import { recolorBloom } from './recolor'

/**
 * Texture pipeline for the supplied photographic flower assets (alpha cutout
 * PNGs listed in /flowers/manifest.json) plus the vessel artwork. Each flower
 * frame represents the same real-world box, so flowers render at correct
 * relative proportions. Low-resolution alpha maps are kept beside every
 * texture for pixel-accurate hit testing. Rasterisation is async; callers get
 * `null` until ready and are re-synced via the onTextureReady callback.
 */

export const VARIANT_COUNT = 3

const STEM_TEXTURE_WIDTH = 512
const HIT_MAP_WIDTH = 96
const VESSEL_TEXTURE_WIDTH = 512

/** Small stable string hash — picks a stem's asset variant deterministically. */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Every imported photographic frame represents the SAME real-world box, so a
 * flower scaled to its true millimetre size inside that box automatically
 * renders at correct proportions relative to every other flower. The importer
 * scales each asset at a matching pixels-per-mm (see scripts/import-assets.mjs).
 */
export const PHOTO_FRAME_MM = 340

export interface StemTextureEntry {
  texture: Texture
  alpha: Uint8ClampedArray
  alphaWidth: number
  alphaHeight: number
  /** Real-world width the sprite frame represents, mm. */
  mmWidth: number
  /** Tight bounding box of the visible art within the frame, as 0–1 fractions. */
  content: { x: number; y: number; w: number; h: number }
}

interface ManifestAsset {
  varietyId: string
  colorwayId: string
  variant?: number
  src: string
  thumb?: string
  /**
   * When true, this base asset covers every catalog colorway for the variety
   * via runtime hue-remap (see docs/ASSET-CLOUD.md) — no file per colour.
   */
  recolorable?: boolean
  /**
   * When true, the flower has a dark central disc (e.g. a gerbera eye) that
   * must stay near-black through recolour — its darkest pixels are protected.
   */
  darkCore?: boolean
}

/** Lightness floor below which a `darkCore` flower's pixels resist recolour. */
const DARK_CORE_MAX_L = 0.2

const stemCache = new Map<string, StemTextureEntry>()
const vesselCache = new Map<string, Texture>()
const pending = new Set<string>()

/** varietyId:colorwayId → available photographic sources. */
const photoIndex = new Map<string, string[]>()
/** varietyId → every source for the variety (colourway-agnostic fallback). */
const varietyPhotoIndex = new Map<string, string[]>()
/** varietyId → recolorable base: its sources and the colorway they were shot in. */
const recolorBaseIndex = new Map<
  string,
  { sources: string[]; baseColorwayId: string; darkCore: boolean }
>()
/** varietyId:colorwayId → tightly-cropped thumbnail for the library panel. */
const thumbIndex = new Map<string, string>()
let manifestLoaded = false

/**
 * Where flower assets are served from. `/flowers` (default) is the bundled
 * local set; a Supabase Storage public-bucket URL serves from the CDN and drops
 * the assets from the bundle (docs/ASSET-CLOUD.md). Manifest paths are stored
 * canonically as `/flowers/<file>`; the base swaps in at load time.
 */
const ASSET_BASE_URL = import.meta.env.VITE_ASSET_BASE_URL ?? '/flowers'

function resolveAssetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${ASSET_BASE_URL}/${path.replace(/^\/flowers\//, '')}`
}

let onTextureReady: (() => void) | null = null

export function setOnTextureReady(callback: (() => void) | null) {
  onTextureReady = callback
}

/** Stable per-stem variant so a stem keeps its look across sessions. */
export function variantForStem(stemId: string): number {
  return hashString(stemId) % VARIANT_COUNT
}

/** Tightly-cropped thumbnail for the library (exact colourway first, else any). */
export function photoThumbSrc(varietyId: string, colorwayId?: string): string | null {
  if (colorwayId) {
    const exact = thumbIndex.get(`${varietyId}:${colorwayId}`)
    if (exact) return exact
  }
  for (const [key, src] of thumbIndex) {
    if (key.startsWith(`${varietyId}:`)) return src
  }
  return null
}

/**
 * Loads the photographic asset manifest (if any). Missing manifest is the
 * normal state until the AI-bridge pipeline produces assets — not an error.
 */
export async function loadPhotoManifest(): Promise<void> {
  if (manifestLoaded) return
  manifestLoaded = true
  try {
    const response = await fetch(resolveAssetUrl('manifest.json'))
    if (!response.ok) return
    const manifest = (await response.json()) as { assets?: ManifestAsset[] }
    for (const asset of manifest.assets ?? []) {
      const key = `${asset.varietyId}:${asset.colorwayId}`
      const src = resolveAssetUrl(asset.src)
      const list = photoIndex.get(key) ?? []
      list[asset.variant ?? list.length] = src
      photoIndex.set(key, list)
      const vList = varietyPhotoIndex.get(asset.varietyId) ?? []
      if (!vList.includes(src)) vList.push(src)
      varietyPhotoIndex.set(asset.varietyId, vList)
      if (asset.thumb && !thumbIndex.has(key)) thumbIndex.set(key, resolveAssetUrl(asset.thumb))
      if (asset.recolorable) {
        const base = recolorBaseIndex.get(asset.varietyId) ?? {
          sources: [],
          baseColorwayId: asset.colorwayId,
          darkCore: Boolean(asset.darkCore),
        }
        base.sources[asset.variant ?? base.sources.length] = src
        recolorBaseIndex.set(asset.varietyId, base)
      }
    }
    await generateRecoloredThumbs()
    if (photoIndex.size) onTextureReady?.()
  } catch {
    // Offline or absent — illustrations carry the canvas.
  }
}

/**
 * The library picker shows a thumbnail per colourway. Recolorable varieties
 * ship only their base thumb, so derive the missing colourway thumbnails once
 * (small 256px images) and cache them as data URLs — keeps the picker's colours
 * honest without shipping a thumb per colour.
 */
async function generateRecoloredThumbs(): Promise<void> {
  for (const [varietyId, base] of recolorBaseIndex) {
    const variety = FLOWER_INDEX[varietyId]
    const baseThumb = thumbIndex.get(`${varietyId}:${base.baseColorwayId}`)
    if (!variety || !baseThumb) continue
    for (const colorway of variety.colorways) {
      const key = `${varietyId}:${colorway.id}`
      if (colorway.id === base.baseColorwayId || colorway.neutral || thumbIndex.has(key)) continue
      try {
        const image = await loadImage(baseThumb)
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(image, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        recolorBloom(imageData, colorway.petal, {
          preserveDarkBelow: base.darkCore ? DARK_CORE_MAX_L : 0,
        })
        ctx.putImageData(imageData, 0, 0)
        thumbIndex.set(key, canvas.toDataURL('image/png'))
      } catch {
        // Keep the base-thumb fallback if a thumb can't be recoloured.
      }
    }
  }
}

export function getStemTexture(
  varietyId: string,
  colorwayId: string,
  variant = 0,
): StemTextureEntry | null {
  const variety = FLOWER_INDEX[varietyId]
  const colorway = getColorway(varietyId, colorwayId)
  if (!variety || !colorway) return null

  // 1. A distinct shipped file for this exact colourway wins.
  const exact = photoIndex.get(`${varietyId}:${colorway.id}`)
  // 2. Else a recolorable base covers every colourway via runtime hue-remap.
  const base = exact?.length ? null : recolorBaseIndex.get(varietyId)
  // 3. Else fall back to any asset for the variety, rendered as-is.
  const sources = exact?.length ? exact : base?.sources ?? varietyPhotoIndex.get(varietyId)
  if (!sources?.length) return null

  const src = sources[variant % sources.length] ?? sources[0]
  // Recolour only when using a base whose native colourway differs from the
  // request; the base's own colourway (and distinct files) render untouched.
  // Neutral (white/cream/green) targets can't be faked from a saturated base —
  // they need their own asset, so leave them on the raw-base fallback.
  const petalHex =
    base && colorway.id !== base.baseColorwayId && !colorway.neutral ? colorway.petal : null
  const preserveDarkBelow = base?.darkCore ? DARK_CORE_MAX_L : 0
  const key = petalHex ? `photo:${src}:${colorway.id}` : `photo:${src}`
  const cached = stemCache.get(key)
  if (cached) return cached
  if (!pending.has(key)) {
    pending.add(key)
    void rasterizeStemFromUrl(key, src, PHOTO_FRAME_MM, petalHex, preserveDarkBelow)
  }
  return null
}

export function getVesselTexture(sketchId: string): Texture | null {
  const key = `vessel:${sketchId}`
  const cached = vesselCache.get(key)
  if (cached) return cached
  if (pending.has(key)) return null
  const sketch = VESSEL_SKETCHES[sketchId]
  if (!sketch) return null
  pending.add(key)
  void rasterizeVessel(key, sketch())
  return null
}

/** u, v in [0, 1] sprite space → is there visible pixel there? */
export function hitTestAlpha(entry: StemTextureEntry, u: number, v: number): boolean {
  if (u < 0 || u > 1 || v < 0 || v > 1) return false
  const ix = Math.min(entry.alphaWidth - 1, Math.floor(u * entry.alphaWidth))
  const iy = Math.min(entry.alphaHeight - 1, Math.floor(v * entry.alphaHeight))
  return entry.alpha[iy * entry.alphaWidth + ix] > 25
}

/* ------------------------------ internals ------------------------------ */

async function rasterizeStemFromUrl(
  key: string,
  src: string,
  mmWidth: number,
  petalHex: string | null = null,
  preserveDarkBelow = 0,
) {
  try {
    const image = await loadImage(src)
    // A recolorable base is hue-remapped to the requested swatch once, on an
    // offscreen canvas, then atlased like any other sprite (docs/ASSET-CLOUD.md).
    const source = petalHex ? recolorToCanvas(image, petalHex, preserveDarkBelow) : image
    stemCache.set(key, buildStemEntry(source, mmWidth))
  } catch {
    // Broken asset reference: leave uncached; illustration fallback shows
    // next sync because the photo lookup keeps failing over.
  } finally {
    pending.delete(key)
    onTextureReady?.()
  }
}

/** Draws the base at sprite resolution and remaps its bloom to `petalHex`. */
function recolorToCanvas(
  image: HTMLImageElement,
  petalHex: string,
  preserveDarkBelow: number,
): HTMLCanvasElement {
  const width = STEM_TEXTURE_WIDTH
  const height = Math.round(width * SPRITE_ASPECT)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  recolorBloom(imageData, petalHex, { preserveDarkBelow })
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function buildStemEntry(image: CanvasImageSource, mmWidth: number): StemTextureEntry {
  const width = STEM_TEXTURE_WIDTH
  const height = Math.round(width * SPRITE_ASPECT)
  const texture = drawToTexture(image, width, height)

  const hitWidth = HIT_MAP_WIDTH
  const hitHeight = Math.round(hitWidth * SPRITE_ASPECT)
  const hitCanvas = document.createElement('canvas')
  hitCanvas.width = hitWidth
  hitCanvas.height = hitHeight
  const ctx = hitCanvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(image, 0, 0, hitWidth, hitHeight)
  const data = ctx.getImageData(0, 0, hitWidth, hitHeight).data
  const alpha = new Uint8ClampedArray(hitWidth * hitHeight)
  let minX = hitWidth, maxX = -1, minY = hitHeight, maxY = -1
  for (let iy = 0; iy < hitHeight; iy++) {
    for (let ix = 0; ix < hitWidth; ix++) {
      const a = data[(iy * hitWidth + ix) * 4 + 3]
      alpha[iy * hitWidth + ix] = a
      if (a > 25) {
        if (ix < minX) minX = ix
        if (ix > maxX) maxX = ix
        if (iy < minY) minY = iy
        if (iy > maxY) maxY = iy
      }
    }
  }
  const content =
    maxX < 0
      ? { x: 0, y: 0, w: 1, h: 1 }
      : {
          x: minX / hitWidth,
          y: minY / hitHeight,
          w: (maxX - minX + 1) / hitWidth,
          h: (maxY - minY + 1) / hitHeight,
        }

  return { texture, alpha, alphaWidth: hitWidth, alphaHeight: hitHeight, mmWidth, content }
}

async function rasterizeVessel(key: string, svg: string) {
  try {
    const image = await loadImage(svgToDataUrl(svg))
    const width = VESSEL_TEXTURE_WIDTH
    const height = Math.round(width / VESSEL_ASPECT)
    vesselCache.set(key, drawToTexture(image, width, height))
  } finally {
    pending.delete(key)
    onTextureReady?.()
  }
}

/* ------------------------------ atlas ---------------------------------- */

// All rasters pack into shared 2048² pages so sprites share texture sources
// and the batcher keeps draw calls low — THE difference between ~37fps and
// 60fps+ at 1,500 stems. Gutter padding prevents mipmap bleed between
// neighbouring frames.
const ATLAS_SIZE = 2048
const ATLAS_PAD = 8

interface AtlasPage {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  pageTexture: Texture
  shelfX: number
  shelfY: number
  shelfHeight: number
}

const atlasPages: AtlasPage[] = []

function newAtlasPage(): AtlasPage {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_SIZE
  canvas.height = ATLAS_SIZE
  const ctx = canvas.getContext('2d')!
  const pageTexture = Texture.from(canvas)
  try {
    pageTexture.source.autoGenerateMipmaps = true
  } catch {
    // Linear filtering suffices where mipmaps are unsupported.
  }
  const page: AtlasPage = { canvas, ctx, pageTexture, shelfX: 0, shelfY: 0, shelfHeight: 0 }
  atlasPages.push(page)
  return page
}

/** Shelf-packs the image into an atlas page; returns a sub-texture. */
function drawToTexture(image: CanvasImageSource, width: number, height: number): Texture {
  const w = width + ATLAS_PAD
  const h = height + ATLAS_PAD
  let page = atlasPages[atlasPages.length - 1] ?? newAtlasPage()
  if (page.shelfX + w > ATLAS_SIZE) {
    page.shelfX = 0
    page.shelfY += page.shelfHeight
    page.shelfHeight = 0
  }
  if (page.shelfY + h > ATLAS_SIZE) page = newAtlasPage()
  const x = page.shelfX
  const y = page.shelfY
  page.shelfX += w
  page.shelfHeight = Math.max(page.shelfHeight, h)

  page.ctx.drawImage(image, x, y, width, height)
  try {
    page.pageTexture.source.update()
  } catch {
    // Source update is renderer-specific; the first render uploads anyway.
  }
  return new Texture({
    source: page.pageTexture.source,
    frame: new Rectangle(x, y, width, height),
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load asset: ${src.slice(0, 64)}`))
    image.src = src
  })
}
