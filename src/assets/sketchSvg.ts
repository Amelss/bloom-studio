/**
 * Single-source sketch artwork as SVG strings, parameterised by colorway.
 * Consumed two ways: rasterised into GPU textures for the canvas
 * (render/textures.ts) and as data-URL thumbnails in the library panel.
 *
 * This placeholder style is replaced by the high-fidelity illustration
 * pipeline in Phase C; the registry key on each variety is the swap seam.
 */

const STEM = '#6b7f5e'
const LEAF = '#7d9070'

export interface SketchColors {
  petal: string
  accent: string
}

type SketchFn = (c: SketchColors) => string

const OPEN = '<svg viewBox="0 0 100 160" xmlns="http://www.w3.org/2000/svg">'
const CLOSE = '</svg>'

const stalk = (from = 58) =>
  `<path d="M50 ${from} Q 48 ${from + 40} 50 152" stroke="${STEM}" stroke-width="3" fill="none" stroke-linecap="round"/>`

const leaves = () =>
  `<g fill="${LEAF}">` +
  `<ellipse cx="40" cy="100" rx="10" ry="4.5" transform="rotate(-38 40 100)"/>` +
  `<ellipse cx="60" cy="118" rx="9" ry="4" transform="rotate(34 60 118)"/>` +
  `</g>`

const ring = (cx: number, cy: number, angles: number[], rx: number, ry: number, fill: string, opacity: number) =>
  angles
    .map(
      (a) =>
        `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${a} ${cx} ${cy})" fill="${fill}" opacity="${opacity}"/>`,
    )
    .join('')

const rose: SketchFn = ({ petal, accent }) =>
  OPEN +
  stalk() +
  leaves() +
  ring(50, 42, [0, 60, 120, 180, 240, 300], 27, 17, petal, 0.5) +
  `<circle cx="50" cy="42" r="21" fill="${petal}"/>` +
  ring(50, 42, [20, 140, 260], 15, 9.5, accent, 0.45) +
  `<circle cx="50" cy="42" r="10.5" fill="${petal}"/>` +
  `<path d="M50 42 m-8 0 a8 8 0 1 1 16 0 a6 6 0 1 1 -12 0 a4 4 0 1 1 8 0" fill="none" stroke="${accent}" stroke-width="2" opacity="0.8"/>` +
  `<circle cx="50" cy="42" r="2.6" fill="${accent}"/>` +
  CLOSE

const peony: SketchFn = ({ petal, accent }) =>
  OPEN +
  stalk(62) +
  leaves() +
  ring(50, 42, [0, 45, 90, 135, 180, 225, 270, 315], 31, 19, petal, 0.45) +
  `<circle cx="50" cy="42" r="25" fill="${petal}" opacity="0.9"/>` +
  ring(50, 42, [15, 75, 135, 195, 255, 315], 17, 10, accent, 0.35) +
  `<circle cx="50" cy="42" r="13" fill="${petal}"/>` +
  ring(50, 42, [40, 160, 280], 9, 5.5, accent, 0.5) +
  `<circle cx="50" cy="42" r="3.5" fill="${accent}" opacity="0.9"/>` +
  CLOSE

const ranunculus: SketchFn = ({ petal, accent }) =>
  OPEN +
  stalk() +
  leaves() +
  `<circle cx="50" cy="44" r="23" fill="${petal}"/>` +
  [19.5, 16, 12.5, 9, 5.5]
    .map((r) => `<circle cx="50" cy="44" r="${r}" fill="none" stroke="${accent}" stroke-width="1.4" opacity="0.65"/>`)
    .join('') +
  `<circle cx="50" cy="44" r="2.4" fill="#4a4436"/>` +
  CLOSE

const lisianthus: SketchFn = ({ petal, accent }) =>
  OPEN +
  stalk() +
  leaves() +
  `<path d="M62 66 Q 74 58 78 44" stroke="${STEM}" stroke-width="2" fill="none"/>` +
  `<ellipse cx="79" cy="40" rx="6" ry="9" fill="${petal}" opacity="0.9"/>` +
  ring(50, 40, [0, 72, 144, 216, 288], 13, 22, petal, 0.75) +
  `<circle cx="50" cy="40" r="9" fill="${accent}" opacity="0.55"/>` +
  `<circle cx="50" cy="40" r="4" fill="#6d6142"/>` +
  CLOSE

