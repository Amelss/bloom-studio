import { useEffect, useState } from 'react'
import { CAMERA_CHANGE_EVENT, canvasRegistry } from '../../render/registry'

/**
 * Zoom controls that float over the canvas rather than sitting in a chrome
 * bar — a translucent pill in the corner, the way Figma/Miro keep the surface
 * uninterrupted. The parent must be `relative`.
 */
export function CanvasControls() {
  const [zoom, setZoom] = useState(100)

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
    <div className="pointer-events-none absolute bottom-3 left-3 z-10">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white/70 p-1 shadow-panel ring-1 ring-bloom-ink/[0.06] backdrop-blur-md">
        <IconBtn label="Zoom out (−)" onClick={() => canvasRegistry.api?.zoomBy(0.8)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M5 12h14" />
          </svg>
        </IconBtn>
        <button
          className="min-w-[3.25rem] rounded-full px-1 py-1 text-center text-xs font-medium tabular-nums text-bloom-ink/80 transition-colors hover:bg-bloom-100/70"
          aria-label={`Zoom ${zoom} percent — click for 100%`}
          title="Zoom to 100% (⌘1)"
          onClick={() => canvasRegistry.api?.zoomTo100()}
        >
          {zoom}%
        </button>
        <IconBtn label="Zoom in (+)" onClick={() => canvasRegistry.api?.zoomBy(1.25)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        </IconBtn>
        <span className="mx-0.5 h-4 w-px bg-bloom-ink/10" aria-hidden />
        <button
          className="rounded-full px-2.5 py-1 text-xs font-medium text-bloom-ink/80 transition-colors hover:bg-bloom-100/70"
          title="Fit the artboard (⌘0)"
          onClick={() => canvasRegistry.api?.fitArtboard()}
        >
          Fit
        </button>
      </div>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full text-bloom-ink/70 transition-colors hover:bg-bloom-100/70 hover:text-bloom-ink"
    >
      {children}
    </button>
  )
}
