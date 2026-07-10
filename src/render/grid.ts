/**
 * Adaptive grid maths (CAD behaviour): the displayed spacing chooses itself
 * from a 1–2–5 progression so grid density stays visually constant at every
 * zoom level. Pure functions — the scene draws, this decides.
 */

const CANDIDATES_MM = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

export interface GridSteps {
  /** Minor line spacing, mm. */
  minor: number
  /** Major (emphasised) line spacing, mm. */
  major: number
}

export function gridSteps(pxPerMm: number, minPixelSpacing = 14): GridSteps {
  const minor =
    CANDIDATES_MM.find((step) => step * pxPerMm >= minPixelSpacing) ??
    CANDIDATES_MM[CANDIDATES_MM.length - 1]
  return { minor, major: minor * 5 }
}

export function snapToGrid(value: number, stepMm: number): number {
  return Math.round(value / stepMm) * stepMm
}
