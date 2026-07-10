import { useEffect, useState } from 'react'
import { useStudio, type GridStepMm } from '../../domain/store'
import { CAMERA_CHANGE_EVENT, canvasRegistry } from '../../render/registry'

const GRID_STEPS: GridStepMm[] = [5, 10, 25, 50]

/** Zoom readout/controls and grid preferences, under the canvas. */
export function CanvasFooter() {
  const [zoom, setZoom] = useState(100)
  const learningMode = useStudio((s) => s.learningMode)
  const showFormGuide = useStudio((s) => s.showFormGuide)
  const setShowFormGuide = useStudio((s) => s.setShowFormGuide)
  const gridVisible = useStudio((s) => s.gridVisible)
  const setGridVisible = useStudio((s) => s.setGridVisible)
  const gridSnap = useStudio((s) => s.gridSnap)
  const setGridSnap = useStudio((s) => s.setGridSnap)
  const gridStepMm = useStudio((s) => s.gridStepMm)
  const setGridStepMm = useStudio((s) => s.setGridStepMm)

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

      {learningMode && (
        <>
          <span className="mx-1 h-5 w-px bg-bloom-200" aria-hidden />
          <button
            className={`btn ${showFormGuide ? 'bg-bloom-100 ring-1 ring-bloom-500' : ''}`}
            aria-pressed={showFormGuide}
            onClick={() => setShowFormGuide(!showFormGuide)}
          >
            Form guide
          </button>
        </>
      )}

      <span className="ml-auto hidden text-bloom-ink/45 lg:inline">
        Space+drag pans · ⌘+scroll or pinch zooms · ⌘ while dragging suspends snap
      </span>
    </div>
  )
}
