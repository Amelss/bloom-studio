import { useEffect, useState } from 'react'
import { useStudio, type GridStepMm } from '../../domain/store'
import { FLOWER_INDEX } from '../../data/catalog'
import type { PaperOption } from '../../domain/types'
import { CAMERA_CHANGE_EVENT, canvasRegistry } from '../../render/registry'

const GRID_STEPS: GridStepMm[] = [5, 10, 25, 50]
const PAPERS: Array<{ id: PaperOption; label: string }> = [
  { id: 'white', label: 'White' },
  { id: 'ivory', label: 'Ivory' },
  { id: 'blush', label: 'Blush' },
  { id: 'charcoal', label: 'Charcoal' },
]

/** Zoom, grid, paper, and learning overlays — under the canvas. */
export function CanvasFooter() {
  const [zoom, setZoom] = useState(100)
  const learningMode = useStudio((s) => s.learningMode)
  const showFormGuide = useStudio((s) => s.showFormGuide)
  const setShowFormGuide = useStudio((s) => s.setShowFormGuide)
  const balanceVisible = useStudio((s) => s.balanceVisible)
  const setBalanceVisible = useStudio((s) => s.setBalanceVisible)
  const tiltEnabled = useStudio((s) => s.tiltEnabled)
  const setTiltEnabled = useStudio((s) => s.setTiltEnabled)
  const gridVisible = useStudio((s) => s.gridVisible)
  const setGridVisible = useStudio((s) => s.setGridVisible)
  const gridSnap = useStudio((s) => s.gridSnap)
  const setGridSnap = useStudio((s) => s.setGridSnap)
  const gridStepMm = useStudio((s) => s.gridStepMm)
  const setGridStepMm = useStudio((s) => s.setGridStepMm)
  const paper = useStudio((s) => s.doc.artboards[0]?.paper ?? 'white')
  const setPaper = useStudio((s) => s.setPaper)
  const brush = useStudio((s) => s.brush)
  const setBrush = useStudio((s) => s.setBrush)

  useEffect(() => {
    const update = () => {
      const percent = canvasRegistry.api?.getZoomPercent()
      if (percent) setZoom(percent)
    }
    update()
    canvasRegistry.emitter.addEventListener(CAMERA_CHANGE_EVENT, update)
    return () => canvasRegistry.emitter.removeEventListener(CAMERA_CHANGE_EVENT, update)
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1.5 text-xs">
      <div className="flex items-center gap-1" role="group" aria-label="Zoom">
        <button className="btn-icon" aria-label="Zoom out" title="Zoom out (−)"
          onClick={() => canvasRegistry.api?.zoomBy(0.8)}>−</button>
        <button
          className="btn min-w-[3.75rem] justify-center tabular-nums"
          aria-label={`Zoom level ${zoom} percent — click for 100%`}
          title="Zoom to 100% (⌘1)"
          onClick={() => canvasRegistry.api?.zoomTo100()}
        >
          {zoom}%
        </button>
        <button className="btn-icon" aria-label="Zoom in" title="Zoom in (+)"
          onClick={() => canvasRegistry.api?.zoomBy(1.25)}>＋</button>
        <button className="btn" title="Fit the artboard (⌘0)"
          onClick={() => canvasRegistry.api?.fitArtboard()}>Fit</button>
      </div>

      <span className="mx-1 h-5 w-px bg-bloom-200" aria-hidden />

      <div className="flex items-center gap-1" role="group" aria-label="Grid">
        <button
          className={`btn ${gridVisible ? 'bg-bloom-100 ring-1 ring-bloom-500' : ''}`}
          aria-pressed={gridVisible}
          title="Toggle grid (Shift+')"
          onClick={() => setGridVisible(!gridVisible)}
        >
          Grid
        </button>
        <label className="sr-only" htmlFor="grid-step">Grid snap step</label>
        <select
          id="grid-step"
          className="rounded-lg border border-bloom-200 bg-white px-1.5 py-1.5"
          value={gridStepMm}
          onChange={(e) => setGridStepMm(Number(e.target.value) as GridStepMm)}
        >
          {GRID_STEPS.map((step) => (
            <option key={step} value={step}>
              {step} mm
            </option>
          ))}
        </select>
        <button
          className={`btn ${gridSnap ? 'bg-bloom-100 ring-1 ring-bloom-500' : ''}`}
          aria-pressed={gridSnap}
          title="Snap to grid while dragging (hold ⌘ to suspend)"
          onClick={() => setGridSnap(!gridSnap)}
        >
          Snap
        </button>
      </div>

      <span className="mx-1 h-5 w-px bg-bloom-200" aria-hidden />

      <label className="inline-flex items-center gap-1 text-bloom-ink/70">
        Paper
        <select
          className="rounded-lg border border-bloom-200 bg-white px-1.5 py-1.5"
          value={paper}
          onChange={(e) => setPaper(e.target.value as PaperOption)}
          aria-label="Artboard paper"
          title="Presentation ground — white bouquets need a darker paper"
        >
          {PAPERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {learningMode && (
        <>
          <span className="mx-1 h-5 w-px bg-bloom-200" aria-hidden />
          <button
            className={`btn ${showFormGuide ? 'bg-bloom-100 ring-1 ring-bloom-500' : ''}`}
            aria-pressed={showFormGuide}
            title="Round-form silhouette — stems snap onto it magnetically"
            onClick={() => setShowFormGuide(!showFormGuide)}
          >
            Form guide
          </button>
          <button
            className={`btn ${balanceVisible ? 'bg-bloom-100 ring-1 ring-bloom-500' : ''}`}
            aria-pressed={balanceVisible}
            title="Show the design's centre of visual weight, live"
            onClick={() => setBalanceVisible(!balanceVisible)}
          >
            Balance
          </button>
          <button
            className={`btn ${tiltEnabled ? 'bg-bloom-100 ring-1 ring-bloom-500' : ''}`}
            aria-pressed={tiltEnabled}
            title="Parallax depth preview — move the pointer over the canvas · hold X for the depth x-ray"
            onClick={() => setTiltEnabled(!tiltEnabled)}
          >
            Tilt
          </button>
        </>
      )}

      {brush && (
        <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-bloom-600 bg-bloom-100 px-2.5 py-1 font-medium text-bloom-700">
          🖌 {FLOWER_INDEX[brush.varietyId]?.commonName ?? 'Brush'}
          <button className="font-semibold" aria-label="Exit brush (Esc)" title="Exit brush (Esc)"
            onClick={() => setBrush(null)}>✕</button>
        </span>
      )}

      <span className="ml-auto hidden text-bloom-ink/45 xl:inline">
        Space+drag pans · ⌘+scroll zooms · hold X for depth x-ray · ⌘ suspends snap
      </span>
    </div>
  )
}
