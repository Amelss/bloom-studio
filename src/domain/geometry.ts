import type { Artboard, FlowerVariety, PlacedStem, VesselDef } from './types'

/**
 * Shared physical geometry: one source of truth used by the renderer, the
 * hit tester, and the insights engine, so "where is the bloom head" always
 * has exactly one answer.
 *
 * Sketch artwork is drawn in a 100 × 160 box: the bloom head centre sits at
 * (50, 42) and the binding point (stem base) at (50, 150).
 */

export const SPRITE_ASPECT = 1.6
/** Head centre as a fraction of sprite width/height. */
export const HEAD_ANCHOR = { x: 0.5, y: 0.2625 }
/** Binding point as a fraction of sprite width/height. Sprites anchor here. */
export const BINDING_ANCHOR = { x: 0.5, y: 0.9375 }

export interface SizeMm {
  width: number
  height: number
}

export function spriteSize(variety: FlowerVariety, scale: number): SizeMm {
  const width = variety.widthMm * scale
  return { width, height: width * SPRITE_ASPECT }
}

/** Distance from binding point up to the head centre, mm (unrotated). */
export function headDistance(variety: FlowerVariety, scale: number): number {
  return (BINDING_ANCHOR.y - HEAD_ANCHOR.y) * spriteSize(variety, scale).height
}

/**
 * World position of the bloom head. The stem stores its binding point;
 * rotation swings the head around it (screen coords: y down, clockwise +).
 */
export function headPosition(stem: PlacedStem, variety: FlowerVariety): { x: number; y: number } {
  const d = headDistance(variety, stem.scale)
  const rad = (stem.rotation * Math.PI) / 180
  return { x: stem.x + d * Math.sin(rad), y: stem.y - d * Math.cos(rad) }
}

/** Axis-aligned bounds of a stem's (rotated) sprite, for fitting and rings. */
export function stemBounds(stem: PlacedStem, variety: FlowerVariety) {
  const { width, height } = spriteSize(variety, stem.scale)
  const rad = (stem.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = width * cos + height * sin
  const h = width * sin + height * cos
  // Sprite centre relative to the binding anchor, rotated.
  const cy = (0.5 - BINDING_ANCHOR.y) * height
  const cx = -cy * Math.sin(rad)
  const cyR = cy * Math.cos(rad)
  return {
    x: stem.x + cx - w / 2,
    y: stem.y + cyR - h / 2,
    width: w,
    height: h,
  }
}

/** Vessel artwork is drawn in a 260 × 200 box (1.3 aspect). */
export const VESSEL_ASPECT = 1.3
const VESSEL_BOTTOM_MARGIN_MM = 12
/** Rim height as a fraction of the compote artwork. */
const COMPOTE_RIM_FRACTION = 0.17

export function vesselRect(vessel: VesselDef, artboard: Artboard) {
  const width = vessel.widthMm
  const height = width / VESSEL_ASPECT
  return {
    x: artboard.x + artboard.width / 2 - width / 2,
    y: artboard.y + artboard.height - VESSEL_BOTTOM_MARGIN_MM - height,
    width,
    height,
  }
}

/** Top of the vessel's visual body (the rim for upright vessels), world mm. */
export function vesselRimY(vessel: VesselDef, artboard: Artboard): number {
  const rect = vesselRect(vessel, artboard)
  return vessel.renderMode === 'behind' ? rect.y + rect.height * COMPOTE_RIM_FRACTION : rect.y
}
