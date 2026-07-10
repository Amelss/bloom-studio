import type { HandleKind, SceneManager, WorldRect } from './scene'
import type { StudioState } from '../domain/store'
import { snapToGrid } from './grid'
import { findSmartSnap, type GuideLine } from './smartGuides'
import { formSilhouette, nearestOnFormEllipse } from './formGuide'
import { headDistance } from '../domain/geometry'
import { FLOWER_INDEX } from '../data/catalog'
import {
  rotationPatches,
  scalePatches,
  selectionCentroid,
  snapshotStems,
  type GestureSnapshot,
} from './transformGesture'
import type { StemPatch } from '../domain/commands'
import type { StoreApi, UseBoundStore } from 'zustand'

type Store = UseBoundStore<StoreApi<StudioState>>

type Gesture =
  | { kind: 'idle' }
  | { kind: 'pan'; last: { x: number; y: number } }
  | { kind: 'pinch' }
  | {
      kind: 'dragStems'
      primaryId: string
      start: Map<string, { x: number; y: number; rotation: number }>
      offset: { dx: number; dy: number }
      moved: boolean
    }
  | { kind: 'marquee'; startWorld: { x: number; y: number }; rect: WorldRect | null }
  | { kind: 'rotate'; center: { x: number; y: number }; startAngle: number; start: GestureSnapshot[] }
  | { kind: 'scale'; center: { x: number; y: number }; startDist: number; start: GestureSnapshot[] }

const SMART_SNAP_PX = 6
const FORM_SNAP_PX = 14
const HANDLE_CURSORS: Record<HandleKind, string> = {
  rotate: 'grab',
  'scale-tl': 'nwse-resize',
  'scale-br': 'nwse-resize',
  'scale-tr': 'nesw-resize',
  'scale-bl': 'nesw-resize',
}

/**
 * All pointer/wheel input for the canvas. Attached straight to the canvas
 * element (Pixi's event system is bypassed — we do our own alpha-accurate
 * hit testing and camera work).
 *
 * Gestures: drag a stem to move the whole selection (smart guides, form-guide
 * magnetism, grid snap; `⌘` suspends snapping); drag empty space for marquee
 * selection; corner handles scale, the top handle rotates (Shift = 15°
 * steps); `Shift+click` toggles; `Alt+click` digs through overlaps;
 * double-click enters a cluster. Space/middle-drag pans; wheel pans;
 * `⌘`+wheel and pinch zoom to the cursor.
 */
