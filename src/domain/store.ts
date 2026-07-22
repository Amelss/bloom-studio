import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StateCreator } from 'zustand'
import {
  applyCommand,
  batchOf,
  invertCommand,
  type Command,
  type StemPatch,
} from './commands'
import { blankDocument, starterTemplate } from './templates'
import { migrateDocument } from './migrate'
import {
  CATEGORY_BAND,
  DEPTH_BANDS,
  STEM_SCALE_MAX,
  STEM_SCALE_MIN,
  generateId,
  type DepthBand,
  type DesignDocument,
  type PaperOption,
  type PlacedStem,
  type StemCategory,
} from './types'
import { FLOWER_INDEX } from '../data/catalog'

export type GridStepMm = 5 | 10 | 25 | 50

export interface ContextMenuState {
  x: number
  y: number
  stemId: string
}

export interface BrushState {
  varietyId: string
  colorwayId: string
}

/** The active cursor tool. 'select' is the resting state; 'pan' is the hand tool. */
export type ToolMode = 'select' | 'pan'

export interface StudioState {
  doc: DesignDocument
  selectedIds: string[]
  /** Active cursor tool (left toolbar). */
  tool: ToolMode
  /** When set, clicks inside this cluster select individual members. */
  enteredClusterId: string | null
  hiddenBands: DepthBand[]
  lockedBands: DepthBand[]
  contextMenu: ContextMenuState | null
  shortcutsOpen: boolean
  /** Left flower-library panel visible (collapse to widen the canvas). */
  libraryOpen: boolean
  /** Right recipe/insights panel visible. */
  insightsOpen: boolean
  learningMode: boolean
  showFormGuide: boolean
  gridVisible: boolean
  gridSnap: boolean
  gridStepMm: GridStepMm
  /** Flips true once the asset manifest has loaded (library re-renders thumbnails). */
  photoAssetsReady: boolean
  /** On-canvas balance overlay (learning mode). */
  balanceVisible: boolean
  /** Parallax depth tilt. */
  tiltEnabled: boolean
  /** Depth x-ray: bands fan apart (hold X). */
  xrayActive: boolean
  /** Filler brush: paint strokes of the chosen variety. */
  brush: BrushState | null
  past: Command[]
  future: Command[]

  run: (cmd: Command) => void
  undo: () => void
  redo: () => void

  // Selection (cluster-aware unless noted)
  setSelection: (ids: string[]) => void
  selectOne: (id: string | null) => void
  toggleSelect: (id: string) => void
  selectAll: () => void
  selectSame: (varietyId: string, colorwayId?: string) => void
  enterCluster: (clusterId: string, stemId: string) => void
  exitCluster: () => void

  // Stem operations (act on the whole selection; one undo step each)
  addStem: (varietyId: string, colorwayId?: string) => void
  addStemAt: (varietyId: string, colorwayId: string | undefined, x: number, y: number) => void
  removeSelected: () => void
  duplicateSelected: () => void
  updateSelected: (patch: StemPatch) => void
  updateStem: (stemId: string, patch: StemPatch) => void
  nudgeSelected: (dx: number, dy: number) => void
  rotateSelected: (deltaDeg: number) => void
  scaleSelected: (delta: number) => void
  flipSelected: () => void
  layerSelected: (direction: 'forward' | 'backward') => void
  bringToFront: () => void
  sendToBack: () => void
  bandSelected: (direction: 'forward' | 'backward') => void
  groupSelected: () => void
  ungroupSelected: () => void

  // Transient gestures (drag/rotate/scale) — committed as one command
  beginTransform: (stemIds: string[]) => void
  setStemsTransient: (patches: Record<string, StemPatch>) => void
  endTransform: () => void

  setVessel: (vesselId: string | null) => void
  setMarkup: (markup: number) => void
  setPriceOverride: (varietyId: string, price: number | null) => void
  renameDesign: (name: string) => void
  newDesign: (kind: 'starter' | 'blank') => void
  importDesign: (doc: DesignDocument) => void

