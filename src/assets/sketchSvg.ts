/**
 * Botanical illustration generators — FLAT STYLE, parameterised by colorway
 * and seed.
 *
 * Art direction (decided July 2026, docs/ASSET-STRATEGY.md): botanical
 * ACCURACY over photorealism. Realism comes from correct species structure —
 * silhouettes, petal layering, growth habit, organic irregularity — drawn in
 * a clean flat style: flat fills, two or three tone steps, thin low-opacity
 * edge lines to define layers, a subtle base shade where form needs it.
 * No baked directional lighting, no heavy gradients, no highlight/AO blobs —
 * lighting neutrality is what lets many stems sit together on one canvas.
 *
 * Layout contract (relied on by domain/geometry.ts and the renderer):
 * viewBox 0 0 100 160 · head centre (50, 42) · binding point (50, 150).
 */

export interface SketchColors {
  petal: string
  accent: string
}

export type SketchFn = (c: SketchColors, seed?: number) => string

const STEM = '#6b7f5e'
const STEM_EDGE = '#55684b'
const LEAF = '#7d9070'
const LEAF_DEEP = '#5f7355'
const BUTTON = '#5d6b3f'
const STAMEN = '#d9b95c'
const STAMEN_DEEP = '#8a7333'

const OPEN = '<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg">'
const CLOSE = '</svg>'

/* ------------------------------ utilities ------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

type Rng = () => number
const jitter = (rng: Rng, amount: number) => (rng() * 2 - 1) * amount

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Mix two hex colours; t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

const lighten = (c: string, t: number) => mix(c, '#ffffff', t)
const r2 = (n: number) => Math.round(n * 100) / 100

/** The flat-style tone set derived from a colorway. */
function tones(c: SketchColors) {
  return {
    base: c.petal,
    soft: mix(c.petal, c.accent, 0.18),
    shade: mix(c.petal, c.accent, 0.5),
    deep: mix(c.petal, c.accent, 0.85),
    tint: lighten(c.petal, 0.14),
  }
}

/* --------------------------- organic geometry -------------------------- */

interface Pt {
  x: number
  y: number
}

/** Smooth organic closed blob (leaves, irregular discs). */
function blobPath(
  cx: number,
  cy: number,
  r: number,
  rng: Rng,
  irregularity = 0.1,
  squashY = 1,
  points = 8,
): string {
  const pts: Pt[] = []
  const phase = rng() * Math.PI * 2
  for (let i = 0; i < points; i++) {
    const a = phase + (i / points) * Math.PI * 2
    const rr = r * (1 + jitter(rng, irregularity))
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * squashY })
  }
  const mid = (p: Pt, q: Pt): Pt => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
  const m0 = mid(pts[0], pts[1])
  let d = `M${r2(m0.x)},${r2(m0.y)}`
  for (let i = 1; i <= points; i++) {
    const p = pts[i % points]
    const m = mid(p, pts[(i + 1) % points])
    d += `Q${r2(p.x)},${r2(p.y)} ${r2(m.x)},${r2(m.y)}`
  }
  return d + 'Z'
}

/**
 * A petal pointing up from the origin (base at 0,0, tip at 0,−h), half-width
 * w. `ruffle` perturbs the silhouette organically.
 */
function petalPath(w: number, h: number, ruffle: number, rng: Rng): string {
  const lw = w * (1 + jitter(rng, ruffle * 0.35))
  const rw = w * (1 + jitter(rng, ruffle * 0.35))
  const tipX = jitter(rng, w * ruffle * 0.5)
  const lh = h * (0.72 + jitter(rng, ruffle * 0.08))
  const rh = h * (0.72 + jitter(rng, ruffle * 0.08))
  return (
    `M0,0` +
    `C${r2(-lw * 1.05)},${r2(-h * 0.24)} ${r2(-lw)},${r2(-lh)} ${r2(tipX)},${r2(-h)}` +
    `C${r2(rw)},${r2(-rh)} ${r2(rw * 1.05)},${r2(-h * 0.24)} 0,0Z`
  )
}

interface PetalStyle {
  fill: string
  edge: string
  /** Subtle crescent at the petal base (form definition). */
  baseShade?: string
  /** Lighter rim at the tip — a reflexed/curled edge (rose guards). */
  tipCurl?: string
}

/** Flat petal: fill + optional base crescent + thin edge line. */
function flatPetal(w: number, h: number, ruffle: number, rng: Rng, style: PetalStyle): string {
  const d = petalPath(w, h, ruffle, rng)
  let svg = `<path d="${d}" fill="${style.fill}"/>`
  if (style.baseShade) {
    svg += `<path d="M${r2(-w * 0.42)},${r2(-h * 0.1)} Q0,${r2(-h * 0.3)} ${r2(w * 0.42)},${r2(-h * 0.1)} Q0,${r2(-h * 0.02)} ${r2(-w * 0.42)},${r2(-h * 0.1)}Z" fill="${style.baseShade}" opacity="0.35"/>`
  }
  if (style.tipCurl) {
    svg += `<path d="M${r2(-w * 0.48)},${r2(-h * 0.74)} Q0,${r2(-h * 1.0)} ${r2(w * 0.48)},${r2(-h * 0.74)} Q0,${r2(-h * 0.86)} ${r2(-w * 0.48)},${r2(-h * 0.74)}Z" fill="${style.tipCurl}" opacity="0.85"/>`
  }
  svg += `<path d="${d}" fill="none" stroke="${style.edge}" stroke-width="0.45" stroke-opacity="0.45"/>`
  return svg
}

