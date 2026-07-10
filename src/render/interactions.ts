import type { SceneManager } from './scene'
import type { StudioState } from '../domain/store'
import { snapToGrid } from './grid'
import type { StoreApi, UseBoundStore } from 'zustand'

type Store = UseBoundStore<StoreApi<StudioState>>

interface DragState {
  stemId: string
  /** Binding-point offset from the pointer's world position at grab time. */
  offsetX: number
  offsetY: number
}

/**
 * All pointer/wheel input for the canvas. Attached straight to the canvas
 * element (Pixi's event system is bypassed — we do our own alpha-accurate
 * hit testing and camera work).
 *
 * Gestures: left-drag on a stem moves it (grid-snapped when enabled; hold
 * Cmd/Ctrl to suspend snapping); left-drag on empty space pans (interim until
 * the Phase B marquee); space/middle-drag always pans; wheel pans, Cmd/Ctrl+
 * wheel and trackpad pinch zoom to cursor; two-finger touch pinch zooms/pans.
 */
export function attachInteractions(
  canvas: HTMLCanvasElement,
  scene: SceneManager,
  store: Store,
): () => void {
  let mode: 'idle' | 'pan' | 'drag' | 'pinch' = 'idle'
  let drag: DragState | null = null
  let spaceDown = false
  const pointers = new Map<number, { x: number; y: number }>()
  let pinchBase: { distance: number; scale: number } | null = null
  let lastPan: { x: number; y: number } | null = null

  const localPoint = (e: PointerEvent | WheelEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const updateCursor = () => {
    canvas.style.cursor =
      mode === 'pan' || mode === 'pinch' ? 'grabbing' : spaceDown ? 'grab' : 'default'
  }

  const startPinchIfNeeded = () => {
    if (pointers.size !== 2) return
    if (mode === 'drag' && drag) {
      // Second finger arrived mid-drag: commit the move, switch to pinch.
      store.getState().endTransform(drag.stemId)
      drag = null
    }
    const [a, b] = [...pointers.values()]
    pinchBase = { distance: Math.hypot(b.x - a.x, b.y - a.y), scale: scene.camera.scale }
    mode = 'pinch'
    updateCursor()
  }

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId)
    const p = localPoint(e)
    pointers.set(e.pointerId, p)
    if (pointers.size === 2) {
      startPinchIfNeeded()
      return
    }

    if (spaceDown || e.button === 1) {
      mode = 'pan'
      lastPan = p
      updateCursor()
      return
    }
    if (e.button !== 0) return

    const world = scene.camera.worldFromScreen(p.x, p.y)
    const hitId = scene.hitTest(world.x, world.y)
    const state = store.getState()
    if (hitId) {
      const stem = state.doc.stems.find((s) => s.id === hitId)!
      state.select(hitId)
      state.beginTransform(hitId)
      drag = { stemId: hitId, offsetX: stem.x - world.x, offsetY: stem.y - world.y }
      mode = 'drag'
      canvas.style.cursor = 'grabbing'
    } else {
      state.select(null)
      mode = 'pan' // interim: empty-space drag pans until the Phase B marquee
      lastPan = p
      updateCursor()
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    const p = localPoint(e)
    pointers.set(e.pointerId, p)

    if (mode === 'pinch' && pinchBase && pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const distance = Math.hypot(b.x - a.x, b.y - a.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const targetScale = (pinchBase.scale * distance) / Math.max(1, pinchBase.distance)
      scene.camera.zoomAt(mid.x, mid.y, targetScale / scene.camera.scale)
      return
    }

    if (mode === 'pan' && lastPan) {
      scene.camera.panByScreen(p.x - lastPan.x, p.y - lastPan.y)
      lastPan = p
      return
    }

    if (mode === 'drag' && drag) {
      const state = store.getState()
      const world = scene.camera.worldFromScreen(p.x, p.y)
      let x = world.x + drag.offsetX
      let y = world.y + drag.offsetY
      const snapSuspended = e.metaKey || e.ctrlKey
      if (state.gridSnap && !snapSuspended) {
        x = snapToGrid(x, state.gridStepMm)
        y = snapToGrid(y, state.gridStepMm)
      }
      state.setStemTransient(drag.stemId, { x: round1(x), y: round1(y) })
    }
  }

  const onPointerEnd = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (mode === 'drag' && drag) {
      store.getState().endTransform(drag.stemId)
      drag = null
    }
    if (pointers.size === 1 && mode === 'pinch') {
      // One finger lifted: continue as a pan from the remaining finger.
      pinchBase = null
      mode = 'pan'
      lastPan = [...pointers.values()][0]
      return
    }
    if (pointers.size === 0) {
      mode = 'idle'
      pinchBase = null
      lastPan = null
      updateCursor()
    }
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const p = localPoint(e)
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinch arrives as ctrl+wheel (small deltas); mouse users use
      // Cmd/Ctrl+wheel (±100+ per notch) — clamp so a notch is a gentle step.
      const factor = Math.min(1.25, Math.max(0.8, Math.exp(-e.deltaY * 0.0025)))
      scene.camera.zoomAt(p.x, p.y, factor)
    } else {
      scene.camera.panByScreen(-e.deltaX, -e.deltaY)
    }
  }

  const setSpacePan = (down: boolean) => {
    spaceDown = down
    if (!down && mode === 'pan' && pointers.size === 0) mode = 'idle'
    updateCursor()
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerEnd)
  canvas.addEventListener('pointercancel', onPointerEnd)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.style.touchAction = 'none'

  interactionSpaceHook.current = setSpacePan

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerEnd)
    canvas.removeEventListener('pointercancel', onPointerEnd)
    canvas.removeEventListener('wheel', onWheel)
    if (interactionSpaceHook.current === setSpacePan) interactionSpaceHook.current = null
  }
}

/** Lets the registry route the space key into the active interaction layer. */
export const interactionSpaceHook: { current: ((down: boolean) => void) | null } = {
  current: null,
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
