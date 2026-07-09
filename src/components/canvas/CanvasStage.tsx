import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { useStudio } from '../../domain/store'
import { CANVAS_HEIGHT, CANVAS_WIDTH, type PlacedStem } from '../../domain/types'
import { FLOWER_INDEX, VESSEL_INDEX, getColorway } from '../../data/catalog'
import { SKETCHES, VESSEL_SKETCHES } from '../../assets/sketches'

/**
 * The Milestone-1 canvas renderer, DOM-based. The scene model (design doc +
 * command log) is renderer-agnostic: this component is the seam where a
 * WebGL renderer (PixiJS) slots in once the photographic asset library and
 * larger stem counts arrive (see docs/ARCHITECTURE.md).
 */

// Sketch artwork is 100×160 units; the bloom head centre sits at (50, 42) and
// the stem base at (50, 152). These drive the sprite anchor and pivot.
const STEM_WIDTH = 120
const STEM_HEIGHT = 192
const HEAD_ANCHOR_Y = '26%'
const PIVOT = '50% 95%'

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)

  const stems = useStudio((s) => s.doc.stems)
  const vesselId = useStudio((s) => s.doc.vesselId)
  const showFormGuide = useStudio((s) => s.showFormGuide)
  const learningMode = useStudio((s) => s.learningMode)
  const select = useStudio((s) => s.select)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setK(el.clientWidth / CANVAS_WIDTH)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const sorted = [...stems].sort((a, b) => a.z - b.z)
  const vessel = vesselId ? VESSEL_INDEX[vesselId] : null

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full"
      style={{ maxWidth: 'calc((100vh - 220px) * 1.40625)' }}
    >
      <div
        id="bloom-canvas"
        role="application"
        aria-label="Design canvas"
        className="relative overflow-hidden rounded-2xl border border-bloom-200 shadow-inner"
        style={{
          height: CANVAS_HEIGHT * k,
          background:
            'radial-gradient(ellipse 90% 70% at 50% 42%, #fdfbf7 0%, #f5efe3 68%, #ece3d0 100%)',
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) select(null)
        }}
      >
        {vessel && <VesselSprite sketchId={vessel.sketch} mode={vessel.renderMode} k={k} stemCount={sorted.length} />}
        {sorted.map((stem, index) => (
          <StemSprite key={stem.id} stem={stem} k={k} zIndex={index + 10} />
        ))}
        {learningMode && showFormGuide && <FormGuide />}
      </div>
    </div>
  )
}

function StemSprite({ stem, k, zIndex }: { stem: PlacedStem; k: number; zIndex: number }) {
  const selectedId = useStudio((s) => s.selectedId)
  const select = useStudio((s) => s.select)
  const beginTransform = useStudio((s) => s.beginTransform)
  const setStemTransient = useStudio((s) => s.setStemTransient)
  const endTransform = useStudio((s) => s.endTransform)

  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  const variety = FLOWER_INDEX[stem.varietyId]
  if (!variety) return null
  const colorway = getColorway(stem.varietyId, stem.colorwayId)
  const Sketch = SKETCHES[variety.sketch]
  if (!Sketch || !colorway) return null

  const selected = selectedId === stem.id

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    select(stem.id)
    beginTransform(stem.id)
    dragStart.current = { px: e.clientX, py: e.clientY, x: stem.x, y: stem.y }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic events (tests, assistive tech) have no active pointer to capture.
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current
    if (!start) return
    const x = clamp(start.x + (e.clientX - start.px) / k, 0, CANVAS_WIDTH)
    const y = clamp(start.y + (e.clientY - start.py) / k, 0, CANVAS_HEIGHT)
    setStemTransient(stem.id, { x, y })
  }

  const onPointerUp = () => {
    if (!dragStart.current) return
    dragStart.current = null
    endTransform(stem.id)
  }

  return (
    <div
      className={`absolute cursor-grab touch-none active:cursor-grabbing ${
        selected ? 'outline-dashed outline-2 outline-offset-2 outline-bloom-600/70' : ''
      }`}
      style={{
        left: stem.x * k,
        top: stem.y * k,
        width: STEM_WIDTH * stem.scale * k,
        height: STEM_HEIGHT * stem.scale * k,
        zIndex,
        transform: `translate(-50%, -${HEAD_ANCHOR_Y}) rotate(${stem.rotation}deg)${stem.flipX ? ' scaleX(-1)' : ''}`,
        transformOrigin: PIVOT,
      }}
      tabIndex={0}
      role="button"
      aria-label={`${variety.commonName}, ${colorway.name}${selected ? ', selected' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onFocus={() => select(stem.id)}
    >
      <Sketch petal={colorway.petal} accent={colorway.accent} />
    </div>
  )
}

function VesselSprite({
  sketchId,
  mode,
  k,
  stemCount,
}: {
  sketchId: string
  mode: 'behind' | 'front'
  k: number
  stemCount: number
}) {
  const Sketch = VESSEL_SKETCHES[sketchId]
  if (!Sketch) return null
  const isWrap = mode === 'front'
  // Geometry mirrored by the proportion insight in education/insights.ts.
  const width = isWrap ? 250 : 210
  const height = isWrap ? 192 : 162
  const top = isWrap ? CANVAS_HEIGHT - 232 : CANVAS_HEIGHT - 172
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: (CANVAS_WIDTH / 2) * k,
        top: top * k,
        width: width * k,
        height: height * k,
        transform: 'translateX(-50%)',
        zIndex: isWrap ? stemCount + 20 : 5,
      }}
    >
      <Sketch />
    </div>
  )
}

/** Dashed overlay showing the classic round-bouquet form and focal zone. */
function FormGuide() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
    >
      <ellipse
        cx={450}
        cy={295}
        rx={215}
        ry={160}
        fill="none"
        stroke="#6f8161"
        strokeWidth={1.5}
        strokeDasharray="8 7"
        opacity={0.55}
      />
      <circle
        cx={450}
        cy={330}
        r={62}
        fill="none"
        stroke="#b0715f"
        strokeWidth={1.5}
        strokeDasharray="5 6"
        opacity={0.6}
      />
      <text x={450} y={120} textAnchor="middle" fontSize={15} fill="#6f8161" opacity={0.8}>
        round form guide
      </text>
      <text x={450} y={415} textAnchor="middle" fontSize={13} fill="#b0715f" opacity={0.8}>
        focal zone
      </text>
    </svg>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
