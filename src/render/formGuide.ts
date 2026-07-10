import type { Artboard } from '../domain/types'

/**
 * The round-bouquet form guide as a *magnetic* curve: drag a stem near the
 * silhouette and its head snaps onto the form line, auto-rotating radially —
 * the way stems actually splay from a binding point. Teaching and assistance
 * in the same gesture.
 */

export interface FormEllipse {
  cx: number
  cy: number
  rx: number
  ry: number
}

/** Silhouette ellipse + focal zone, in artboard-relative geometry. */
export const FORM_SILHOUETTE = { cy: 210, rx: 135, ry: 85 }
export const FORM_FOCAL_ZONE = { cy: 222, r: 48 }

export function formSilhouette(artboard: Artboard): FormEllipse {
  return {
    cx: artboard.x + artboard.width / 2,
    cy: artboard.y + FORM_SILHOUETTE.cy,
    rx: FORM_SILHOUETTE.rx,
    ry: FORM_SILHOUETTE.ry,
  }
}

export interface FormSnapPoint {
  x: number
  y: number
  /** Distance from the query point, mm. */
  distance: number
  /**
   * Stem rotation (degrees, our convention: 0 = head straight up) that points
   * the stem radially outward through this point.
   */
  radialRotationDeg: number
}

/**
 * Closest point on the ellipse (parametric approximation — exact on the axes,
 * within a couple of mm elsewhere; plenty for snapping).
 */
export function nearestOnFormEllipse(ellipse: FormEllipse, px: number, py: number): FormSnapPoint {
  const t = Math.atan2((py - ellipse.cy) / ellipse.ry, (px - ellipse.cx) / ellipse.rx)
  const x = ellipse.cx + ellipse.rx * Math.cos(t)
  const y = ellipse.cy + ellipse.ry * Math.sin(t)
  // Radial direction from the bouquet's optical centre through the point,
  // expressed in stem-rotation terms (0° = up, clockwise positive).
  const radialRotationDeg = (Math.atan2(x - ellipse.cx, -(y - ellipse.cy)) * 180) / Math.PI
  return { x, y, distance: Math.hypot(px - x, py - y), radialRotationDeg }
}
