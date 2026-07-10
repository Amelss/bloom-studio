/**
 * Figma-style smart alignment: while dragging, the moving point snaps to
 * neighbouring stems' bindings and the artboard's centre axes, and the scene
 * draws a guide line through whatever it snapped to.
 */

export interface GuideLine {
  axis: 'v' | 'h'
  /** World position of the guide (x for vertical, y for horizontal). */
  position: number
}

export interface SmartSnapResult {
  x: number
  y: number
  guides: GuideLine[]
}

export function findSmartSnap(
  x: number,
  y: number,
  targetsX: number[],
  targetsY: number[],
  thresholdMm: number,
): SmartSnapResult {
  const result: SmartSnapResult = { x, y, guides: [] }
  const bestX = nearest(x, targetsX, thresholdMm)
  if (bestX != null) {
    result.x = bestX
    result.guides.push({ axis: 'v', position: bestX })
  }
  const bestY = nearest(y, targetsY, thresholdMm)
  if (bestY != null) {
    result.y = bestY
    result.guides.push({ axis: 'h', position: bestY })
  }
  return result
}

function nearest(value: number, targets: number[], threshold: number): number | null {
  let best: number | null = null
  let bestDist = threshold
  for (const t of targets) {
    const d = Math.abs(t - value)
    if (d <= bestDist) {
      bestDist = d
      best = t
    }
  }
  return best
}