const carnation: SketchFn = ({ petal, accent }) =>
  OPEN +
  stalk() +
  leaves() +
  ring(50, 42, [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], 8, 20, petal, 0.6) +
  `<circle cx="50" cy="42" r="14" fill="${petal}"/>` +
  `<path d="M38 38 l4 -5 4 5 4 -6 4 6 4 -5 4 5" stroke="${accent}" stroke-width="2" fill="none" stroke-linejoin="round"/>` +
  `<path d="M40 48 l4 -4 3 4 4 -5 4 5 3 -4 4 4" stroke="${accent}" stroke-width="1.6" fill="none" opacity="0.7"/>` +
  CLOSE

const floret = (x: number, y: number, r: number, petal: string, accent: string) =>
  [45, 135, 225, 315]
    .map((a) => {
      const px = x + Math.cos((a * Math.PI) / 180) * r * 0.8
      const py = y + Math.sin((a * Math.PI) / 180) * r * 0.8
      return `<circle cx="${round(px)}" cy="${round(py)}" r="${r}" fill="${petal}"/>`
    })
    .join('') + `<circle cx="${x}" cy="${y}" r="${round(r * 0.45)}" fill="${accent}"/>`

const hydrangea: SketchFn = ({ petal, accent }) =>
  OPEN +
  stalk(66) +
  leaves() +
  `<g opacity="0.97">` +
  (
    [
      [50, 22, 6], [34, 30, 6], [66, 30, 6], [24, 44, 6], [50, 40, 6.5],
      [76, 44, 6], [34, 56, 6], [66, 56, 6], [50, 60, 6],
    ] as const
  )
    .map(([x, y, r]) => floret(x, y, r, petal, accent))
    .join('') +
  `</g>` +
  CLOSE

const delphinium: SketchFn = ({ petal, accent }) =>
  OPEN +
  `<path d="M50 20 Q 49 90 50 152" stroke="${STEM}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
  (
    [
      [50, 12, 3], [43, 22, 4], [57, 26, 4.5], [42, 34, 5], [59, 40, 5.5],
      [41, 48, 6], [60, 55, 6], [42, 63, 6.5], [59, 71, 6.5], [44, 80, 6.5], [57, 88, 6],
    ] as const
  )
    .map(([x, y, r], i) =>
      i < 2
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${accent}" opacity="0.9"/>`
        : floret(x, y, r * 0.72, petal, accent),
    )
    .join('') +
  `<ellipse cx="38" cy="112" rx="11" ry="4" transform="rotate(-30 38 112)" fill="${LEAF}"/>` +
  CLOSE

const gypsophila: SketchFn = ({ petal, accent }) =>
  OPEN +
  `<g stroke="${STEM}" stroke-width="1.3" fill="none" stroke-linecap="round">` +
  `<path d="M50 152 Q 50 90 50 62"/><path d="M50 96 Q 34 76 24 54"/><path d="M50 96 Q 66 74 76 50"/>` +
  `<path d="M50 74 Q 40 56 38 38"/><path d="M50 74 Q 62 58 66 34"/>` +
  `<path d="M24 54 Q 20 46 16 40"/><path d="M76 50 Q 82 42 86 38"/>` +
  `</g>` +
  `<g fill="${petal}" stroke="${accent}" stroke-width="0.6">` +
  (
    [
      [50, 58, 3.4], [24, 50, 3], [76, 46, 3], [38, 34, 3.2], [66, 30, 3.2],
      [16, 36, 2.6], [86, 34, 2.6], [30, 62, 2.6], [58, 44, 2.8], [46, 44, 2.4], [70, 60, 2.6],
    ] as const
  )
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
    .join('') +
  `</g>` +
  CLOSE

const miniRose = (x: number, y: number, r: number, petal: string, accent: string) =>
  ring(x, y, [0, 72, 144, 216, 288], r, r * 0.62, petal, 0.6) +
  `<circle cx="${x}" cy="${y}" r="${round(r * 0.62)}" fill="${petal}"/>` +
  `<circle cx="${x}" cy="${y}" r="${round(r * 0.32)}" fill="${accent}" opacity="0.7"/>`

const sprayRose: SketchFn = ({ petal, accent }) =>
  OPEN +
  stalk(70) +
  leaves() +
  `<g stroke="${STEM}" stroke-width="2" fill="none">` +
  `<path d="M50 70 Q 40 52 34 34"/><path d="M50 70 Q 62 56 68 42"/><path d="M50 70 Q 50 62 50 56"/>` +
  `</g>` +
  miniRose(33, 30, 13, petal, accent) +
  miniRose(69, 38, 12, petal, accent) +
  miniRose(50, 52, 11, petal, accent) +
  CLOSE

