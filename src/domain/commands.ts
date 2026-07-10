import type { DesignDocument, PlacedStem } from './types'

/**
 * Every mutation of a design document is an invertible command. This gives us
 * exact undo/redo now, and the same operation log is the substrate for
 * versioning, collaborative editing (CRDT), and instructor playback later —
 * design decisions become reviewable, which is the educational point.
 */

export type StemPatch = Partial<
  Pick<PlacedStem, 'x' | 'y' | 'rotation' | 'scale' | 'flipX' | 'band' | 'order' | 'colorwayId'>
>

export type Command =
  | { type: 'add_stem'; stem: PlacedStem }
  | { type: 'remove_stem'; stem: PlacedStem }
  | { type: 'update_stem'; stemId: string; next: StemPatch; prev: StemPatch }
  | { type: 'set_vessel'; next: string | null; prev: string | null }
  | { type: 'set_markup'; next: number; prev: number }
  | { type: 'set_price_override'; varietyId: string; next: number | null; prev: number | null }
  | { type: 'rename'; next: string; prev: string }

export function applyCommand(doc: DesignDocument, cmd: Command): DesignDocument {
  switch (cmd.type) {
    case 'add_stem':
      return { ...doc, stems: [...doc.stems, cmd.stem] }
    case 'remove_stem':
      return { ...doc, stems: doc.stems.filter((s) => s.id !== cmd.stem.id) }
    case 'update_stem':
      return {
        ...doc,
        stems: doc.stems.map((s) => (s.id === cmd.stemId ? { ...s, ...cmd.next } : s)),
      }
    case 'set_vessel':
      return { ...doc, vesselId: cmd.next }
    case 'set_markup':
      return { ...doc, pricing: { ...doc.pricing, markup: cmd.next } }
    case 'set_price_override': {
      const priceOverrides = { ...doc.pricing.priceOverrides }
      if (cmd.next == null) delete priceOverrides[cmd.varietyId]
      else priceOverrides[cmd.varietyId] = cmd.next
      return { ...doc, pricing: { ...doc.pricing, priceOverrides } }
    }
    case 'rename':
      return { ...doc, name: cmd.next }
  }
}

export function invertCommand(cmd: Command): Command {
  switch (cmd.type) {
    case 'add_stem':
      return { type: 'remove_stem', stem: cmd.stem }
    case 'remove_stem':
      return { type: 'add_stem', stem: cmd.stem }
    case 'update_stem':
      return { ...cmd, next: cmd.prev, prev: cmd.next }
    case 'set_vessel':
      return { ...cmd, next: cmd.prev, prev: cmd.next }
    case 'set_markup':
      return { ...cmd, next: cmd.prev, prev: cmd.next }
    case 'set_price_override':
      return { ...cmd, next: cmd.prev, prev: cmd.next }
    case 'rename':
      return { ...cmd, next: cmd.prev, prev: cmd.next }
  }
}
