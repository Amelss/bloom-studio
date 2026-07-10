import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StateCreator } from 'zustand'
import {
  applyCommand,
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
  type PlacedStem,
  type StemCategory,
} from './types'
import { FLOWER_INDEX } from '../data/catalog'

export type GridStepMm = 5 | 10 | 25 | 50

export interface StudioState {
  doc: DesignDocument
  selectedId: string | null
  learningMode: boolean
  showFormGuide: boolean
  gridVisible: boolean
  gridSnap: boolean
  gridStepMm: GridStepMm
  past: Command[]
  future: Command[]

  run: (cmd: Command) => void
  undo: () => void
  redo: () => void

  addStem: (varietyId: string, colorwayId?: string) => void
  removeSelected: () => void
  duplicateSelected: () => void
  updateSelected: (patch: StemPatch) => void
  nudgeSelected: (dx: number, dy: number) => void
  layerSelected: (direction: 'forward' | 'backward') => void
  bandSelected: (direction: 'forward' | 'backward') => void
  scaleSelected: (delta: number) => void

  beginTransform: (stemId: string) => void
  setStemTransient: (stemId: string, patch: StemPatch) => void
  endTransform: (stemId: string) => void

  select: (id: string | null) => void
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

// Snapshots taken at the start of a drag/transform so the whole gesture
// commits as a single undoable command.
const transformSnapshots = new Map<string, StemPatch>()

const MUTABLE_KEYS = ['x', 'y', 'rotation', 'scale', 'flipX', 'band', 'order', 'colorwayId'] as const

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

const initializer: StateCreator<StudioState> = (set, get) => ({
  doc: starterTemplate(),
  selectedId: null,
  learningMode: true,
  showFormGuide: false,
  gridVisible: false,
  gridSnap: false,
  gridStepMm: 10,
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
      selectedId:
        state.selectedId && nextDoc.stems.some((s) => s.id === state.selectedId)
          ? state.selectedId
          : null,
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
      selectedId:
        state.selectedId && nextDoc.stems.some((s) => s.id === state.selectedId)
          ? state.selectedId
          : null,
    }))
  },

  addStem: (varietyId, colorwayId) => {
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
      x: Math.round(PLACEMENT.x + (Math.random() * 2 - 1) * PLACEMENT.xJitter),
      y: Math.round(PLACEMENT.y + (Math.random() * 2 - 1) * PLACEMENT.yJitter),
      rotation,
      scale: 1,
      flipX: rotation > 8 && Math.random() > 0.4,
      band,
      order: nextOrderInBand(doc, band),
    }
    get().run({ type: 'add_stem', stem })
    set({ selectedId: stem.id })
  },

  removeSelected: () => {
    const { doc, selectedId } = get()
    const stem = doc.stems.find((s) => s.id === selectedId)
    if (!stem) return
    get().run({ type: 'remove_stem', stem })
    set({ selectedId: null })
  },

  duplicateSelected: () => {
    const { doc, selectedId } = get()
    const source = doc.stems.find((s) => s.id === selectedId)
    if (!source) return
    const copy: PlacedStem = {
      ...source,
      id: generateId(),
      x: source.x + 18,
      y: source.y + 8,
      rotation: source.rotation + Math.round(Math.random() * 12 - 6),
      order: nextOrderInBand(doc, source.band),
    }
    get().run({ type: 'add_stem', stem: copy })
    set({ selectedId: copy.id })
  },

  updateSelected: (patch) => {
    const { doc, selectedId } = get()
    const stem = doc.stems.find((s) => s.id === selectedId)
    if (!stem) return
    const prev: StemPatch = {}
    for (const key of Object.keys(patch) as (keyof StemPatch)[]) {
      ;(prev as Record<string, unknown>)[key] = stem[key]
    }
    get().run({ type: 'update_stem', stemId: stem.id, next: patch, prev })
  },

  nudgeSelected: (dx, dy) => {
    const { doc, selectedId } = get()
    const stem = doc.stems.find((s) => s.id === selectedId)
    if (!stem) return
    get().updateSelected({ x: stem.x + dx, y: stem.y + dy })
  },

  layerSelected: (direction) => {
    const { doc, selectedId } = get()
    const stem = doc.stems.find((s) => s.id === selectedId)
    if (!stem) return
    const orders = ordersInBand(doc, stem.band)
    const order = direction === 'forward' ? Math.max(...orders) + 1 : Math.min(...orders) - 1
    get().updateSelected({ order })
  },

  bandSelected: (direction) => {
    const { doc, selectedId } = get()
    const stem = doc.stems.find((s) => s.id === selectedId)
    if (!stem) return
    const rank = DEPTH_BANDS.indexOf(stem.band)
    const nextRank = direction === 'forward' ? rank + 1 : rank - 1
    if (nextRank < 0 || nextRank >= DEPTH_BANDS.length) return
    const band = DEPTH_BANDS[nextRank]
    const orders = ordersInBand(doc, band)
    // Entering from behind lands at the band's back; from in front, its front.
    const order =
      direction === 'forward'
        ? orders.length
          ? Math.min(...orders) - 1
          : 0
        : orders.length
          ? Math.max(...orders) + 1
          : 0
    get().updateSelected({ band, order })
  },

  scaleSelected: (delta) => {
    const { doc, selectedId } = get()
    const stem = doc.stems.find((s) => s.id === selectedId)
    if (!stem) return
    const scale = Math.min(STEM_SCALE_MAX, Math.max(STEM_SCALE_MIN, +(stem.scale + delta).toFixed(2)))
    if (scale === stem.scale) return
    get().updateSelected({ scale })
  },

  beginTransform: (stemId) => {
    const stem = get().doc.stems.find((s) => s.id === stemId)
    if (stem) transformSnapshots.set(stemId, pickMutable(stem))
  },

  setStemTransient: (stemId, patch) => {
    // Live-drag update: mutates the doc without recording history. The whole
    // gesture is committed as one command in endTransform.
    set((state) => ({
      doc: {
        ...state.doc,
        stems: state.doc.stems.map((s) => (s.id === stemId ? { ...s, ...patch } : s)),
      },
    }))
  },

  endTransform: (stemId) => {
    const prevFull = transformSnapshots.get(stemId)
    transformSnapshots.delete(stemId)
    const stem = get().doc.stems.find((s) => s.id === stemId)
    if (!prevFull || !stem) return
    const next: StemPatch = {}
    const prev: StemPatch = {}
    for (const key of MUTABLE_KEYS) {
      if (stem[key] !== prevFull[key]) {
        ;(next as Record<string, unknown>)[key] = stem[key]
        ;(prev as Record<string, unknown>)[key] = prevFull[key]
      }
    }
    if (Object.keys(next).length === 0) return
    // The doc already reflects `next`; record the command for undo/redo.
    set((state) => ({
      doc: touch(state.doc),
      past: [
        ...state.past.slice(-(HISTORY_LIMIT - 1)),
        { type: 'update_stem', stemId, next, prev },
      ],
      future: [],
    }))
  },

  select: (id) => set({ selectedId: id }),

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
      selectedId: null,
      past: [],
      future: [],
    })
  },

  importDesign: (doc) => {
    set({ doc: migrateDocument(doc), selectedId: null, past: [], future: [] })
  },

  setLearningMode: (on) => set({ learningMode: on }),
  setShowFormGuide: (on) => set({ showFormGuide: on }),
  setGridVisible: (on) => set({ gridVisible: on }),
  setGridSnap: (on) => set({ gridSnap: on }),
  setGridStepMm: (step) => set({ gridStepMm: step }),
})

/**
 * Factory used by tests (no persistence); the app uses the persisted
 * singleton below, which autosaves the working design to localStorage.
 */
export function createStudioStore(options: { persistKey?: string } = {}) {
  if (!options.persistKey) return create<StudioState>()(initializer)
  return create<StudioState>()(
    persist(initializer, {
      name: options.persistKey,
      version: 2,
      partialize: (state) => ({
        doc: state.doc,
        learningMode: state.learningMode,
        gridVisible: state.gridVisible,
        gridSnap: state.gridSnap,
        gridStepMm: state.gridStepMm,
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

export const useStudio = createStudioStore({ persistKey: 'bloom-studio-design-v1' })

// Re-export for existing imports (TopBar) and tests.
export { migrateDocument }
