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
import {
  DESIGN_DOC_VERSION,
  generateId,
  type DesignDocument,
  type PlacedStem,
  type StemCategory,
} from './types'
import { FLOWER_INDEX } from '../data/catalog'

export interface StudioState {
  doc: DesignDocument
  selectedId: string | null
  learningMode: boolean
  showFormGuide: boolean
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
}

/** Default scale and placement spread per design role. */
const CATEGORY_DEFAULTS: Record<StemCategory, { scale: number; spread: number }> = {
  focal: { scale: 1, spread: 90 },
  secondary: { scale: 0.88, spread: 130 },
  filler: { scale: 0.8, spread: 150 },
  line: { scale: 1.1, spread: 170 },
  foliage: { scale: 1.15, spread: 185 },
}

/** Roles that should slot in behind existing material by default. */
const INSERT_BEHIND: StemCategory[] = ['foliage', 'line']

const HISTORY_LIMIT = 200

// Snapshots taken at the start of a drag/transform so the whole gesture
// commits as a single undoable command.
const transformSnapshots = new Map<string, StemPatch>()

const MUTABLE_KEYS = ['x', 'y', 'rotation', 'scale', 'flipX', 'z', 'colorwayId'] as const

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

const initializer: StateCreator<StudioState> = (set, get) => ({
  doc: starterTemplate(),
  selectedId: null,
  learningMode: true,
  showFormGuide: false,
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
    const defaults = CATEGORY_DEFAULTS[variety.category]
    const cx = doc.canvas.width / 2
    const cy = doc.canvas.height / 2 - 30
    const x = cx + (Math.random() * 2 - 1) * defaults.spread
    const y = cy + (Math.random() * 2 - 1) * defaults.spread * 0.55
    // Lean stems gently outward from the binding point, plus a little jitter —
    // naive straight placement is what makes digital arrangements read as collage.
    const rotation = ((x - cx) / defaults.spread) * 16 + (Math.random() * 10 - 5)

    const zs = doc.stems.map((s) => s.z)
    const z = INSERT_BEHIND.includes(variety.category)
      ? (zs.length ? Math.min(...zs) : 0) - 1
      : (zs.length ? Math.max(...zs) : 0) + 1

    const stem: PlacedStem = {
      id: generateId(),
      varietyId,
      colorwayId: colorwayId ?? variety.colorways[0].id,
      x: Math.round(x),
      y: Math.round(y),
      rotation: Math.round(rotation),
      scale: defaults.scale,
      flipX: x > cx && Math.random() > 0.4,
      z,
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
    const maxZ = Math.max(...doc.stems.map((s) => s.z))
    const copy: PlacedStem = {
      ...source,
      id: generateId(),
      x: source.x + 34,
      y: source.y + 22,
      rotation: source.rotation + (Math.random() * 12 - 6),
      z: maxZ + 1,
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
    get().updateSelected({
      x: clamp(stem.x + dx, 0, doc.canvas.width),
      y: clamp(stem.y + dy, 0, doc.canvas.height),
    })
  },

  layerSelected: (direction) => {
    const { doc, selectedId } = get()
    const stem = doc.stems.find((s) => s.id === selectedId)
    if (!stem) return
    const zs = doc.stems.map((s) => s.z)
    const z = direction === 'forward' ? Math.max(...zs) + 1 : Math.min(...zs) - 1
    get().updateSelected({ z })
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
})

/**
 * Validates and migrates an incoming design document. Currently v1 only; the
 * switch is where future format migrations will live.
 */
export function migrateDocument(raw: unknown): DesignDocument {
  if (!raw || typeof raw !== 'object') throw new Error('Not a design document')
  const doc = raw as Partial<DesignDocument>
  if (typeof doc.version !== 'number' || !Array.isArray(doc.stems) || !doc.canvas) {
    throw new Error('Not a Bloom Studio design file')
  }
  if (doc.version > DESIGN_DOC_VERSION) {
    throw new Error(
      `This design was made with a newer version of Bloom Studio (format v${doc.version}).`,
    )
  }
  return doc as DesignDocument
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
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
      version: 1,
      partialize: (state) => ({
        doc: state.doc,
        learningMode: state.learningMode,
      }),
    }),
  )
}

export const useStudio = createStudioStore({ persistKey: 'bloom-studio-design-v1' })
