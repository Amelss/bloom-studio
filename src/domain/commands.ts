import type { DesignDocument, PaperOption, PlacedStem } from './types'

/**
 * Every mutation of a design document is an invertible command. This gives us
 * exact undo/redo now, and the same operation log is the substrate for
 * versioning, collaborative editing (CRDT), and instructor playback later —
 * design decisions become reviewable, which is the educational point.
 */

export type StemPatch = Partial<
  Pick<
    PlacedStem,
    'x' | 'y' | 'rotation' | 'scale' | 'flipX' | 'band' | 'order' | 'colorwayId' | 'clusterId'
  >
>

export type Command =
  | { type: 'add_stem'; stem: PlacedStem }
  | { type: 'remove_stem'; stem: PlacedStem }
  | { type: 'update_stem'; stemId: string; next: StemPatch; prev: StemPatch }
  | { type: 'set_vessel'; next: string | null; prev: string | null }
  | { type: 'set_markup'; next: number; prev: number }
  | { type: 'set_price_override'; varietyId: string; next: number | null; prev: number | null }
  | { type: 'rename'; next: string; prev: string }
  | { type: 'set_paper'; artboardId: string; next: PaperOption; prev: PaperOption }
  /** Several commands as ONE undo step (multi-select operations, gestures). */
  | { type: 'batch'; commands: Command[] }

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
    case 'set_paper':
      return {
        ...doc,
        artboards: doc.artboards.map((a) =>
          a.id === cmd.artboardId ? { ...a, paper: cmd.next } : a,
        ),
      }
    case 'batch':
      return cmd.commands.reduce(applyCommand, doc)
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
    case 'set_paper':
      return { ...cmd, next: cmd.prev, prev: cmd.next }
    case 'batch':
      return { type: 'batch', commands: [...cmd.commands].reverse().map(invertCommand) }
  }
}

/** Collapses to the single command when there is only one — cleaner history. */
export function batchOf(commands: Command[]): Command {
  return commands.length === 1 ? commands[0] : { type: 'batch', commands }
}