/** Ring of petals around (cx, cy): bases at `dist`, pointing outward. */
function petalRing(
  cx: number,
  cy: number,
  count: number,
  dist: number,
  w: number,
  h: number,
  ruffle: number,
  rng: Rng,
  style: PetalStyle,
  phaseDeg = 0,
): string {
  let svg = ''
  for (let k = 0; k < count; k++) {
    const angle = phaseDeg + (k * 360) / count + jitter(rng, 5)
    svg +=
      `<g transform="translate(${r2(cx)} ${r2(cy)}) rotate(${r2(angle)}) translate(0 ${r2(-dist * (1 + jitter(rng, 0.06)))})">` +
      flatPetal(w, h * (1 + jitter(rng, 0.06)), ruffle, rng, style) +
      `</g>`
  }
  return svg
}

/** Scalloped closed ring — one papery ranunculus layer. */
function scallopRing(cx: number, cy: number, r: number, scallops: number, rng: Rng): string {
  const phase = rng() * Math.PI * 2
  const pt = (a: number, rr: number): Pt => ({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr })
  let d = ''
  for (let i = 0; i < scallops; i++) {
    const a0 = phase + (i / scallops) * Math.PI * 2
    const a1 = phase + ((i + 1) / scallops) * Math.PI * 2
    const p0 = pt(a0, r * 0.95)
    const p1 = pt(a1, r * 0.95)
    const control = pt((a0 + a1) / 2, r * (1.14 + jitter(rng, 0.04)))
    d += i === 0 ? `M${r2(p0.x)},${r2(p0.y)}` : ''
    d += `Q${r2(control.x)},${r2(control.y)} ${r2(p1.x)},${r2(p1.y)}`
  }
  return d + 'Z'
}

/* --------------------------- stems & foliage --------------------------- */

function stalk(rng: Rng, from = 58, leaves = true, color = STEM): string {
  const bend = jitter(rng, 3)
  let svg = `<path d="M50 ${from} C ${r2(50 + bend)} ${from + 30} ${r2(50 - bend * 0.6)} 122 50 150" stroke="${color}" stroke-width="2.9" fill="none" stroke-linecap="round"/>`
  if (leaves) {
    svg += simpleLeaf(46 + jitter(rng, 3), 102 + jitter(rng, 6), -38 + jitter(rng, 9), 12.5, rng)
    svg += simpleLeaf(55 + jitter(rng, 3), 121 + jitter(rng, 5), 36 + jitter(rng, 9), 10.5, rng)
  }
  return svg
}

function simpleLeaf(x: number, y: number, angleDeg: number, length: number, rng: Rng): string {
  const l = length * (1 + jitter(rng, 0.15))
  return (
    `<g transform="translate(${r2(x)} ${r2(y)}) rotate(${r2(angleDeg - 90)})">` +
    `<path d="M0,0 C${r2(-l * 0.3)},${r2(-l * 0.3)} ${r2(-l * 0.27)},${r2(-l * 0.75)} 0,${r2(-l)} C${r2(l * 0.27)},${r2(-l * 0.75)} ${r2(l * 0.3)},${r2(-l * 0.3)} 0,0Z" fill="${LEAF}"/>` +
    `<path d="M0,${r2(-l * 0.08)} L0,${r2(-l * 0.9)}" stroke="${LEAF_DEEP}" stroke-width="0.5" opacity="0.55"/>` +
    `</g>`
  )
}

/** Point + unit tangent along a quadratic bezier. */
function quadPoint(p0: Pt, p1: Pt, p2: Pt, t: number): { p: Pt; tan: Pt } {
  const u = 1 - t
  const p = {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
  const dx = 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x)
  const dy = 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
  const len = Math.hypot(dx, dy) || 1
  return { p, tan: { x: dx / len, y: dy / len } }
}

/* ------------------------------ varieties ------------------------------ */

/**
 * Garden rose: broad reflexed guard petals (lighter curled rims), cupped
 * mid petals, and the swirled ruffled centre of a garden variety.
 */
const rose: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 7919 + 11)
  const t = tones(c)
  const R = 29
  let svg = stalk(rng)
  svg += petalRing(50, 42, 6, R * 0.34, R * 0.5, R * 0.62, 0.3, rng, {
    fill: t.base, edge: t.deep, baseShade: t.shade, tipCurl: t.tint,
  })
  svg += petalRing(50, 42, 5, R * 0.2, R * 0.42, R * 0.52, 0.28, rng, {
    fill: t.soft, edge: t.deep, baseShade: t.shade,
  }, 36)
  svg += petalRing(50, 42, 4, R * 0.1, R * 0.32, R * 0.4, 0.25, rng, {
    fill: mix(t.base, t.shade, 0.4), edge: t.deep, baseShade: t.shade,
  }, 80)
  // Swirled centre: nested open arcs, the quartered garden-rose heart.
  svg += `<circle cx="50" cy="42" r="${r2(R * 0.22)}" fill="${t.soft}"/>`
  for (const [radius, rotation] of [
    [R * 0.19, rng() * 360], [R * 0.14, rng() * 360], [R * 0.09, rng() * 360], [R * 0.05, rng() * 360],
  ] as const) {
    const a0 = (rotation * Math.PI) / 180
    const a1 = a0 + 4.2
    svg += `<path d="M${r2(50 + Math.cos(a0) * radius)},${r2(42 + Math.sin(a0) * radius)} A${r2(radius)},${r2(radius)} 0 1 1 ${r2(50 + Math.cos(a1) * radius)},${r2(42 + Math.sin(a1) * radius)}" fill="none" stroke="${t.shade}" stroke-width="1.15" stroke-linecap="round" opacity="0.8"/>`
  }
  return OPEN + svg + CLOSE
}

