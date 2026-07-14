/**
 * Vessel artwork (kraft wrap, footed compote) as inline SVG strings,
 * rasterised to GPU textures in render/textures.ts. Flowers themselves are
 * supplied photographic assets (see docs/ASSET-STRATEGY.md); this module only
 * covers the containers.
 */

const OPEN = '<svg viewBox="0 0 260 200" xmlns="http://www.w3.org/2000/svg">'
const CLOSE = '</svg>'

const wrap = () =>
  OPEN +
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
  OPEN +
  `<ellipse cx="130" cy="34" rx="92" ry="20" fill="#b9b2a2"/>` +
  `<path d="M38 34 Q 42 86 92 100 L168 100 Q 218 86 222 34 Z" fill="#ccc7bb"/>` +
  `<path d="M38 34 Q 42 86 92 100 L116 100 Q 66 84 56 34 Z" fill="#b3ad9e" opacity="0.6"/>` +
  `<rect x="118" y="100" width="24" height="52" fill="#c4bfb1"/>` +
  `<path d="M118 100 h8 v52 h-8 Z" fill="#a8a292" opacity="0.5"/>` +
  `<ellipse cx="130" cy="162" rx="52" ry="13" fill="#b5afa0"/>` +
  `<ellipse cx="130" cy="158" rx="52" ry="13" fill="#d3cec1"/>` +
  `<ellipse cx="130" cy="34" rx="80" ry="15" fill="#8d877a" opacity="0.5"/>` +
  CLOSE

export const VESSEL_SKETCHES: Record<string, () => string> = { wrap, compote }

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