  setLearningMode: (on: boolean) => void
  setShowFormGuide: (on: boolean) => void
  setGridVisible: (on: boolean) => void
  setGridSnap: (on: boolean) => void
  setGridStepMm: (step: GridStepMm) => void
  setPhotoAssetsReady: (ready: boolean) => void
  setBalanceVisible: (on: boolean) => void
  setTiltEnabled: (on: boolean) => void
  setXrayActive: (on: boolean) => void
  setPaper: (paper: PaperOption) => void
  setBrush: (brush: BrushState | null) => void
  setTool: (tool: ToolMode) => void
  /** Brush stroke lifecycle: stems land live, commit as ONE batch on release. */
  brushAddTransient: (placement: {
    x: number
    y: number
    rotation: number
    scale: number
    flipX: boolean
  }) => string | null
  endBrushStroke: (stemIds: string[]) => void
  toggleBandHidden: (band: DepthBand) => void
  soloBand: (band: DepthBand) => void
  toggleBandLocked: (band: DepthBand) => void
  setContextMenu: (menu: ContextMenuState | null) => void
  setShortcutsOpen: (open: boolean) => void
  setLibraryOpen: (open: boolean) => void
  setInsightsOpen: (open: boolean) => void
}

/**
 * New stems drop INTO the bouquet: binding point near the spiral's hand
 * position, heads fanned outward by rotation — the same construction as the
 * starter template, so quick building stays "arranged", never "collaged".
 */
const PLACEMENT = { x: 300, y: 320, xJitter: 22, yJitter: 10 }

const CATEGORY_MAX_ROTATION: Record<StemCategory, number> = {
  focal: 22,
  secondary: 32,
  filler: 38,
  line: 45,
  foliage: 45,
}

const HISTORY_LIMIT = 200

// Snapshots taken at the start of a gesture so the whole gesture commits as
// a single undoable command.
const transformSnapshots = new Map<string, StemPatch>()

const MUTABLE_KEYS = [
  'x',
  'y',
  'rotation',
  'scale',
  'flipX',
  'band',
  'order',
  'colorwayId',
  'clusterId',
] as const

function pickMutable(stem: PlacedStem): StemPatch {
  const patch: StemPatch = {}
  for (const key of MUTABLE_KEYS) {
    ;(patch as Record<string, unknown>)[key] = stem[key]
  }
  return patch
}

function touch(doc: DesignDocument): DesignDocument {
  return { ...doc, updatedAt: new Date().toISOString() }
}

function ordersInBand(doc: DesignDocument, band: DepthBand): number[] {
  return doc.stems.filter((s) => s.band === band).map((s) => s.order)
}

function nextOrderInBand(doc: DesignDocument, band: DepthBand): number {
  const orders = ordersInBand(doc, band)
  return orders.length ? Math.max(...orders) + 1 : 0
}

/** A click on a cluster member selects the whole cluster — unless entered. */
function expandToCluster(doc: DesignDocument, id: string, enteredClusterId: string | null): string[] {
  const stem = doc.stems.find((s) => s.id === id)
  if (!stem) return []
  if (stem.clusterId && stem.clusterId !== enteredClusterId) {
    return doc.stems.filter((s) => s.clusterId === stem.clusterId).map((s) => s.id)
  }
  return [id]
}

function sanitizeSelection(doc: DesignDocument, ids: string[]): string[] {
  const existing = new Set(doc.stems.map((s) => s.id))
  return ids.filter((id) => existing.has(id))
}

