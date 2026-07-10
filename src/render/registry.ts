/**
 * The bridge between React chrome (toolbar, footer, shortcuts) and the
 * imperative canvas. The renderer registers its API on mount; React reads it
 * null-safely. Camera changes are announced on the emitter so the footer's
 * zoom readout can subscribe without routing 60Hz updates through the store.
 */

export interface CanvasApi {
  fitArtboard: (animate?: boolean) => void
  fitSelection: (animate?: boolean) => void
  zoomTo100: () => void
  zoomBy: (factor: number) => void
  getZoomPercent: () => number
  setSpacePan: (down: boolean) => void
  exportPng: () => Promise<string | null>
}

export const canvasRegistry: {
  api: CanvasApi | null
  emitter: EventTarget
} = {
  api: null,
  emitter: new EventTarget(),
}

export const CAMERA_CHANGE_EVENT = 'camerachange'
