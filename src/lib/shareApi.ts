import { supabase } from './supabase'
import type { DesignDocument } from '../domain/types'
import type { DesignFeedback, FeedbackVerdict, SharedDesign } from './types'

/**
 * Read-only share links. Publishing a design writes an unguessable `share_id`
 * onto its row; anyone with the link reads it (and leaves one response) through
 * two SECURITY DEFINER functions — never through direct table access. See
 * supabase/migrations/0003_sharing.sql.
 */

const SHARE_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** A 22-char URL-safe token from the CSPRNG (~130 bits — unguessable). */
function generateShareId(): string {
  const bytes = new Uint8Array(22)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += SHARE_ALPHABET[b % SHARE_ALPHABET.length]
  return out
}

/**
 * Turn sharing on for a design, minting a token if one doesn't exist yet.
 * Returns the share id (existing or new). Idempotent — re-enabling keeps the
 * same link so a URL already handed out never breaks.
 *
 * Goes through the `set_design_share` RPC rather than a table write: rpc() is a
 * POST (a direct partial UPDATE would be a PATCH, which some deployments block
 * at CORS), and doing the write server-side avoids the INSERT-shaped payload
 * that trips the designs.doc NOT NULL constraint. Ownership is enforced in the
 * function. See supabase/migrations/0004_share_toggle.sql.
 */
export async function enableShare(id: string, existing: string | null): Promise<string> {
  if (existing) return existing
  const token = generateShareId()
  const { data, error } = await supabase.rpc('set_design_share', {
    p_design_id: id,
    p_enabled: true,
    p_token: token,
  })
  if (error) throw error
  return (data as string | null) ?? token
}

/** Revoke the link. Any URL already handed out stops resolving immediately. */
export async function disableShare(id: string): Promise<void> {
  const { error } = await supabase.rpc('set_design_share', {
    p_design_id: id,
    p_enabled: false,
    p_token: null,
  })
  if (error) throw error
}

/** Fetch a shared design by its public token (no auth required). */
export async function getSharedDesign(shareId: string): Promise<SharedDesign | null> {
  const { data, error } = await supabase.rpc('get_shared_design', { p_share_id: shareId })
  if (error) throw error
  const row = (data as SharedDesign[] | null)?.[0]
  if (!row) return null
  return { id: row.id, name: row.name, doc: row.doc as DesignDocument, updated_at: row.updated_at }
}

/** Record a client's approve / request-changes response (no auth required). */
export async function submitFeedback(
  shareId: string,
  verdict: FeedbackVerdict,
  note: string,
  reviewer: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_design_feedback', {
    p_share_id: shareId,
    p_verdict: verdict,
    p_note: note,
    p_reviewer: reviewer,
  })
  if (error) throw error
}

/** Owner-side: the feedback left on one of my designs, newest first. */
export async function listFeedback(designId: string): Promise<DesignFeedback[]> {
  const { data, error } = await supabase
    .from('design_feedback')
    .select('*')
    .eq('design_id', designId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as DesignFeedback[]
}

/** Build the absolute share URL for a token. */
export function shareUrl(shareId: string): string {
  return `${window.location.origin}/s/${shareId}`
}