/** Peony (bomb form): broad guards around a dense ruffled centre mass. */
const peony: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 5077 + 3)
  const t = tones(c)
  const R = 32
  let svg = stalk(rng, 64)
  svg += petalRing(50, 42, 6, R * 0.3, R * 0.5, R * 0.7, 0.5, rng, {
    fill: t.base, edge: t.deep, baseShade: t.shade,
  })
  svg += petalRing(50, 42, 6, R * 0.18, R * 0.42, R * 0.56, 0.5, rng, {
    fill: t.soft, edge: t.deep, baseShade: t.shade,
  }, 30)
  // The bomb: an irregular ruffled mass of short crescent folds.
  const bombOutline = blobPath(50, 41, R * 0.4, rng, 0.14, 0.95, 10)
  svg += `<path d="${bombOutline}" fill="${mix(t.base, t.tint, 0.5)}"/>`
  for (let k = 0; k < 16; k++) {
    const a = rng() * Math.PI * 2
    const d = rng() * R * 0.3
    const x = 50 + Math.cos(a) * d
    const y = 41 + Math.sin(a) * d * 0.9
    const arcR = 2.2 + rng() * 2.6
    const rot = rng() * 360
    svg += `<path d="M${r2(x - arcR)},${r2(y)} A${r2(arcR)},${r2(arcR * 0.85)} 0 0 1 ${r2(x + arcR)},${r2(y)}" fill="none" stroke="${k % 3 === 0 ? t.tint : t.shade}" stroke-width="0.9" stroke-linecap="round" opacity="0.75" transform="rotate(${r2(rot)} ${r2(x)} ${r2(y)})"/>`
  }
  svg += `<path d="${bombOutline}" fill="none" stroke="${t.deep}" stroke-width="0.45" stroke-opacity="0.4"/>`
  return OPEN + svg + CLOSE
}

/** Ranunculus: densely packed concentric papery layers, tight button eye. */
const ranunculus: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 6151 + 29)
  const t = tones(c)
  let svg = stalk(rng)
  const radii = [23, 19.6, 16.6, 14, 11.6, 9.4, 7.4, 5.6, 3.9]
  radii.forEach((r, i) => {
    const cx = 50 + jitter(rng, 0.5)
    const cy = 44 + jitter(rng, 0.5)
    const fill = i % 2 === 0 ? t.base : t.soft
    svg += `<path d="${scallopRing(cx, cy, r, Math.max(6, Math.round(r * 0.55)), rng)}" fill="${fill}" stroke="${t.deep}" stroke-width="0.4" stroke-opacity="0.5"/>`
  })
  svg += `<circle cx="50" cy="44" r="2.4" fill="${BUTTON}"/><circle cx="50" cy="44" r="1.1" fill="${mix(BUTTON, '#222417', 0.55)}"/>`
  return OPEN + svg + CLOSE
}

/** Lisianthus: open ruffled cup, visible stamens, and the tell-tale spiral buds. */
const lisianthus: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 2903 + 7)
  const t = tones(c)
  let svg = stalk(rng)
  // Spiral buds on a side branch — the variety's signature.
  svg += `<path d="M58 66 Q 71 58 77 46 M62 70 Q 72 68 80 62" stroke="${STEM}" stroke-width="1.6" fill="none"/>`
  for (const [bx, by, br, ba] of [
    [78, 42, 5.2, 16], [81, 59, 4.2, 30],
  ] as const) {
    svg +=
      `<g transform="rotate(${ba} ${bx} ${by})">` +
      `<path d="M${bx},${r2(by - br * 1.5)} C${r2(bx + br)},${r2(by - br * 0.7)} ${r2(bx + br * 0.8)},${r2(by + br)} ${bx},${r2(by + br * 1.4)} C${r2(bx - br * 0.8)},${r2(by + br)} ${r2(bx - br)},${r2(by - br * 0.7)} ${bx},${r2(by - br * 1.5)}Z" fill="${t.soft}" stroke="${t.deep}" stroke-width="0.45" stroke-opacity="0.5"/>` +
      `<path d="M${bx},${r2(by - br * 1.3)} Q${r2(bx + br * 0.5)},${by} ${r2(bx - br * 0.2)},${r2(by + br * 1.1)}" fill="none" stroke="${t.shade}" stroke-width="0.6" opacity="0.8"/>` +
      `<path d="M${bx},${r2(by + br * 1.4)} l-1.6,2.6 M${bx},${r2(by + br * 1.4)} l1.6,2.6" stroke="${LEAF_DEEP}" stroke-width="0.9" stroke-linecap="round"/>` +
      `</g>`
  }
  svg += petalRing(50, 40, 6, 27 * 0.18, 27 * 0.5, 27 * 0.78, 0.5, rng, {
    fill: t.base, edge: t.deep, baseShade: t.shade,
  })
  svg += petalRing(50, 40, 5, 27 * 0.08, 27 * 0.4, 27 * 0.58, 0.45, rng, {
    fill: t.soft, edge: t.deep, baseShade: t.shade,
  }, 36)
  // Stamens.
  svg += `<circle cx="50" cy="40" r="3.4" fill="${t.tint}"/>`
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + jitter(rng, 0.3)
    svg += `<circle cx="${r2(50 + Math.cos(a) * 2.6)}" cy="${r2(40 + Math.sin(a) * 2.6)}" r="1.05" fill="${STAMEN}"/>`
  }
  svg += `<circle cx="50" cy="40" r="1" fill="${STAMEN_DEEP}"/>`
  return OPEN + svg + CLOSE
}

