/**
 * The viewport camera: world (mm) ↔ screen (px) mapping, zoom-to-cursor,
 * panning, and animated fits. Deliberately Pixi-free so the maths is unit-
 * testable; the scene applies `transform()` to its root container.
 *
 * `scale` is pixels-per-millimetre; 1.0 is displayed as "100%".
 */

export const MIN_SCALE = 0.02 // 2%
export const MAX_SCALE = 16 // 1600%

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export class Camera {
  /** World point (mm) at the viewport centre. */
  x = 300
  y = 225
  scale = 1

  viewportWidth = 800
  viewportHeight = 600

  /** Fired on every change (scene re-applies transform + redraws overlays). */
  onChange: (() => void) | null = null

  private animationFrame: number | null = null

  setViewport(width: number, height: number) {
    this.viewportWidth = Math.max(1, width)
    this.viewportHeight = Math.max(1, height)
    this.emit()
  }

  set(x: number, y: number, scale: number) {
    this.cancelAnimation()
    this.x = x
    this.y = y
    this.scale = clamp(scale, MIN_SCALE, MAX_SCALE)
    this.emit()
  }

  worldFromScreen(px: number, py: number): { x: number; y: number } {
    return {
      x: this.x + (px - this.viewportWidth / 2) / this.scale,
      y: this.y + (py - this.viewportHeight / 2) / this.scale,
    }
  }

  screenFromWorld(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.scale + this.viewportWidth / 2,
      y: (wy - this.y) * this.scale + this.viewportHeight / 2,
    }
  }

  /** Zoom by `factor`, keeping the world point under (px, py) stationary. */
  zoomAt(px: number, py: number, factor: number) {
    this.cancelAnimation()
    const anchor = this.worldFromScreen(px, py)
    this.scale = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE)
    this.x = anchor.x - (px - this.viewportWidth / 2) / this.scale
    this.y = anchor.y - (py - this.viewportHeight / 2) / this.scale
    this.emit()
  }

  /** Zoom around the viewport centre. */
  zoomBy(factor: number, animate = false) {
    const target = {
      x: this.x,
      y: this.y,
      scale: clamp(this.scale * factor, MIN_SCALE, MAX_SCALE),
    }
    if (animate) this.animateTo(target)
    else this.set(target.x, target.y, target.scale)
  }

  /** Pan by a screen-space delta (px). */
  panByScreen(dx: number, dy: number) {
    this.cancelAnimation()
    this.x -= dx / this.scale
    this.y -= dy / this.scale
    this.emit()
  }

  fitBounds(bounds: Bounds, padding = 48, animate = false) {
    const scale = clamp(
      Math.min(
        (this.viewportWidth - padding * 2) / bounds.width,
        (this.viewportHeight - padding * 2) / bounds.height,
      ),
      MIN_SCALE,
      MAX_SCALE,
    )
    const target = {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      scale,
    }
    if (animate) this.animateTo(target)
    else this.set(target.x, target.y, target.scale)
  }

  /** Root-container transform: content scaled by `scale`, centred on (x, y). */
  transform(): { scale: number; tx: number; ty: number } {
    return {
      scale: this.scale,
      tx: this.viewportWidth / 2 - this.x * this.scale,
      ty: this.viewportHeight / 2 - this.y * this.scale,
    }
  }

  animateTo(target: { x: number; y: number; scale: number }, duration = 180) {
    if (typeof requestAnimationFrame !== 'function' || prefersReducedMotion()) {
      this.set(target.x, target.y, target.scale)
      return
    }
    this.cancelAnimation()
    const from = { x: this.x, y: this.y, scale: this.scale }
    const to = { ...target, scale: clamp(target.scale, MIN_SCALE, MAX_SCALE) }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const e = 1 - Math.pow(1 - t, 3) // ease-out cubic
      this.x = from.x + (to.x - from.x) * e
      this.y = from.y + (to.y - from.y) * e
      this.scale = from.scale + (to.scale - from.scale) * e
      this.emit()
      if (t < 1) this.animationFrame = requestAnimationFrame(tick)
      else this.animationFrame = null
    }
    this.animationFrame = requestAnimationFrame(tick)
  }

  private cancelAnimation() {
    if (this.animationFrame != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.animationFrame)
    }
    this.animationFrame = null
  }

  private emit() {
    this.onChange?.()
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
