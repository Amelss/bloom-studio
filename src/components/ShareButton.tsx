import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { loadDesign } from '../lib/designsApi'
import {
  disableShare,
  enableShare,
  listFeedback,
  setDesignReviewStatus,
  shareUrl,
} from '../lib/shareApi'
import { createSnapshot } from '../lib/snapshotsApi'
import { captureThumbnail } from '../lib/thumbnail'
import { useStudio } from '../domain/store'
import type { DesignFeedback } from '../lib/types'

/**
 * Map a raw Supabase/network error to something the florist can act on. The
 * most common cause during setup is the sharing migration not having been run
 * yet, which surfaces as a missing column/function — call that out by name.
 */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  // Supabase/PostgREST errors are plain objects: { message, code, details, hint }.
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; error_description?: unknown; details?: unknown }
    for (const v of [o.message, o.error_description, o.details]) {
      if (typeof v === 'string' && v) return v
    }
  }
  return typeof e === 'string' ? e : 'Unknown error.'
}

function friendlyError(e: unknown): string {
  const msg = errorMessage(e)
  const low = msg.toLowerCase()
  if (
    low.includes('share_id') ||
    low.includes('get_shared_design') ||
    low.includes('submit_design_feedback') ||
    low.includes('schema cache') ||
    low.includes('could not find') ||
    low.includes('does not exist')
  ) {
    return 'Sharing isn’t set up on the database yet. Run migration 0003_sharing.sql in Supabase, then try again.'
  }
  if (low.includes('not signed in') || low.includes('jwt') || low.includes('auth')) {
    return 'You need to be signed in to share a design.'
  }
  return `Couldn’t update sharing: ${msg}`
}

/**
 * The owner's Share control: publish the current design behind a read-only link,
 * copy it, and read the approve / request-changes responses clients leave. The
 * link is the hand-in / sign-off surface (see /s/:token).
 */
export function ShareButton() {
  const { id } = useParams<{ id: string }>()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [shareId, setShareId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<DesignFeedback[]>([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Load the current share state + feedback when the popover opens.
  useEffect(() => {
    if (!open || !id) return
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([loadDesign(id), listFeedback(id)])
      .then(([row, fb]) => {
        if (cancelled) return
        setShareId(row.share_id ?? null)
        setFeedback(fb)
      })
      .catch((e) => !cancelled && setError(friendlyError(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, id])

  // Close on Escape or outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleShare = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      if (shareId) {
        await disableShare(id)
        setShareId(null)
      } else {
        setShareId(await enableShare(id, null))
        // Freeze "what I sent the client" as a version, best-effort.
        try {
          const doc = useStudio.getState().doc
          const thumbnail = await captureThumbnail().catch(() => null)
          await createSnapshot({ designId: id, doc, thumbnail, label: null, kind: 'shared' })
        } catch {
          // sharing already succeeded; a missing snapshot isn't worth surfacing
        }
      }
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    if (!shareId) return
    await navigator.clipboard.writeText(shareUrl(shareId))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const markReviewed = async () => {
    if (!id) return
    setError(null)
    try {
      await setDesignReviewStatus(id, 'in_review')
      setReviewed(true)
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button className="btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} title="Share a read-only link">
        Share
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share design"
          className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-bloom-200 bg-white p-4 shadow-lg"
        >
          <h3 className="font-display text-sm font-semibold text-bloom-ink">Share this design</h3>

          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 accent-bloom-600"
              checked={!!shareId}
              disabled={loading}
              onChange={toggleShare}
            />
            <span>
              <span className="font-medium text-bloom-ink">Anyone with the link can view</span>
              <span className="block text-xs text-bloom-ink/55">
                Read-only. They can approve or request changes — they can’t edit.
              </span>
            </span>
          </label>

          {error && (
            <p className="mt-3 rounded-lg border border-bloom-clay/40 bg-orange-50 px-2.5 py-2 text-xs text-bloom-clay">
              {error}
            </p>
          )}

          {shareId && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl(shareId)}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-lg border border-bloom-200 bg-bloom-100/50 px-2 py-1.5 text-xs text-bloom-ink/80"
                />
                <button className="btn shrink-0" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* After re-sharing an updated design, move it into In Review. */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => void markReviewed()}
                  disabled={reviewed}
                  className="rounded-lg bg-bloom-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-bloom-700 disabled:opacity-50"
                >
                  {reviewed ? 'In review ✓' : 'Mark as reviewed'}
                </button>
                <span className="text-[11px] text-bloom-ink/50">Moves this design to In Review.</span>
              </div>
            </>
          )}

          <div className="mt-4 border-t border-bloom-100 pt-3">
            <h4 className="text-xs font-semibold text-bloom-ink/70">Client responses</h4>
            {loading ? (
              <p className="mt-1 text-xs text-bloom-ink/45">Loading…</p>
            ) : feedback.length === 0 ? (
              <p className="mt-1 text-xs text-bloom-ink/45">No responses yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-2">
                {feedback.map((f) => (
                  <li key={f.id} className="rounded-lg bg-bloom-100/60 px-2.5 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`chip ${
                          f.verdict === 'approved'
                            ? 'bg-bloom-100 text-bloom-700'
                            : 'bg-orange-50 text-bloom-clay'
                        }`}
                      >
                        {f.verdict === 'approved' ? 'Approved' : 'Changes requested'}
                      </span>
                      <span className="text-bloom-ink/40">
                        {new Date(f.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {f.note && <p className="mt-1 text-bloom-ink/75">{f.note}</p>}
                    {f.reviewer_name && (
                      <p className="mt-0.5 text-bloom-ink/45">— {f.reviewer_name}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