/** Carnation: fringed (serrated) petal fans above the distinctive calyx. */
const carnation: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 3821 + 41)
  const t = tones(c)

  const serratedFan = (r1: number, halfAngle: number, teeth: number, fill: string, rot: number) => {
    const pt = (deg: number, rr: number): Pt => {
      const a = ((deg - 90) * Math.PI) / 180
      return { x: 50 + Math.cos(a) * rr, y: 46 + Math.sin(a) * rr }
    }
    const start = pt(-halfAngle * 0.4, 2)
    let d = `M${r2(start.x)},${r2(start.y)}`
    const steps = teeth * 2
    for (let i = 0; i <= steps; i++) {
      const deg = -halfAngle + (i / steps) * halfAngle * 2
      const rr = (i % 2 === 0 ? r1 * 0.86 : r1) * (1 + jitter(rng, 0.05))
      const p = pt(deg, rr)
      d += `L${r2(p.x)},${r2(p.y)}`
    }
    const end = pt(halfAngle * 0.4, 2)
    d += `L${r2(end.x)},${r2(end.y)}Z`
    return `<path d="${d}" fill="${fill}" stroke="${t.deep}" stroke-width="0.4" stroke-opacity="0.5" transform="rotate(${r2(rot)} 50 46)"/>`
  }

  let svg = stalk(rng, 70)
  // Calyx first (behind the bloom): the tubular green base.
  svg += `<path d="M45.5 56 C45 66 46.5 71 48.4 74 L51.6 74 C53.5 71 55 66 54.5 56 Q50 60 45.5 56Z" fill="${LEAF}" stroke="${LEAF_DEEP}" stroke-width="0.5" stroke-opacity="0.6"/>`
  svg += `<path d="M46 57 l-2 -3.4 M54 57 l2 -3.4 M50 58.5 l0 -3.5" stroke="${LEAF_DEEP}" stroke-width="0.9" stroke-linecap="round"/>`
  svg += serratedFan(24, 78, 9, t.base, jitter(rng, 6))
  svg += serratedFan(19, 66, 8, t.soft, -14 + jitter(rng, 5))
  svg += serratedFan(14.5, 52, 7, mix(t.base, t.shade, 0.35), 10 + jitter(rng, 5))
  svg += serratedFan(9.5, 40, 5, t.base, jitter(rng, 8))
  return OPEN + svg + CLOSE
}

/** Hydrangea: a mophead dome of four-petalled florets, edge ones foreshortened. */
const hydrangea: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 2477 + 13)
  const t = tones(c)

  const floret = (r: number, hueShift: number): string => {
    const fill = mix(c.petal, c.accent, hueShift)
    let f = ''
    const phase = jitter(rng, 45)
    for (let k = 0; k < 4; k++) {
      f += `<g transform="rotate(${r2(phase + k * 90)})">${flatPetal(r * 0.6, r * 1.12, 0.22, rng, {
        fill,
        edge: t.deep,
      })}</g>`
    }
    f += `<circle r="${r2(r * 0.16)}" fill="${lighten(c.accent, 0.3)}"/>`
    return f
  }

  let svg = stalk(rng, 66)
  const cx = 50
  const cy = 40
  const spots: Array<[number, number, number]> = [
    [50, 21, 6.6], [36, 26, 6.4], [64, 26, 6.4], [25, 37, 6.2], [50, 34, 7],
    [75, 37, 6.2], [21, 51, 5.8], [37, 47, 6.9], [63, 47, 6.9], [79, 51, 5.8],
    [30, 59, 6], [50, 57, 6.7], [70, 59, 6],
  ]
  for (const [x, y, r] of spots) {
    const dx = x - cx
    const dy = y - cy
    const dist = Math.hypot(dx, dy)
    // Perimeter florets tilt away — foreshorten them along the radial axis.
    const squash = dist > 20 ? 0.74 : 1
    const outAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
    svg +=
      `<g transform="translate(${r2(x + jitter(rng, 1.4))} ${r2(y + jitter(rng, 1.4))}) rotate(${r2(squash < 1 ? outAngle : 0)}) scale(1 ${squash})">` +
      floret(r * (1 + jitter(rng, 0.09)), rng() * 0.32) +
      `</g>`
  }
  return OPEN + svg + CLOSE
}

