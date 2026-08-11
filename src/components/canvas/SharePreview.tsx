import { useEffect, useRef, useState } from 'react'
import { Application } from 'pixi.js'
import { SceneManager } from '../../render/scene'
import { loadPhotoManifest } from '../../render/textures'
import type { DesignDocument } from '../../domain/types'

/**
 * A read-only WebGL preview of a design — the client-facing render behind a
 * share link. Builds its own Pixi app and scene from a passed-in document (not
 * the editor store), attaches no interactions, and never mutates anything. It
 * reuses the full-fidelity renderer so a shared design looks exactly as the
 * florist built it: real photo textures, recolours, vessel, depth.
 */
export function SharePreview({ doc }: { doc: DesignDocument }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const cleanups: Array<() => void> = []
    const app = new Application()

    const readOnlyPrefs = {
      showFormGuide: false,
      formGuideKind: 'round' as const,
      gridVisible: false,
      gridStepMm: 10,
      hiddenBands: [],
      lockedBands: [],
      xrayActive: false,
      balanceVisible: false,
    }

    app
      .init({
        background: '#ffffff',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        failIfMajorPerformanceCaveat: false,
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
      })
      .then(() => {
        if (disposed) {
          app.destroy(true)
          return
        }
        app.ticker.stop()
        host.appendChild(app.canvas)
        const scene = new SceneManager(app)
        cleanups.push(() => scene.destroy())

        let didInitialFit = false
        const measure = () => {
          const w = Math.max(1, host.clientWidth)
          const h = Math.max(1, host.clientHeight)
          app.renderer.resize(w, h)
          scene.setViewport(w, h)
          if (!didInitialFit && w > 60 && h > 60) {
            didInitialFit = true
            scene.fitArtboard(false)
          }
        }
        measure()
        const resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(host)
        cleanups.push(() => resizeObserver.disconnect())

        scene.sync(doc, [], readOnlyPrefs)
        // Photo textures arrive after the manifest loads — re-sync so they swap
        // in, then re-fit in case artboard bounds settled.
        void loadPhotoManifest().then(() => {
          if (disposed) return
          scene.sync(doc, [], readOnlyPrefs)
          scene.fitArtboard(false)
        })
      })
      .catch((err: unknown) => {
        console.error('Preview failed to start:', err)
        setError('This preview needs WebGL, which this browser or device has disabled.')
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
  }, [doc])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-white p-8 text-center text-sm text-bloom-ink/70">
        {error}
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="Design preview"
      className="h-full min-h-0 w-full overflow-hidden"
    />
  )
}
