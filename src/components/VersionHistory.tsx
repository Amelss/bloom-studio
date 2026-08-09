import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStudio } from '../domain/store'
import { captureThumbnail } from '../lib/thumbnail'
import {
  createSnapshot,
  deleteSnapshot,
  getSnapshotDoc,
  listSnapshots,
  renameSnapshot,
} from '../lib/snapshotsApi'
import { SharePreview } from './canvas/SharePreview'
import type { DesignDocument } from '../domain/types'
import type { SnapshotKind, SnapshotMeta } from '../lib/types'

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; details?: unknown }
    for (const v of [o.message, o.details]) if (typeof v === 'string' && v) return v
  }
  return typeof e === 'string' ? e : 'Something went wrong.'
}

function friendlyError(e: unknown): string {
  const low = errorMessage(e).toLowerCase()
  if (low.includes('design_snapshots') || low.includes('rename_snapshot') || low.includes('schema cache') || low.includes('does not exist')) {
    return 'Version history isn’t set up on the database yet. Run migration 0007_snapshots.sql in Supabase, then try again.'
  }
  return errorMessage(e)
}

/** Default heading when a snapshot has no florist-given label. */
const KIND_LABEL: Record<SnapshotKind, string> = {
  manual: 'Saved version',
  shared: 'Shared with client',
  approved: 'Client approved',
  auto: 'Before a restore',
}

const KIND_BADGE: Record<SnapshotKind, { label: string; className: string }> = {
  manual: { label: 'Saved', className: 'bg-bloom-ink/[0.06] text-bloom-ink/60' },
  shared: { label: 'Shared', className: 'bg-blue-50 text-blue-600' },
  approved: { label: 'Approved', className: 'bg-bloom-100 text-bloom-700' },
  auto: { label: 'Auto', className: 'bg-bloom-ink/[0.04] text-bloom-ink/45' },
}

/** "just now" / "3 hours ago" / a date past a week. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const secs = Math.round((Date.now() - then) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * The design's version history: a popover listing frozen snapshots (saved by
 * hand, or auto-captured when shared / approved), each restorable without
 * losing the current state. Autosave keeps the live design safe regardless —
 * a snapshot is a milestone you choose to return to.
 */
export function VersionHistory() {
  const { id } = useParams<{ id: string }>()
  const importDesign = useStudio((s) => s.importDesign)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [snaps, setSnaps] = useState<SnapshotMeta[]>([])
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<DesignDocument | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const refresh = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      setSnaps(await listSnapshots(id))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id])

  // Close on Escape or outside click (but keep the preview modal independent).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (preview) return
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (preview) setPreview(null)
      else setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, preview])

  const saveVersion = async () => {
    if (!id) return
    const label = window.prompt('Name this version (optional):', '')
    if (label === null) return // cancelled
    setSaving(true)
    setError(null)
    try {
      const doc = useStudio.getState().doc
      const thumbnail = await captureThumbnail().catch(() => null)
      await createSnapshot({ designId: id, doc, thumbnail, label, kind: 'manual' })
      await refresh()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(false)
    }
  }

  const restore = async (snap: SnapshotMeta) => {
    if (!id) return
    if (!window.confirm('Restore this version? Your current design is saved to history first, so you can undo this.')) return
    setError(null)
    try {
      // Snapshot the current state first, so a restore is itself reversible.
      const current = useStudio.getState().doc
      const thumbnail = await captureThumbnail().catch(() => null)
      await createSnapshot({ designId: id, doc: current, thumbnail, label: 'Before restore', kind: 'auto' })
      const doc = await getSnapshotDoc(snap.id)
      importDesign(doc) // autosave persists it as the new live document
      await refresh()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const rename = async (snap: SnapshotMeta) => {
    const next = window.prompt('Rename this version:', snap.label ?? '')
    if (next === null) return
    setError(null)
    try {
      await renameSnapshot(snap.id, next)
      await refresh()
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const remove = async (snap: SnapshotMeta) => {
    if (!window.confirm('Delete this version from history? This can’t be undone.')) return
    setError(null)
    try {
      await deleteSnapshot(snap.id)
      setSnaps((s) => s.filter((x) => x.id !== snap.id))
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  const openPreview = async (snap: SnapshotMeta) => {
    setError(null)
    try {
      setPreview(await getSnapshotDoc(snap.id))
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        className="btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Version history"
      >
        History
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Version history"
          className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-bloom-200 bg-white p-4 shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-bloom-ink">Version history</h3>
            <button
              onClick={() => void saveVersion()}
              disabled={saving}
              className="rounded-lg bg-bloom-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-bloom-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save version'}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-bloom-ink/50">
            Your work autosaves. Save a version to bookmark a moment you can return to.
          </p>

          {error && (
            <p className="mt-3 rounded-lg border border-bloom-clay/40 bg-orange-50 px-2.5 py-2 text-xs text-bloom-clay">
              {error}
            </p>
          )}

          <div className="mt-3 max-h-80 overflow-y-auto">
            {loading ? (
              <p className="py-2 text-xs text-bloom-ink/45">Loading…</p>
            ) : snaps.length === 0 ? (
              <p className="py-2 text-xs text-bloom-ink/45">
                No saved versions yet. Versions are also captured when you share a design or a client approves it.
              </p>
            ) : (
              <ul className="space-y-2">
                {snaps.map((s) => {
                  const badge = KIND_BADGE[s.kind]
                  return (
                    <li key={s.id} className="rounded-lg border border-bloom-100 bg-bloom-100/40 p-2">
                      <div className="flex gap-2.5">
                        <button
                          onClick={() => void openPreview(s)}
                          title="Preview this version"
                          className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-bloom-200"
                        >
                          {s.thumbnail_url ? (
                            <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-bloom-ink/30" aria-hidden>
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
                                <path d="M4 16l4-5 3 3 3-4 6 6M4 4h16v16H4z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`chip ${badge.className}`}>{badge.label}</span>
                            <span className="text-[11px] text-bloom-ink/40">{relativeTime(s.created_at)}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs font-medium text-bloom-ink">
                            {s.label ?? KIND_LABEL[s.kind]}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                            <button onClick={() => void restore(s)} className="font-semibold text-bloom-700 hover:underline">
                              Restore
                            </button>
                            <button onClick={() => void rename(s)} className="text-bloom-ink/50 hover:text-bloom-ink hover:underline">
                              Rename
                            </button>
                            <button onClick={() => void remove(s)} className="text-bloom-ink/50 hover:text-bloom-clay hover:underline">
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bloom-ink/40 p-4"
          onPointerDown={(e) => e.target === e.currentTarget && setPreview(null)}
        >
          <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-bloom-200 px-4 py-2.5">
              <h4 className="font-display text-sm font-semibold text-bloom-ink">Version preview</h4>
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg px-2 py-1 text-sm text-bloom-ink/60 hover:bg-bloom-100 hover:text-bloom-ink"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 bg-bloom-50">
              <SharePreview doc={preview} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