/** Delphinium: a true raceme — pedicelled florets with pale "bees", buds at the tip. */
const delphinium: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 1987 + 19)
  const t = tones(c)
  let svg = `<path d="M50 14 Q ${r2(49 + jitter(rng, 2))} 84 50 150" stroke="${STEM}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
  // Buds at the tip.
  for (const [bx, by, br] of [[50, 11, 2.1], [46.5, 16, 2.6], [53.5, 19, 2.9]] as const) {
    svg += `<ellipse cx="${bx}" cy="${by}" rx="${r2(br * 0.72)}" ry="${br}" fill="${mix(t.shade, t.base, 0.3)}" stroke="${t.deep}" stroke-width="0.4" stroke-opacity="0.5" transform="rotate(${r2(jitter(rng, 24))} ${bx} ${by})"/>`
  }
  // Open florets, larger toward the bottom, on short pedicels.
  const florets: Array<[number, number, number]> = [
    [43, 26, 4.4], [58, 32, 5], [41, 40, 5.6], [60, 48, 6], [41, 56, 6.4],
    [59, 65, 6.6], [42, 74, 6.8], [58, 83, 6.6], [44, 91, 6.2],
  ]
  for (const [x, y, r] of florets) {
    svg += `<path d="M50 ${y + 2} L${x} ${y}" stroke="${STEM}" stroke-width="1" opacity="0.9"/>`
    const phase = jitter(rng, 36)
    for (let k = 0; k < 5; k++) {
      svg += `<g transform="translate(${r2(x + jitter(rng, 0.8))} ${r2(y + jitter(rng, 0.8))}) rotate(${r2(phase + k * 72)})">${flatPetal(r * 0.52, r, 0.28, rng, { fill: t.base, edge: t.deep })}</g>`
    }
    // The "bee" — the pale centre that identifies delphinium at a glance.
    svg += `<circle cx="${x}" cy="${y}" r="${r2(r * 0.3)}" fill="#f2efe2"/>`
    svg += `<circle cx="${x}" cy="${y}" r="${r2(r * 0.12)}" fill="${t.deep}"/>`
  }
  svg += simpleLeaf(39, 112, -32, 12, rng)
  return OPEN + svg + CLOSE
}

/** Gypsophila: fine twice-branched wiry stems tipped with tiny double blooms. */
const gypsophila: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 1663 + 23)
  const t = tones(c)

  const bloom = (x: number, y: number, r: number): string => {
    let b = ''
    const phase = jitter(rng, 36)
    for (let k = 0; k < 5; k++) {
      const a = ((phase + k * 72) * Math.PI) / 180
      b += `<ellipse cx="${r2(x + Math.cos(a) * r * 0.55)}" cy="${r2(y + Math.sin(a) * r * 0.55)}" rx="${r2(r * 0.5)}" ry="${r2(r * 0.36)}" fill="${t.base}" stroke="${t.deep}" stroke-width="0.25" stroke-opacity="0.5" transform="rotate(${r2(phase + k * 72)} ${r2(x)} ${r2(y)})"/>`
    }
    for (let k = 0; k < 5; k++) {
      const a = ((phase + 36 + k * 72) * Math.PI) / 180
      b += `<ellipse cx="${r2(x + Math.cos(a) * r * 0.28)}" cy="${r2(y + Math.sin(a) * r * 0.28)}" rx="${r2(r * 0.3)}" ry="${r2(r * 0.22)}" fill="${lighten(t.base, 0.12)}" transform="rotate(${r2(phase + 36 + k * 72)} ${r2(x)} ${r2(y)})"/>`
    }
    b += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r * 0.14)}" fill="${STAMEN_DEEP}" opacity="0.7"/>`
    return b
  }

  let svg = `<g stroke="${STEM}" stroke-width="1" fill="none" stroke-linecap="round">`
  svg += `<path d="M50 150 Q 50 104 50 66"/><path d="M50 98 Q 35 78 25 56"/><path d="M50 98 Q 65 76 75 52"/>`
  svg += `<path d="M50 76 Q 41 58 38 40"/><path d="M50 76 Q 61 60 65 36"/>`
  svg += `<path d="M25 56 Q 21 47 16 40"/><path d="M25 56 Q 30 46 28 38"/>`
  svg += `<path d="M75 52 Q 81 44 86 36"/><path d="M75 52 Q 72 42 74 34"/>`
  svg += `<path d="M38 40 Q 34 32 34 26"/><path d="M65 36 Q 68 28 66 22"/>`
  svg += `</g>`
  const tips: Array<[number, number]> = [
    [50, 62], [16, 37], [28, 35], [86, 33], [74, 31], [34, 23], [66, 19],
    [38, 37], [65, 33], [56, 44], [43, 48], [70, 60], [30, 62],
  ]
  for (const [x, y] of tips) {
    svg += bloom(x + jitter(rng, 2), y + jitter(rng, 2), 2.9 + jitter(rng, 0.6))
  }
  // A few unopened buds.
  for (let k = 0; k < 4; k++) {
    svg += `<circle cx="${r2(24 + rng() * 52)}" cy="${r2(28 + rng() * 34)}" r="${r2(0.9 + rng() * 0.5)}" fill="${t.soft}"/>`
  }
  return OPEN + svg + CLOSE
}

