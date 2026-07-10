import { useEffect, useRef, useState } from 'react'
import { Application } from 'pixi.js'
import { SceneManager } from '../../render/scene'
import { attachInteractions, interactionSpaceHook } from '../../render/interactions'
import { CAMERA_CHANGE_EVENT, canvasRegistry } from '../../render/registry'
import { useStudio } from '../../domain/store'

/**
 * React host for the WebGL canvas. React owns the chrome; Pixi owns this one
 * element. The scene subscribes to the store imperatively — no React
 * reconciliation in the render path.
 */
export function PixiStage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const cleanups: Array<() => void> = []
    const app = new Application()

    app
      .init({
        background: '#f2f2f0',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      })
      .then(() => {
        if (disposed) {
          app.destroy(true)
          return
        }
        app.ticker.stop() // render-on-demand; the scene schedules its own frames
        host.appendChild(app.canvas)
        const scene = new SceneManager(app)
        cleanups.push(() => scene.destroy())

        // The flex layout may not have settled when init resolves, so the
        // first *real* measurement performs the initial artboard fit.
        let didInitialFit = false
        const measure = () => {
          const w = Math.max(1, host.clientWidth)
          const h = Math.max(1, host.clientHeight)
          app.renderer.resize(w, h)
          scene.setViewport(w, h)
          if (!didInitialFit && w > 100 && h > 100) {
            didInitialFit = true
            scene.fitArtboard(false)
          }
        }
        measure()
        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(host)
        cleanups.push(() => resizeObserver.disconnect())

        const syncFromStore = () => {
          const s = useStudio.getState()
          scene.sync(s.doc, s.selectedId, {
            showFormGuide: s.showFormGuide,
            learningMode: s.learningMode,
            gridVisible: s.gridVisible,
            gridStepMm: s.gridStepMm,
          })
        }
        syncFromStore()
        cleanups.push(useStudio.subscribe(syncFromStore))
        cleanups.push(attachInteractions(app.canvas, scene, useStudio))

        scene.camera.onChange = (() => {
          const original = scene.camera.onChange
          return () => {
            original?.()
            canvasRegistry.emitter.dispatchEvent(new Event(CAMERA_CHANGE_EVENT))
          }
        })()

        canvasRegistry.api = {
          fitArtboard: (animate = true) => scene.fitArtboard(animate),
          fitSelection: (animate = true) => scene.fitSelection(animate),
          zoomTo100: () =>
            scene.camera.animateTo({ x: scene.camera.x, y: scene.camera.y, scale: 1 }),
          zoomBy: (factor) => scene.camera.zoomBy(factor, true),
          getZoomPercent: () => Math.round(scene.camera.scale * 100),
          setSpacePan: (down) => interactionSpaceHook.current?.(down),
          exportPng: () => scene.exportPng(),
        }
        cleanups.push(() => {
          canvasRegistry.api = null
        })
      })
      .catch((err: unknown) => {
        console.error('Canvas failed to start:', err)
        setError(
          'The design canvas needs WebGL, which this browser or device has disabled. ' +
            'Try updating the browser or enabling hardware acceleration.',
        )
      })

    return () => {
      disposed = true
      cleanups.forEach((fn) => fn())
      try {
        app.destroy(true)
      } catch {
        // Application may not have finished init; nothing to release.
      }
    }
  }, [])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-bloom-200 bg-white p-8 text-center text-sm text-bloom-ink/70">
        {error}
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      role="application"
      aria-label="Design canvas"
      className="h-full min-h-0 w-full overflow-hidden rounded-xl border border-bloom-200"
    />
  )
}
