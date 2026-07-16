import { useEffect, useState } from 'react'
import { useStudio } from '../../domain/store'
import type { PaperOption } from '../../domain/types'
import { CAMERA_CHANGE_EVENT, canvasRegistry } from '../../render/registry'

const PAPERS: Array<{ id: PaperOption; label: string }> = [
  { id: 'white', label: 'White' },
  { id: 'ivory', label: 'Ivory' },
  { id: 'blush', label: 'Blush' },
  { id: 'charcoal', label: 'Charcoal' },
]

/**
 * Status bar under the canvas: zoom, the presentation paper, and gesture
 * hints. Tool toggles (grid, snapping, learning overlays) live on the left
 * rail — this bar carries document/view status only, never tool actions.
 */
export function CanvasFooter() {
  const [zoom, setZoom] = useState(100)
  const paper = useStudio((s) => s.doc.artboards[0]?.paper ?? 'white')
  const setPaper = useStudio((s) => s.setPaper)

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

      <span className="ml-auto hidden text-bloom-ink/45 xl:inline">
        Space+drag pans · ⌘+scroll zooms · hold X for depth x-ray · ⌘ suspends snap
      </span>
    </div>
  )
}