/** Spray rose: a branched head of small rosettes plus pointed sepalled buds. */
const sprayRose: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 4241 + 17)
  const t = tones(c)

  const miniRose = (x: number, y: number, R: number): string => {
    let m = petalRing(x, y, 6, R * 0.32, R * 0.5, R * 0.6, 0.3, rng, {
      fill: t.base, edge: t.deep, baseShade: t.shade,
    })
    m += petalRing(x, y, 5, R * 0.14, R * 0.38, R * 0.46, 0.28, rng, {
      fill: t.soft, edge: t.deep,
    }, 36)
    m += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(R * 0.16)}" fill="${t.soft}"/>`
    const a0 = rng() * Math.PI * 2
    const swirlR = R * 0.13
    m += `<path d="M${r2(x + Math.cos(a0) * swirlR)},${r2(y + Math.sin(a0) * swirlR)} A${r2(swirlR)},${r2(swirlR)} 0 1 1 ${r2(x - Math.cos(a0 + 0.6) * swirlR)},${r2(y - Math.sin(a0 + 0.6) * swirlR)}" fill="none" stroke="${t.shade}" stroke-width="0.8" stroke-linecap="round" opacity="0.85"/>`
    return m
  }

  let svg = stalk(rng, 72)
  svg += `<g stroke="${STEM}" stroke-width="1.7" fill="none" stroke-linecap="round">`
  svg += `<path d="M50 72 Q 40 54 33 36"/><path d="M50 72 Q 62 58 68 43"/><path d="M50 72 Q 50 62 50 55"/><path d="M50 72 Q 57 60 61 24"/>`
  svg += `</g>`
  svg += miniRose(33, 31, 13.5)
  svg += miniRose(68, 39, 12.5)
  svg += miniRose(50, 51, 11.5)
  // Pointed bud with sepals.
  svg += `<g transform="rotate(14 61 21)"><path d="M61,15 C63.6,17.5 63.4,22 61,25 C58.6,22 58.4,17.5 61,15Z" fill="${t.soft}" stroke="${t.deep}" stroke-width="0.4" stroke-opacity="0.5"/><path d="M61 25 l-2.2 3 M61 25 l2.2 3 M61 25 l0 3.4" stroke="${LEAF_DEEP}" stroke-width="0.8" stroke-linecap="round"/></g>`
  return OPEN + svg + CLOSE
}

/** Astilbe: tapering feathery plumes on fine branches. */
const astilbe: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 1301 + 31)
  const t = tones(c)
  let svg = `<path d="M50 78 Q ${r2(49 + jitter(rng, 2))} 114 50 150" stroke="${STEM}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
  svg += simpleLeaf(60 + jitter(rng, 2), 118, 30, 11, rng)

  const plume = (p0: Pt, p1: Pt, p2: Pt, maxW: number) => {
    let s = `<path d="M${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}" stroke="${mix(t.shade, STEM, 0.4)}" stroke-width="0.8" fill="none"/>`
    const dots = 34
    for (let i = 0; i < dots; i++) {
      const tt = i / dots
      const { p, tan } = quadPoint(p0, p1, p2, tt)
      const halfW = maxW * (1 - tt) * (0.55 + rng() * 0.45)
      const off = jitter(rng, halfW)
      const x = p.x - tan.y * off
      const y = p.y + tan.x * off
      const r = Math.max(0.45, (1 - tt) * (0.8 + rng() * 0.9))
      s += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="${i % 3 === 0 ? t.soft : t.base}" opacity="${r2(0.75 + rng() * 0.25)}"/>`
    }
    return s
  }

  svg += plume({ x: 50, y: 78 }, { x: 49, y: 44 }, { x: 50, y: 12 }, 6.5)
  svg += plume({ x: 50, y: 74 }, { x: 40, y: 56 }, { x: 33, y: 34 }, 4.5)
  svg += plume({ x: 50, y: 72 }, { x: 60, y: 56 }, { x: 66, y: 38 }, 4.5)
  svg += plume({ x: 50, y: 66 }, { x: 44, y: 54 }, { x: 41, y: 46 }, 3)
  return OPEN + svg + CLOSE
}

/**
 * Silver Dollar Eucalyptus: irregular rounded leaves — NOT circles — on short
 * petioles along an arcing reddish stem, overlapping naturally, glaucous
 * two-tone faces with a faint central vein.
 */