const initializer: StateCreator<StudioState> = (set, get) => {
  const selectedStems = (): PlacedStem[] => {
    const { doc, selectedIds } = get()
    return doc.stems.filter((s) => selectedIds.includes(s.id))
  }

  /** Build per-stem update commands for the current selection. */
  const updateEach = (makePatch: (stem: PlacedStem) => StemPatch | null) => {
    const commands: Command[] = []
    for (const stem of selectedStems()) {
      const next = makePatch(stem)
      if (!next || Object.keys(next).length === 0) continue
      const prev: StemPatch = {}
      for (const key of Object.keys(next) as (keyof StemPatch)[]) {
        ;(prev as Record<string, unknown>)[key] = stem[key]
      }
      commands.push({ type: 'update_stem', stemId: stem.id, next, prev })
    }
    if (commands.length) get().run(batchOf(commands))
  }

  return {
    doc: starterTemplate(),
    selectedIds: [],
    tool: 'select',
    enteredClusterId: null,
    hiddenBands: [],
    lockedBands: [],
    contextMenu: null,
    shortcutsOpen: false,
    libraryOpen: true,
    insightsOpen: true,
    learningMode: true,
    showFormGuide: false,
    gridVisible: false,
    gridSnap: false,
    gridStepMm: 10,
    photoAssetsReady: false,
    balanceVisible: false,
    tiltEnabled: false,
    xrayActive: false,
    brush: null,
    past: [],
    future: [],

    run: (cmd) => {
      set((state) => ({
        doc: touch(applyCommand(state.doc, cmd)),
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), cmd],
        future: [],
      }))
    },

    undo: () => {
      const { past, doc } = get()
      const cmd = past[past.length - 1]
      if (!cmd) return
      const nextDoc = touch(applyCommand(doc, invertCommand(cmd)))
      set((state) => ({
        doc: nextDoc,
        past: state.past.slice(0, -1),
        future: [cmd, ...state.future],
        selectedIds: sanitizeSelection(nextDoc, state.selectedIds),
      }))
    },

    redo: () => {
      const { future, doc } = get()
      const cmd = future[0]
      if (!cmd) return
      const nextDoc = touch(applyCommand(doc, cmd))
      set((state) => ({
        doc: nextDoc,
        past: [...state.past, cmd],
        future: state.future.slice(1),
        selectedIds: sanitizeSelection(nextDoc, state.selectedIds),
      }))
    },

    /* ---------------------------- selection ---------------------------- */

    setSelection: (ids) => set((state) => ({ selectedIds: sanitizeSelection(state.doc, ids) })),

    selectOne: (id) => {
      const { doc, enteredClusterId } = get()
      if (!id) {
        set({ selectedIds: [] })
        return
      }
      const stem = doc.stems.find((s) => s.id === id)
      // Leaving the entered cluster exits cluster-editing mode.
      const stillInside = stem?.clusterId === enteredClusterId
      set({
        selectedIds: expandToCluster(doc, id, stillInside ? enteredClusterId : null),
        enteredClusterId: stillInside ? enteredClusterId : null,
      })
    },

    toggleSelect: (id) => {
      const { doc, selectedIds, enteredClusterId } = get()
      const group = expandToCluster(doc, id, enteredClusterId)
      const allIn = group.every((g) => selectedIds.includes(g))
      set({
        selectedIds: allIn
          ? selectedIds.filter((s) => !group.includes(s))
          : [...selectedIds, ...group.filter((g) => !selectedIds.includes(g))],
      })
    },

    selectAll: () => {
      const { doc, hiddenBands, lockedBands } = get()
      set({
        selectedIds: doc.stems
          .filter((s) => !hiddenBands.includes(s.band) && !lockedBands.includes(s.band))
          .map((s) => s.id),
      })
    },

    selectSame: (varietyId, colorwayId) => {
      const { doc, hiddenBands, lockedBands } = get()
      set({
        selectedIds: doc.stems
          .filter(
            (s) =>
              s.varietyId === varietyId &&
              (colorwayId == null || s.colorwayId === colorwayId) &&
              !hiddenBands.includes(s.band) &&
              !lockedBands.includes(s.band),
          )
          .map((s) => s.id),
      })
    },

    enterCluster: (clusterId, stemId) =>
      set({ enteredClusterId: clusterId, selectedIds: [stemId] }),

    exitCluster: () => set({ enteredClusterId: null }),

    /* -------------------------- stem operations ------------------------- */

    addStem: (varietyId, colorwayId) => {
      const variety = FLOWER_INDEX[varietyId]
      if (!variety) return
      const x = Math.round(PLACEMENT.x + (Math.random() * 2 - 1) * PLACEMENT.xJitter)
      const y = Math.round(PLACEMENT.y + (Math.random() * 2 - 1) * PLACEMENT.yJitter)
      get().addStemAt(varietyId, colorwayId, x, y)
    },

    addStemAt: (varietyId, colorwayId, x, y) => {
      const variety = FLOWER_INDEX[varietyId]
      if (!variety) return
      const { doc } = get()
      const maxRot = CATEGORY_MAX_ROTATION[variety.category]
      const rotation = Math.round((Math.random() * 2 - 1) * maxRot)
      const band = CATEGORY_BAND[variety.category]
      const stem: PlacedStem = {
        id: generateId(),
        varietyId,
        colorwayId: colorwayId ?? variety.colorways[0].id,
        x: Math.round(x),
        y: Math.round(y),
        rotation,
        scale: 1,
        // Flowers face their natural direction; flipping is a deliberate act
        // (the Flip control), never random — so placement stays predictable.
        flipX: false,
        band,
        order: nextOrderInBand(doc, band),
      }
      get().run({ type: 'add_stem', stem })
      set({ selectedIds: [stem.id] })
    },

    removeSelected: () => {
      const stems = selectedStems()
      if (!stems.length) return
      get().run(batchOf(stems.map((stem): Command => ({ type: 'remove_stem', stem }))))
      set({ selectedIds: [] })
    },

    duplicateSelected: () => {
      const { doc } = get()
      const sources = selectedStems()
      if (!sources.length) return
      // Duplicated clusters stay clustered — with a fresh cluster identity.
      const clusterMap = new Map<string, string>()
      const orderCounters = new Map<DepthBand, number>()
      const copies = sources.map((source): PlacedStem => {
        let clusterId: string | undefined
        if (source.clusterId) {
          clusterId = clusterMap.get(source.clusterId) ?? generateId()
          clusterMap.set(source.clusterId, clusterId)
        }
        const base = orderCounters.get(source.band) ?? nextOrderInBand(doc, source.band)
        orderCounters.set(source.band, base + 1)
        return {
          ...source,
          id: generateId(),
          x: source.x + 18,
          y: source.y + 8,
          rotation: source.rotation + Math.round(Math.random() * 12 - 6),
          order: base,
          clusterId,
        }
      })
      get().run(batchOf(copies.map((stem): Command => ({ type: 'add_stem', stem }))))
      set({ selectedIds: copies.map((c) => c.id) })
    },

    updateSelected: (patch) => updateEach(() => patch),

    updateStem: (stemId, patch) => {
      const stem = get().doc.stems.find((s) => s.id === stemId)
      if (!stem) return
      const prev: StemPatch = {}
      for (const key of Object.keys(patch) as (keyof StemPatch)[]) {
        ;(prev as Record<string, unknown>)[key] = stem[key]
      }
      get().run({ type: 'update_stem', stemId, next: patch, prev })
    },

    nudgeSelected: (dx, dy) => updateEach((stem) => ({ x: stem.x + dx, y: stem.y + dy })),

    rotateSelected: (deltaDeg) => updateEach((stem) => ({ rotation: stem.rotation + deltaDeg })),

    scaleSelected: (delta) =>
      updateEach((stem) => {
        const scale = Math.min(
          STEM_SCALE_MAX,
          Math.max(STEM_SCALE_MIN, +(stem.scale + delta).toFixed(2)),
        )
        return scale === stem.scale ? null : { scale }
      }),

    flipSelected: () => updateEach((stem) => ({ flipX: !stem.flipX })),

    layerSelected: (direction) => {
      const { doc } = get()
      const isFront = direction === 'forward'
      updateEach((stem) => {
        const orders = ordersInBand(doc, stem.band)
        const extreme = isFront ? Math.max(...orders) : Math.min(...orders)
        // Already at the edge of its band: spill into the neighbouring depth
        // band so repeated presses walk the stem through the whole front-to-back
        // stack (not stuck reordering within one band). Band jumps at the very
        // front/back are a no-op.
        if (stem.order === extreme) {
          const nextRank = DEPTH_BANDS.indexOf(stem.band) + (isFront ? 1 : -1)
          if (nextRank < 0 || nextRank >= DEPTH_BANDS.length) return null
          const band = DEPTH_BANDS[nextRank]
          const nb = ordersInBand(doc, band)
          const order = isFront
            ? (nb.length ? Math.min(...nb) - 1 : 0) // enter at the back of the front band
            : (nb.length ? Math.max(...nb) + 1 : 0) // enter at the front of the back band
          return { band, order }
        }
        return { order: isFront ? extreme + 1 : extreme - 1 }
      })
    },

    // Jump straight to the very front / back of the WHOLE design by landing in
    // the front-most (accents) / back-most (background) depth band at the top /
    // bottom of its stack. Multiple stems keep their relative order.
    bringToFront: () => {
      const front = DEPTH_BANDS[DEPTH_BANDS.length - 1]
      const orders = ordersInBand(get().doc, front)
      let next = (orders.length ? Math.max(...orders) : -1) + 1
      updateEach(() => ({ band: front, order: next++ }))
    },

    sendToBack: () => {
      const back = DEPTH_BANDS[0]
      const orders = ordersInBand(get().doc, back)
      let next = (orders.length ? Math.min(...orders) : 1) - 1
      updateEach(() => ({ band: back, order: next-- }))
    },

    bandSelected: (direction) => {
      const { doc } = get()
      const landing = new Map<DepthBand, number>()
      updateEach((stem) => {
        const rank = DEPTH_BANDS.indexOf(stem.band)
        const nextRank = direction === 'forward' ? rank + 1 : rank - 1
        if (nextRank < 0 || nextRank >= DEPTH_BANDS.length) return null
        const band = DEPTH_BANDS[nextRank]
        const orders = ordersInBand(doc, band)
        const base =
          landing.get(band) ??
          (direction === 'forward'
            ? orders.length
              ? Math.min(...orders) - 1
              : 0
            : orders.length
              ? Math.max(...orders) + 1
              : 0)
        landing.set(band, direction === 'forward' ? base - 1 : base + 1)
        return { band, order: base }
      })
    },

    groupSelected: () => {
      const stems = selectedStems()
      if (stems.length < 2) return
      const clusterId = generateId()
      updateEach(() => ({ clusterId }))
      set({ enteredClusterId: null })
    },

    ungroupSelected: () => {
      updateEach((stem) => (stem.clusterId ? { clusterId: undefined } : null))
      set({ enteredClusterId: null })
    },

    /* ------------------------ transient gestures ------------------------ */

    beginTransform: (stemIds) => {
      transformSnapshots.clear()
      const { doc } = get()
      for (const id of stemIds) {
        const stem = doc.stems.find((s) => s.id === id)
        if (stem) transformSnapshots.set(id, pickMutable(stem))
      }
    },

    setStemsTransient: (patches) => {
      set((state) => ({
        doc: {
          ...state.doc,
          stems: state.doc.stems.map((s) => (patches[s.id] ? { ...s, ...patches[s.id] } : s)),
        },
      }))
    },

    endTransform: () => {
      const { doc } = get()
      const commands: Command[] = []
      for (const [stemId, prevFull] of transformSnapshots) {
        const stem = doc.stems.find((s) => s.id === stemId)
        if (!stem) continue
        const next: StemPatch = {}
        const prev: StemPatch = {}
        for (const key of MUTABLE_KEYS) {
          if (stem[key] !== prevFull[key]) {
            ;(next as Record<string, unknown>)[key] = stem[key]
            ;(prev as Record<string, unknown>)[key] = prevFull[key]
          }
        }
        if (Object.keys(next).length) {
          commands.push({ type: 'update_stem', stemId, next, prev })
        }
      }
      transformSnapshots.clear()
      if (!commands.length) return
      // The doc already reflects `next`; record the batch for undo/redo.
      set((state) => ({
        doc: touch(state.doc),
        past: [...state.past.slice(-(HISTORY_LIMIT - 1)), batchOf(commands)],
        future: [],
      }))
    },

    /* ------------------------------ misc ------------------------------- */

    setVessel: (vesselId) => {
      const { doc } = get()
      if (doc.vesselId === vesselId) return
      get().run({ type: 'set_vessel', next: vesselId, prev: doc.vesselId })
    },

    setMarkup: (markup) => {
      const { doc } = get()
      get().run({ type: 'set_markup', next: markup, prev: doc.pricing.markup })
    },

    setPriceOverride: (varietyId, price) => {
      const { doc } = get()
      get().run({
        type: 'set_price_override',
        varietyId,
        next: price,
        prev: doc.pricing.priceOverrides[varietyId] ?? null,
      })
    },

    renameDesign: (name) => {
      const { doc } = get()
      const trimmed = name.trim()
      if (!trimmed || trimmed === doc.name) return
      get().run({ type: 'rename', next: trimmed, prev: doc.name })
    },

    newDesign: (kind) => {
      set({
        doc: kind === 'starter' ? starterTemplate() : blankDocument(),
        selectedIds: [],
        enteredClusterId: null,
        past: [],
        future: [],
      })
    },

    importDesign: (doc) => {
      set({
        doc: migrateDocument(doc),
        selectedIds: [],
        enteredClusterId: null,
        past: [],
        future: [],
      })
    },

    setLearningMode: (on) => set({ learningMode: on }),
    setShowFormGuide: (on) => set({ showFormGuide: on }),
    setGridVisible: (on) => set({ gridVisible: on }),
    setGridSnap: (on) => set({ gridSnap: on }),
    setGridStepMm: (step) => set({ gridStepMm: step }),
    setPhotoAssetsReady: (ready) => set({ photoAssetsReady: ready }),
    setBalanceVisible: (on) => set({ balanceVisible: on }),
    setTiltEnabled: (on) => set({ tiltEnabled: on }),
    setXrayActive: (on) => set({ xrayActive: on }),

    setPaper: (paper) => {
      const { doc } = get()
      const artboard = doc.artboards[0]
      if (!artboard || artboard.paper === paper) return
      get().run({ type: 'set_paper', artboardId: artboard.id, next: paper, prev: artboard.paper })
    },

    setBrush: (brush) =>
      set({ brush, tool: 'select', selectedIds: brush ? [] : get().selectedIds }),

    // Cursor tool is mutually exclusive with the brush sub-mode.
    setTool: (tool) => set({ tool, brush: null }),

    brushAddTransient: (placement) => {
      const { brush, doc } = get()
      const variety = brush && FLOWER_INDEX[brush.varietyId]
      if (!brush || !variety) return null
      const band = CATEGORY_BAND[variety.category]
      const stem: PlacedStem = {
        id: generateId(),
        varietyId: brush.varietyId,
        colorwayId: brush.colorwayId,
        band,
        order: nextOrderInBand(doc, band),
        ...placement,
      }
      // Live placement without history; endBrushStroke records the batch.
      set((state) => ({ doc: { ...state.doc, stems: [...state.doc.stems, stem] } }))
      return stem.id
    },

    endBrushStroke: (stemIds) => {
      const { doc } = get()
      const stems = doc.stems.filter((s) => stemIds.includes(s.id))
      if (!stems.length) return
      // The doc already contains the stems; record ONE batch for undo/redo.
      set((state) => ({
        doc: touch(state.doc),
        past: [
          ...state.past.slice(-(HISTORY_LIMIT - 1)),
          batchOf(stems.map((stem): Command => ({ type: 'add_stem', stem }))),
        ],
        future: [],
      }))
    },

    toggleBandHidden: (band) =>
      set((state) => ({
        hiddenBands: state.hiddenBands.includes(band)
          ? state.hiddenBands.filter((b) => b !== band)
          : [...state.hiddenBands, band],
      })),

    soloBand: (band) =>
      set((state) => {
        const others = DEPTH_BANDS.filter((b) => b !== band)
        const isSolo =
          !state.hiddenBands.includes(band) && others.every((b) => state.hiddenBands.includes(b))
        return { hiddenBands: isSolo ? [] : others }
      }),

    toggleBandLocked: (band) =>
      set((state) => ({
        lockedBands: state.lockedBands.includes(band)
          ? state.lockedBands.filter((b) => b !== band)
          : [...state.lockedBands, band],
      })),

    setContextMenu: (menu) => set({ contextMenu: menu }),
    setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
    setLibraryOpen: (open) => set({ libraryOpen: open }),
    setInsightsOpen: (open) => set({ insightsOpen: open }),
  }
}

