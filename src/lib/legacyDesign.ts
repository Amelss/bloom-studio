import { migrateDocument } from '../domain/migrate'
import type { DesignDocument } from '../domain/types'

/**
 * The pre-accounts single-design autosave key. Before cloud designs, the whole
 * document lived here. We read it once so the dashboard can offer to lift that
 * on-device work into the new account, then clear it.
 */
const LEGACY_KEY = 'bloom-studio-design-v1'

/** The legacy on-device design, migrated to the current format — or null. */
export function readLegacyDesign(): DesignDocument | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const doc = (JSON.parse(raw) as { state?: { doc?: unknown } })?.state?.doc as
      | { stems?: unknown[] }
      | undefined
    if (!doc || !Array.isArray(doc.stems) || doc.stems.length === 0) return null
    return migrateDocument(doc)
  } catch {
    return null
  }
}

export function clearLegacyDesign(): void {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore
  }
}