const eucalyptus: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 1097 + 37)
  const t = tones(c)
  const stemColor = mix(STEM, '#96634d', 0.35)
  const p0: Pt = { x: 50, y: 150 }
  const p1: Pt = { x: 44 + jitter(rng, 4), y: 84 }
  const p2: Pt = { x: 54 + jitter(rng, 4), y: 14 }
  let svg = `<path d="M${p0.x} ${p0.y} Q ${r2(p1.x)} ${r2(p1.y)} ${r2(p2.x)} ${r2(p2.y)}" stroke="${stemColor}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`

  const leafCount = 9
  for (let i = 0; i < leafCount; i++) {
    const tt = 0.16 + (i / (leafCount - 1)) * 0.78
    const { p, tan } = quadPoint(p0, p1, p2, tt)
    const side = i % 2 === 0 ? -1 : 1
    const size = (9.8 - tt * 3.6) * (1 + jitter(rng, 0.1))
    // Perpendicular to the stem, drooping slightly downward.
    const perp = { x: -tan.y * side, y: tan.x * side }
    const droop = 0.25 + jitter(rng, 0.12)
    const dir = { x: perp.x, y: perp.y + droop }
    const dlen = Math.hypot(dir.x, dir.y)
    const petioleLen = 2.6 + jitter(rng, 0.6)
    const attach = { x: p.x + (dir.x / dlen) * petioleLen, y: p.y + (dir.y / dlen) * petioleLen }
    const centre = {
      x: p.x + (dir.x / dlen) * (petioleLen + size * 0.82),
      y: p.y + (dir.y / dlen) * (petioleLen + size * 0.82),
    }
    svg += `<path d="M${r2(p.x)},${r2(p.y)} L${r2(attach.x)},${r2(attach.y)}" stroke="${stemColor}" stroke-width="1" stroke-linecap="round"/>`
    const face = [t.base, mix(t.base, t.shade, 0.3), mix(t.base, t.tint, 0.5)][i % 3]
    const leafPath = blobPath(centre.x, centre.y, size, rng, 0.085, 0.9 + jitter(rng, 0.08), 9)
    svg += `<path d="${leafPath}" fill="${face}" stroke="${t.deep}" stroke-width="0.5" stroke-opacity="0.45"/>`
    // Faint central vein from the petiole across the blade.
    const veinEnd = {
      x: attach.x + (centre.x - attach.x) * 1.55,
      y: attach.y + (centre.y - attach.y) * 1.55,
    }
    svg += `<path d="M${r2(attach.x)},${r2(attach.y)} Q${r2(centre.x)},${r2(centre.y)} ${r2(veinEnd.x)},${r2(veinEnd.y)}" fill="none" stroke="${t.deep}" stroke-width="0.45" opacity="0.35"/>`
  }
  // Small terminal leaf pair.
  const tip = quadPoint(p0, p1, p2, 0.97).p
  svg += `<path d="${blobPath(tip.x - 3.4, tip.y - 2.5, 4, rng, 0.1, 0.92, 8)}" fill="${t.base}" stroke="${t.deep}" stroke-width="0.45" stroke-opacity="0.45"/>`
  svg += `<path d="${blobPath(tip.x + 3.6, tip.y - 4, 3.4, rng, 0.1, 0.92, 8)}" fill="${mix(t.base, t.tint, 0.4)}" stroke="${t.deep}" stroke-width="0.45" stroke-opacity="0.45"/>`
  return OPEN + svg + CLOSE
}

/** Italian ruscus: arching stem of alternating glossy lance leaves. */
const ruscus: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 907 + 43)
  const t = tones(c)
  const p0: Pt = { x: 50, y: 150 }
  const p1: Pt = { x: 42 + jitter(rng, 3), y: 88 }
  const p2: Pt = { x: 60 + jitter(rng, 3), y: 12 }
  let svg = `<path d="M${p0.x} ${p0.y} Q ${r2(p1.x)} ${r2(p1.y)} ${r2(p2.x)} ${r2(p2.y)}" stroke="${STEM_EDGE}" stroke-width="2" fill="none" stroke-linecap="round"/>`
  const leaves = 10
  for (let i = 0; i < leaves; i++) {
    const tt = 0.14 + (i / (leaves - 1)) * 0.82
    const { p, tan } = quadPoint(p0, p1, p2, tt)
    const side = i % 2 === 0 ? -1 : 1
    const stemAngle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI
    const angle = stemAngle + side * (54 + jitter(rng, 8)) + 90
    const l = (13.5 - tt * 4) * (1 + jitter(rng, 0.1))
    const w = l * 0.3
    const bow = jitter(rng, l * 0.12)
    const fill = i % 3 === 1 ? mix(t.base, t.shade, 0.35) : t.base
    svg +=
      `<g transform="translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(angle)})">` +
      `<path d="M0,0 Q${r2(w + bow)},${r2(-l * 0.35)} ${r2(bow * 1.6)},${r2(-l)} Q${r2(-w + bow)},${r2(-l * 0.55)} 0,0Z" fill="${fill}" stroke="${t.deep}" stroke-width="0.45" stroke-opacity="0.5"/>` +
      `<path d="M0,${r2(-l * 0.06)} Q${r2(bow * 0.8)},${r2(-l * 0.5)} ${r2(bow * 1.4)},${r2(-l * 0.92)}" fill="none" stroke="${t.deep}" stroke-width="0.4" opacity="0.45"/>` +
      `</g>`
  }
  return OPEN + svg + CLOSE
}