/**
 * Factory used by tests (no persistence); the app uses the persisted
 * singleton below, which autosaves the working design to localStorage.
 */
export function createStudioStore(options: { persistKey?: string } = {}) {
  if (!options.persistKey) return create<StudioState>()(initializer)
  return create<StudioState>()(
    persist(initializer, {
      name: options.persistKey,
      version: 3,
      // The document now lives in the cloud (per design) + a per-design local
      // cache — only UI preferences persist under this key.
      partialize: (state) => ({
        learningMode: state.learningMode,
        gridVisible: state.gridVisible,
        gridSnap: state.gridSnap,
        gridStepMm: state.gridStepMm,
        libraryOpen: state.libraryOpen,
        insightsOpen: state.insightsOpen,
      }),
      migrate: (persisted) => {
        // Format migrations run on the stored document (v1 px → v2 mm).
        const state = persisted as Partial<StudioState>
        if (state?.doc) {
          try {
            state.doc = migrateDocument(state.doc)
          } catch {
            state.doc = starterTemplate()
          }
        }
        return state as StudioState
      },
    }),
  )
}

// Preferences persist under a NEW key; the legacy 'bloom-studio-design-v1'
// entry (which held a document) is left intact so the dashboard can offer to
// migrate that on-device design into the user's account on first login.
export const useStudio = createStudioStore({ persistKey: 'bloom-studio-prefs-v1' })

// Re-export for existing imports (TopBar) and tests.
export { migrateDocument }