const astilbe: SketchFn = ({ petal, accent }) => {
  let dots = ''
  for (let i = 0; i < 46; i++) {
    const t = i / 46
    const y = 12 + t * 62
    const halfWidth = 4 + t * 12
    const x = 50 + Math.sin(i * 12.9898) * halfWidth
    const r = 1.6 + ((i * 7) % 3) * 0.5
    dots += `<circle cx="${round(x)}" cy="${round(y)}" r="${r}" opacity="${i % 3 === 0 ? 0.7 : 0.95}"/>`
  }
  return (
    OPEN +
    `<path d="M50 74 Q 49 110 50 152" stroke="${STEM}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<ellipse cx="62" cy="116" rx="10" ry="4" transform="rotate(28 62 116)" fill="${LEAF}"/>` +
    `<g fill="${petal}">${dots}</g>` +
    `<path d="M50 74 Q 48 46 50 14" stroke="${accent}" stroke-width="1.2" fill="none" opacity="0.6"/>` +
    CLOSE
  )
}

const eucalyptus: SketchFn = ({ petal, accent }) =>
  OPEN +
  `<path d="M50 152 Q 46 90 52 16" stroke="${STEM}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
  `<g fill="${petal}" stroke="${accent}" stroke-width="1">` +
  (
    [
      [38, 34, 8], [64, 44, 8.5], [36, 58, 9], [66, 70, 9], [36, 84, 9.5],
      [64, 96, 9], [38, 112, 8.5], [62, 122, 8], [52, 22, 6.5],
    ] as const
  )
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
    .join('') +
  `</g>` +
  CLOSE

const ruscus: SketchFn = ({ petal, accent }) =>
  OPEN +
  `<path d="M50 152 Q 44 92 58 14" stroke="${STEM}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
  `<g fill="${petal}" stroke="${accent}" stroke-width="0.8">` +
  (
    [
      [40, 32, -46], [64, 42, 40], [38, 54, -44], [64, 64, 42], [38, 76, -40],
      [62, 86, 44], [40, 98, -42], [60, 108, 40], [56, 20, 10],
    ] as const
  )
    .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="4" ry="11" transform="rotate(${a} ${x} ${y})"/>`)
    .join('') +
  `</g>` +
  CLOSE

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
}

/* ------------------------------- Vessels ------------------------------- */

const VESSEL_OPEN = '<svg viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg">'

const wrap = () =>
  VESSEL_OPEN +
  `<path d="M56 8 L204 8 L162 186 L98 186 Z" fill="#c9a87c"/>` +
  `<path d="M56 8 L130 30 L204 8 L162 186 L98 186 Z" fill="#bd9a6c"/>` +
  `<path d="M56 8 L130 30 L98 186 Z" fill="#ab885c" opacity="0.6"/>` +
  `<path d="M130 30 L204 8 L162 186 Z" fill="#d2b189" opacity="0.5"/>` +
  `<rect x="84" y="88" width="94" height="16" rx="3" fill="#a8626e" transform="rotate(-2 130 96)"/>` +
  `<circle cx="130" cy="96" r="7" fill="#8f4e5b"/>` +
  `<path d="M123 100 l-12 18 M137 100 l13 17" stroke="#8f4e5b" stroke-width="5" stroke-linecap="round"/>` +
  CLOSE

const compote = () =>
  VESSEL_OPEN +
  `<ellipse cx="130" cy="34" rx="92" ry="20" fill="#b9b2a2"/>` +
  `<path d="M38 34 Q 42 86 92 100 L168 100 Q 218 86 222 34 Z" fill="#ccc7bb"/>` +
  `<path d="M38 34 Q 42 86 92 100 L112 100 Q 66 84 58 34 Z" fill="#b3ad9e" opacity="0.7"/>` +
  `<rect x="118" y="100" width="24" height="52" fill="#c4bfb1"/>` +
  `<path d="M118 100 h8 v52 h-8 Z" fill="#aaa494" opacity="0.6"/>` +
  `<ellipse cx="130" cy="162" rx="52" ry="13" fill="#ccc7bb"/>` +
  `<ellipse cx="130" cy="158" rx="52" ry="13" fill="#d8d3c6"/>` +
  `<ellipse cx="130" cy="34" rx="80" ry="15" fill="#8d877a" opacity="0.55"/>` +
  CLOSE

export const VESSEL_SKETCHES: Record<string, () => string> = {
  wrap,
  compote,
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