/** Leatherleaf fern: the triangular bipinnate frond with serrated pinnae. */
const leatherleaf: SketchFn = (c, seed = 1) => {
  const rng = mulberry32(seed * 811 + 53)
  const t = tones(c)

  /** A serrated pinna pointing up in local coords (base 0,0 → tip 0,−len). */
  const pinna = (len: number, w: number, fill: string): string => {
    const teeth = Math.max(4, Math.round(len / 3.2))
    let d = 'M0,0'
    for (let i = 1; i <= teeth; i++) {
      const tt = i / teeth
      const xw = -w * (1 - tt * 0.85) * (i % 2 === 1 ? 1 : 0.6)
      d += `L${r2(xw)},${r2(-len * (tt - 0.5 / teeth))}`
    }
    d += `L0,${r2(-len)}`
    for (let i = teeth; i >= 1; i--) {
      const tt = i / teeth
      const xw = w * (1 - tt * 0.85) * (i % 2 === 1 ? 1 : 0.6)
      d += `L${r2(xw)},${r2(-len * (tt - 0.5 / teeth))}`
    }
    d += 'Z'
    return (
      `<path d="${d}" fill="${fill}" stroke="${t.deep}" stroke-width="0.35" stroke-opacity="0.5"/>` +
      `<path d="M0,0 L0,${r2(-len * 0.92)}" stroke="${t.deep}" stroke-width="0.4" opacity="0.5"/>`
    )
  }

  const p0: Pt = { x: 50, y: 150 }
  const p1: Pt = { x: 47 + jitter(rng, 3), y: 92 }
  const p2: Pt = { x: 53 + jitter(rng, 3), y: 14 }
  let svg = `<path d="M${p0.x} ${p0.y} Q ${r2(p1.x)} ${r2(p1.y)} ${r2(p2.x)} ${r2(p2.y)}" stroke="${t.deep}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`
  const pairs = 8
  for (let i = 0; i < pairs; i++) {
    const tt = 0.3 + (i / (pairs - 1)) * 0.64
    const { p, tan } = quadPoint(p0, p1, p2, tt)
    const stemAngle = (Math.atan2(tan.y, tan.x) * 180) / Math.PI
    const len = (26 - i * 2.6) * (1 + jitter(rng, 0.08))
    const w = len * 0.24
    const fill = i % 2 === 0 ? t.base : mix(t.base, t.tint, 0.35)
    for (const side of [-1, 1] as const) {
      const angle = stemAngle + 90 + side * (62 + jitter(rng, 6))
      svg += `<g transform="translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(angle)})">${pinna(len, w, fill)}</g>`
    }
  }
  // Terminal pinna continuing the rachis.
  const tip = quadPoint(p0, p1, p2, 0.97)
  const tipAngle = (Math.atan2(tip.tan.y, tip.tan.x) * 180) / Math.PI + 90
  svg += `<g transform="translate(${r2(tip.p.x)} ${r2(tip.p.y)}) rotate(${r2(tipAngle + 180)})">${pinna(11, 2.8, t.base)}</g>`
  return OPEN + svg + CLOSE
}

export const SKETCHES: Record<string, SketchFn> = {
  rose,
  peony,
  ranunculus,
  lisianthus,
  carnation,
  hydrangea,
  delphinium,
  gypsophila,
  'spray-rose': sprayRose,
  astilbe,
  eucalyptus,
  ruscus,
  leatherleaf,
}

/* ------------------------------- vessels ------------------------------- */

const VESSEL_OPEN = '<svg viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg">'

const wrap = () =>
  VESSEL_OPEN +
  `<path d="M56 8 L204 8 L162 186 L98 186 Z" fill="#c9a87c"/>` +
  `<path d="M56 8 L130 30 L204 8 L162 186 L98 186 Z" fill="#bd9a6c"/>` +
  `<path d="M56 8 L130 30 L98 186 Z" fill="#a5855c" opacity="0.5"/>` +
  `<path d="M130 30 L204 8 L162 186 Z" fill="#d5b78e" opacity="0.45"/>` +
  `<path d="M100 178 L160 178 L162 186 L98 186 Z" fill="#8a6a45" opacity="0.4"/>` +
  `<rect x="84" y="88" width="94" height="15" rx="3" fill="#a8626e" transform="rotate(-2 130 96)"/>` +
  `<circle cx="130" cy="95" r="7" fill="#8f4e5b"/>` +
  `<path d="M123 100 l-12 18 M137 100 l13 17" stroke="#8f4e5b" stroke-width="5" stroke-linecap="round"/>` +
  CLOSE

const compote = () =>
  VESSEL_OPEN +
  `<ellipse cx="130" cy="34" rx="92" ry="20" fill="#b9b2a2"/>` +
  `<path d="M38 34 Q 42 86 92 100 L168 100 Q 218 86 222 34 Z" fill="#ccc7bb"/>` +
  `<path d="M38 34 Q 42 86 92 100 L116 100 Q 66 84 56 34 Z" fill="#b3ad9e" opacity="0.6"/>` +
  `<rect x="118" y="100" width="24" height="52" fill="#c4bfb1"/>` +
  `<path d="M118 100 h8 v52 h-8 Z" fill="#a8a292" opacity="0.5"/>` +
  `<ellipse cx="130" cy="162" rx="52" ry="13" fill="#b5afa0"/>` +
  `<ellipse cx="130" cy="158" rx="52" ry="13" fill="#d3cec1"/>` +
  `<ellipse cx="130" cy="34" rx="80" ry="15" fill="#8d877a" opacity="0.5"/>` +
  CLOSE

export const VESSEL_SKETCHES: Record<string, () => string> = {
  wrap,
  compote,
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