export function attachInteractions(
  canvas: HTMLCanvasElement,
  scene: SceneManager,
  store: Store,
  host: HTMLElement,
): () => void {
  let gesture: Gesture = { kind: 'idle' }
  let spaceDown = false
  const pointers = new Map<number, { x: number; y: number }>()
  let pinchBase: { distance: number; scale: number } | null = null

  const readout = document.createElement('div')
  readout.className =
    'pointer-events-none absolute z-40 hidden rounded bg-bloom-ink/85 px-1.5 py-0.5 font-sans text-[11px] text-white'
  host.appendChild(readout)

  const showReadout = (text: string, clientX: number, clientY: number) => {
    const rect = host.getBoundingClientRect()
    readout.textContent = text
    readout.style.left = `${clientX - rect.left + 14}px`
    readout.style.top = `${clientY - rect.top + 14}px`
    readout.classList.remove('hidden')
  }
  const hideReadout = () => readout.classList.add('hidden')

  const localPoint = (e: PointerEvent | WheelEvent | MouseEvent) => {
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const worldPoint = (e: PointerEvent | WheelEvent | MouseEvent) => {
    const p = localPoint(e)
    return scene.camera.worldFromScreen(p.x, p.y)
  }

  const setCursor = (cursor: string) => {
    canvas.style.cursor = cursor
  }

  const selectedStems = () => {
    const s = store.getState()
    return s.doc.stems.filter((stem) => s.selectedIds.includes(stem.id))
  }

  /** Whole-cluster expansion for marquee results. */
  const expandClusters = (ids: string[]): string[] => {
    const { doc } = store.getState()
    const set = new Set(ids)
    for (const id of ids) {
      const stem = doc.stems.find((s) => s.id === id)
      if (stem?.clusterId) {
        for (const member of doc.stems) {
          if (member.clusterId === stem.clusterId) set.add(member.id)
        }
      }
    }
    return [...set]
  }

  const beginStemDrag = (primaryId: string, world: { x: number; y: number }) => {
    const state = store.getState()
    if (!state.selectedIds.includes(primaryId)) state.selectOne(primaryId)
    const ids = store.getState().selectedIds
    store.getState().beginTransform(ids)
    const start = new Map<string, { x: number; y: number; rotation: number }>()
    for (const stem of selectedStems()) {
      start.set(stem.id, { x: stem.x, y: stem.y, rotation: stem.rotation })
    }
    const primary = start.get(primaryId)!
    gesture = {
      kind: 'dragStems',
      primaryId,
      start,
      offset: { dx: primary.x - world.x, dy: primary.y - world.y },
      moved: false,
    }
    setCursor('grabbing')
  }

  const beginHandleGesture = (handle: HandleKind, world: { x: number; y: number }) => {
    const stems = selectedStems()
    if (!stems.length) return false
    store.getState().beginTransform(stems.map((s) => s.id))
    const start = snapshotStems(stems)
    const center =
      stems.length === 1 ? { x: stems[0].x, y: stems[0].y } : selectionCentroid(stems)
    if (handle === 'rotate') {
      gesture = {
        kind: 'rotate',
        center,
        startAngle: Math.atan2(world.y - center.y, world.x - center.x),
        start,
      }
      setCursor('grabbing')
    } else {
      gesture = {
        kind: 'scale',
        center,
        startDist: Math.max(1e-6, Math.hypot(world.x - center.x, world.y - center.y)),
        start,
      }
    }
    return true
  }

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId)
    const p = localPoint(e)
    pointers.set(e.pointerId, p)
    store.getState().setContextMenu(null)

    if (pointers.size === 2) {
      // Second finger: abandon any stem gesture, switch to pinch.
      if (gesture.kind === 'dragStems' || gesture.kind === 'rotate' || gesture.kind === 'scale') {
        store.getState().endTransform()
      }
      scene.setMarquee(null)
      const [a, b] = [...pointers.values()]
      pinchBase = { distance: Math.hypot(b.x - a.x, b.y - a.y), scale: scene.camera.scale }
      gesture = { kind: 'pinch' }
      setCursor('grabbing')
      return
    }

    if (spaceDown || e.button === 1) {
      gesture = { kind: 'pan', last: p }
      setCursor('grabbing')
      return
    }
    if (e.button !== 0) return

    const world = scene.camera.worldFromScreen(p.x, p.y)
    const state = store.getState()

    // Transform handles take priority over stems.
    if (state.selectedIds.length && !e.altKey && !e.shiftKey) {
      const handle = scene.getHandleAt(world.x, world.y)
      if (handle && beginHandleGesture(handle, world)) return
    }

    const hit = scene.hitTest(world.x, world.y)

    if (hit && e.altKey) {
      // Dig: cycle through overlapping stems, front to back.
      const hits = scene.hitTestAll(world.x, world.y)
      const currentIndex = hits.findIndex((id) => state.selectedIds.includes(id))
      const next = hits[(currentIndex + 1) % hits.length]
      state.selectOne(next)
      return
    }
    if (hit && e.shiftKey) {
      state.toggleSelect(hit)
      return
    }
    if (hit) {
      beginStemDrag(hit, world)
      return
    }

    // Empty space: marquee (selection resolves on release).
    gesture = { kind: 'marquee', startWorld: world, rect: null }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) {
      // Hover: cursor feedback only.
      if (e.buttons === 0) updateHoverCursor(e)
      return
    }
    const p = localPoint(e)
    pointers.set(e.pointerId, p)

    if (gesture.kind === 'pinch' && pinchBase && pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const distance = Math.hypot(b.x - a.x, b.y - a.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const targetScale = (pinchBase.scale * distance) / Math.max(1, pinchBase.distance)
      scene.camera.zoomAt(mid.x, mid.y, targetScale / scene.camera.scale)
      return
    }

    if (gesture.kind === 'pan') {
      scene.camera.panByScreen(p.x - gesture.last.x, p.y - gesture.last.y)
      gesture.last = p
      return
    }

    if (gesture.kind === 'marquee') {
      const world = scene.camera.worldFromScreen(p.x, p.y)
      const rect: WorldRect = {
        x: Math.min(gesture.startWorld.x, world.x),
        y: Math.min(gesture.startWorld.y, world.y),
        width: Math.abs(world.x - gesture.startWorld.x),
        height: Math.abs(world.y - gesture.startWorld.y),
      }
      // Ignore sub-3px jitters so a plain click stays a click.
      if (rect.width * scene.camera.scale > 3 || rect.height * scene.camera.scale > 3) {
        gesture.rect = rect
        scene.setMarquee(rect)
      }
      return
    }

    if (gesture.kind === 'dragStems') {
      moveDraggedStems(e, p)
      return
    }

    if (gesture.kind === 'rotate') {
      const world = scene.camera.worldFromScreen(p.x, p.y)
      const angle = Math.atan2(world.y - gesture.center.y, world.x - gesture.center.x)
      let delta = ((angle - gesture.startAngle) * 180) / Math.PI
      if (e.shiftKey) delta = Math.round(delta / 15) * 15
      store.getState().setStemsTransient(rotationPatches(gesture.start, gesture.center, delta))
      showReadout(`${Math.round(delta) >= 0 ? '+' : ''}${Math.round(delta)}°`, e.clientX, e.clientY)
      return
    }

    if (gesture.kind === 'scale') {
      const world = scene.camera.worldFromScreen(p.x, p.y)
      const dist = Math.hypot(world.x - gesture.center.x, world.y - gesture.center.y)
      const factor = dist / gesture.startDist
      store.getState().setStemsTransient(scalePatches(gesture.start, gesture.center, factor))
      showReadout(`${Math.round(factor * 100)}%`, e.clientX, e.clientY)
      return
    }
  }

  const moveDraggedStems = (e: PointerEvent, p: { x: number; y: number }) => {
    if (gesture.kind !== 'dragStems') return
    const g = gesture // stable narrowed reference across the closure calls below
    const state = store.getState()
    const world = scene.camera.worldFromScreen(p.x, p.y)
    const startPrimary = g.start.get(g.primaryId)!
    let nx = world.x + gesture.offset.dx
    let ny = world.y + gesture.offset.dy
    let primaryRotation: number | null = null
    let guides: GuideLine[] = []

    const suspendSnap = e.metaKey || e.ctrlKey
    const artboard = state.doc.artboards[0]
    const primaryStem = state.doc.stems.find((s) => s.id === g.primaryId)

    if (!suspendSnap && artboard && primaryStem) {
      // 1. Form-guide magnetism: the head snaps onto the silhouette, the stem
      //    turns radial — the splay of a real spiral.
      let formSnapped = false
      if (state.showFormGuide && state.learningMode) {
        const variety = FLOWER_INDEX[primaryStem.varietyId]
        if (variety) {
          const d = headDistance(variety, primaryStem.scale)
          const rad = (startPrimary.rotation * Math.PI) / 180
          const head = { x: nx + d * Math.sin(rad), y: ny - d * Math.cos(rad) }
          const near = nearestOnFormEllipse(formSilhouette(artboard), head.x, head.y)
          if (near.distance <= FORM_SNAP_PX / scene.camera.scale) {
            const newRad = (near.radialRotationDeg * Math.PI) / 180
            nx = near.x - d * Math.sin(newRad)
            ny = near.y + d * Math.cos(newRad)
            primaryRotation = Math.round(near.radialRotationDeg)
            formSnapped = true
          }
        }
      }

      // 2. Smart alignment against neighbours and the artboard axes.
      if (!formSnapped) {
        const dragging = new Set(g.start.keys())
        const targetsX: number[] = [artboard.x + artboard.width / 2]
        const targetsY: number[] = [artboard.y + artboard.height / 2]
        for (const stem of state.doc.stems) {
          if (dragging.has(stem.id)) continue
          targetsX.push(stem.x)
          targetsY.push(stem.y)
        }
        const snap = findSmartSnap(nx, ny, targetsX, targetsY, SMART_SNAP_PX / scene.camera.scale)
        nx = snap.x
        ny = snap.y
        guides = snap.guides

        // 3. Grid snap on axes the smart guides didn't claim.
        if (state.gridSnap) {
          if (!guides.some((g) => g.axis === 'v')) nx = snapToGrid(nx, state.gridStepMm)
          if (!guides.some((g) => g.axis === 'h')) ny = snapToGrid(ny, state.gridStepMm)
        }
      }
    } else if (!suspendSnap && state.gridSnap) {
      nx = snapToGrid(nx, state.gridStepMm)
      ny = snapToGrid(ny, state.gridStepMm)
    }

    const dx = nx - startPrimary.x
    const dy = ny - startPrimary.y
    const patches: Record<string, StemPatch> = {}
    for (const [id, s] of g.start) {
      patches[id] = { x: round1(s.x + dx), y: round1(s.y + dy) }
    }
    if (primaryRotation != null) patches[g.primaryId].rotation = primaryRotation
    state.setStemsTransient(patches)
    scene.setGuides(guides)
    g.moved = true
    showReadout(`${(nx / 10).toFixed(1)}, ${(ny / 10).toFixed(1)} cm`, e.clientX, e.clientY)
  }

  const onPointerEnd = (e: PointerEvent) => {
    pointers.delete(e.pointerId)

    if (gesture.kind === 'dragStems') {
      store.getState().endTransform()
      scene.setGuides([])
      hideReadout()
    } else if (gesture.kind === 'rotate' || gesture.kind === 'scale') {
      store.getState().endTransform()
      hideReadout()
    } else if (gesture.kind === 'marquee') {
      const state = store.getState()
      if (gesture.rect) {
        state.setSelection(expandClusters(scene.stemsInRect(gesture.rect)))
      } else {
        // A plain click on empty space: clear selection, leave cluster mode.
        state.setSelection([])
        state.exitCluster()
      }
      scene.setMarquee(null)
    }

    if (pointers.size === 1 && gesture.kind === 'pinch') {
      pinchBase = null
      gesture = { kind: 'pan', last: [...pointers.values()][0] }
      return
    }
    if (pointers.size === 0) {
      gesture = { kind: 'idle' }
      pinchBase = null
      setCursor(spaceDown ? 'grab' : 'default')
    }
  }

  const updateHoverCursor = (e: PointerEvent) => {
    if (spaceDown) {
      setCursor('grab')
      return
    }
    const world = worldPoint(e)
    if (store.getState().selectedIds.length) {
      const handle = scene.getHandleAt(world.x, world.y)
      if (handle) {
        setCursor(HANDLE_CURSORS[handle])
        return
      }
    }
    setCursor(scene.hitTest(world.x, world.y) ? 'move' : 'default')
  }

  const onDoubleClick = (e: MouseEvent) => {
    const world = worldPoint(e)
    const hit = scene.hitTest(world.x, world.y)
    const stem = hit ? store.getState().doc.stems.find((s) => s.id === hit) : undefined
    if (stem?.clusterId) {
      store.getState().enterCluster(stem.clusterId, stem.id)
    }
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    const world = worldPoint(e)
    const hit = scene.hitTest(world.x, world.y)
    const state = store.getState()
    if (hit) {
      if (!state.selectedIds.includes(hit)) state.selectOne(hit)
      state.setContextMenu({ x: e.clientX, y: e.clientY, stemId: hit })
    } else {
      state.setContextMenu(null)
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
    if (!down && gesture.kind === 'pan' && pointers.size === 0) gesture = { kind: 'idle' }
    setCursor(down ? 'grab' : 'default')
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerEnd)
  canvas.addEventListener('pointercancel', onPointerEnd)
  canvas.addEventListener('dblclick', onDoubleClick)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.style.touchAction = 'none'

  interactionSpaceHook.current = setSpacePan

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerEnd)
    canvas.removeEventListener('pointercancel', onPointerEnd)
    canvas.removeEventListener('dblclick', onDoubleClick)
    canvas.removeEventListener('contextmenu', onContextMenu)
    canvas.removeEventListener('wheel', onWheel)
    readout.remove()
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
