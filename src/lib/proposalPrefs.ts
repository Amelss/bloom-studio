import type { ProposalDetails } from '../domain/proposal'

/**
 * Proposal drafts live on the device (localStorage), not the cloud — a branded
 * PDF is a local export, so there's no server round-trip. Business identity +
 * terms are remembered globally (a florist reuses them across designs); the
 * client/event fields are remembered per design.
 */

const DEFAULTS_KEY = 'florafo.proposal.defaults'
const draftKey = (designId: string) => `florafo.proposal.draft.${designId}`

/** Florist-level reusable bits, carried onto every new proposal. */
export interface ProposalDefaults {
  businessName: string
  terms: string
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode / quota — a lost draft is non-fatal.
  }
}

export function readProposalDefaults(): ProposalDefaults | null {
  return readJson<ProposalDefaults>(DEFAULTS_KEY)
}

export function writeProposalDefaults(defaults: ProposalDefaults): void {
  writeJson(DEFAULTS_KEY, defaults)
}

export function readProposalDraft(designId: string): ProposalDetails | null {
  return readJson<ProposalDetails>(draftKey(designId))
}

export function writeProposalDraft(designId: string, details: ProposalDetails): void {
  writeJson(draftKey(designId), details)
}
