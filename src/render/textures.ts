import { Rectangle, Texture } from 'pixi.js'
import { SKETCHES, VESSEL_SKETCHES, hashString, svgToDataUrl } from '../assets/sketchSvg'
import { FLOWER_INDEX, getColorway } from '../data/catalog'
import { SPRITE_ASPECT, VESSEL_ASPECT } from '../domain/geometry'

/**
 * Texture pipeline with two sources behind one interface:
 *
 * 1. **Illustrations** (always available): generative SVG artwork rasterised
 *    on demand, in VARIANT_COUNT seeded variations per variety+colorway so
 *    repeated stems never look stamped. A stem picks its variant from a hash
 *    of its id — stable across sessions.
 * 2. **Photographs** (the AI-bridge pipeline, docs/ASSET-PIPELINE.md): alpha
 *    cutout PNGs listed in /flowers/manifest.json, normalised to the standard
 *    100×160 layout. When asset mode is 'photo', photographic textures are
 *    preferred per variety+colorway and fall back to illustration when absent.
 *
 * Low-resolution alpha maps are kept beside every texture for pixel-accurate
 * hit testing. Rasterisation is async; callers get `null` until ready and are
 * re-synced via the onTextureReady callback.
 */

export const VARIANT_COUNT = 3

const STEM_TEXTURE_WIDTH = 512
const HIT_MAP_WIDTH = 96
const VESSEL_TEXTURE_WIDTH = 512

export type AssetMode = 'sketch' | 'photo'

export interface StemTextureEntry {
  texture: Texture
  alpha: Uint8ClampedArray
  alphaWidth: number
  alphaHeight: number
}

interface ManifestAsset {
  varietyId: string
  colorwayId: string
  variant?: number
  src: string
}

const stemCache = new Map<string, StemTextureEntry>()
const vesselCache = new Map<string, Texture>()
const pending = new Set<string>()

/** varietyId:colorwayId → available photographic sources. */
const photoIndex = new Map<string, string[]>()
let manifestLoaded = false

let onTextureReady: (() => void) | null = null

export function setOnTextureReady(callback: (() => void) | null) {
  onTextureReady = callback
}

/** Stable per-stem variant so a stem keeps its look across sessions. */
export function variantForStem(stemId: string): number {
  return hashString(stemId) % VARIANT_COUNT
}

export function hasPhotoAssets(): boolean {
  return photoIndex.size > 0
}

/**
 * Loads the photographic asset manifest (if any). Missing manifest is the
 * normal state until the AI-bridge pipeline produces assets — not an error.
 */
export async function loadPhotoManifest(): Promise<void> {
  if (manifestLoaded) return
  manifestLoaded = true
  try {
    const response = await fetch('/flowers/manifest.json')
    if (!response.ok) return
    const manifest = (await response.json()) as { assets?: ManifestAsset[] }
    for (const asset of manifest.assets ?? []) {
      const key = `${asset.varietyId}:${asset.colorwayId}`
      const list = photoIndex.get(key) ?? []
      list[asset.variant ?? list.length] = asset.src
      photoIndex.set(key, list)
    }
    if (photoIndex.size) onTextureReady?.()
  } catch {
    // Offline or absent — illustrations carry the canvas.
  }
}

export function getStemTexture(
  varietyId: string,
  colorwayId: string,
  variant = 0,
  mode: AssetMode = 'sketch',
): StemTextureEntry | null {
  const variety = FLOWER_INDEX[varietyId]
  const colorway = getColorway(varietyId, colorwayId)
  if (!variety || !colorway) return null

  // Photographic source, when requested and available.
  if (mode === 'photo') {
    const sources = photoIndex.get(`${varietyId}:${colorway.id}`)
    if (sources?.length) {
      const src = sources[variant % sources.length] ?? sources[0]
      const key = `photo:${src}`
      const cached = stemCache.get(key)
      if (cached) return cached
      if (!pending.has(key)) {
        pending.add(key)
        void rasterizeStemFromUrl(key, src)
      }
      return null
    }
    // No photo for this variety yet — fall through to the illustration.
  }

  const key = `${variety.sketch}:${colorway.id}:v${variant}`
  const cached = stemCache.get(key)
  if (cached) return cached
  if (pending.has(key)) return null

  const sketch = SKETCHES[variety.sketch]
  if (!sketch) return null
  pending.add(key)
  void rasterizeStemFromSvg(
    key,
    sketch({ petal: colorway.petal, accent: colorway.accent }, variant + 1),
  )
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

async function rasterizeStemFromSvg(key: string, svg: string) {
  try {
    const image = await loadImage(svgToDataUrl(svg))
    stemCache.set(key, buildStemEntry(image))
  } finally {
    pending.delete(key)
    onTextureReady?.()
  }
}

async function rasterizeStemFromUrl(key: string, src: string) {
  try {
    const image = await loadImage(src)
    stemCache.set(key, buildStemEntry(image))
  } catch {
    // Broken asset reference: leave uncached; illustration fallback shows
    // next sync because the photo lookup keeps failing over.
  } finally {
    pending.delete(key)
    onTextureReady?.()
  }
}

function buildStemEntry(image: HTMLImageElement): StemTextureEntry {
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
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3]

  return { texture, alpha, alphaWidth: hitWidth, alphaHeight: hitHeight }
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
function drawToTexture(image: HTMLImageElement, width: number, height: number): Texture {
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
