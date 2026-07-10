import { Texture } from 'pixi.js'
import { SKETCHES, VESSEL_SKETCHES, svgToDataUrl } from '../assets/sketchSvg'
import { FLOWER_INDEX, getColorway } from '../data/catalog'
import { SPRITE_ASPECT, VESSEL_ASPECT } from '../domain/geometry'

/**
 * Texture pipeline: SVG artwork rasterised to GPU textures on demand, cached
 * per variety + colorway, with a low-resolution alpha map kept aside for
 * pixel-accurate hit testing. Rasterisation is async; callers get `null`
 * until ready and are re-synced via the onTextureReady callback.
 *
 * Phase C replaces the SVG source with the high-fidelity illustration
 * atlases (multi-angle, LOD tiers) behind this same interface.
 */

const STEM_TEXTURE_WIDTH = 512
const HIT_MAP_WIDTH = 96
const VESSEL_TEXTURE_WIDTH = 512

export interface StemTextureEntry {
  texture: Texture
  alpha: Uint8ClampedArray
  alphaWidth: number
  alphaHeight: number
}

const stemCache = new Map<string, StemTextureEntry>()
const vesselCache = new Map<string, Texture>()
const pending = new Set<string>()

let onTextureReady: (() => void) | null = null

export function setOnTextureReady(callback: (() => void) | null) {
  onTextureReady = callback
}

export function stemTextureKey(varietyId: string, colorwayId: string): string | null {
  const variety = FLOWER_INDEX[varietyId]
  const colorway = getColorway(varietyId, colorwayId)
  if (!variety || !colorway) return null
  return `${variety.sketch}:${colorway.id}`
}

export function getStemTexture(varietyId: string, colorwayId: string): StemTextureEntry | null {
  const key = stemTextureKey(varietyId, colorwayId)
  if (!key) return null
  const cached = stemCache.get(key)
  if (cached) return cached
  if (pending.has(key)) return null

  const variety = FLOWER_INDEX[varietyId]!
  const colorway = getColorway(varietyId, colorwayId)!
  const sketch = SKETCHES[variety.sketch]
  if (!sketch) return null

  pending.add(key)
  void rasterizeStem(key, sketch({ petal: colorway.petal, accent: colorway.accent }))
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

async function rasterizeStem(key: string, svg: string) {
  try {
    const image = await loadSvg(svg)
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

    stemCache.set(key, { texture, alpha, alphaWidth: hitWidth, alphaHeight: hitHeight })
  } finally {
    pending.delete(key)
    onTextureReady?.()
  }
}

async function rasterizeVessel(key: string, svg: string) {
  try {
    const image = await loadSvg(svg)
    const width = VESSEL_TEXTURE_WIDTH
    const height = Math.round(width / VESSEL_ASPECT)
    vesselCache.set(key, drawToTexture(image, width, height))
  } finally {
    pending.delete(key)
    onTextureReady?.()
  }
}

function drawToTexture(image: HTMLImageElement, width: number, height: number): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, width, height)
  const texture = Texture.from(canvas)
  // Crisp minification when zoomed out.
  try {
    texture.source.autoGenerateMipmaps = true
    texture.source.update()
  } catch {
    // Older/renderer-specific sources may not support this; linear filtering suffices.
  }
  return texture
}

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to rasterise sketch'))
    image.src = svgToDataUrl(svg)
  })
}
