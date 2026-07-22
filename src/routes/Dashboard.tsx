import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { blankDocument } from '../domain/templates'
import { createDesign, deleteDesign, listDesigns, renameDesign } from '../lib/designsApi'
import { clearLegacyDesign, readLegacyDesign } from '../lib/legacyDesign'
import { UserMenu } from '../components/auth/UserMenu'
import type { DesignListItem } from '../lib/types'
import type { DesignDocument } from '../domain/types'

export default function Dashboard() {
  const navigate = useNavigate()

  const [designs, setDesigns] = useState<DesignListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [legacy, setLegacy] = useState<DesignDocument | null>(() => readLegacyDesign())

  const refresh = useCallback(async () => {
    try {
      setDesigns(await listDesigns())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your designs.')
    }
  }, [])

  // Initial load — setState happens in the async continuation, not synchronously.
  useEffect(() => {
    let active = true
    listDesigns()
      .then((d) => {
        if (active) setDesigns(d)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load your designs.')
      })
    return () => {
      active = false
    }
  }, [])

  const onNew = async () => {
    setCreating(true)
    try {
      const doc = blankDocument('Untitled arrangement')
      const id = await createDesign(doc.name, doc)
      navigate(`/design/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a design.')
      setCreating(false)
    }
  }

  const onImportLegacy = async () => {
    if (!legacy) return
    try {
      const id = await createDesign(legacy.name, legacy)
      clearLegacyDesign()
      navigate(`/design/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import that design.')
    }
  }

  const onRename = async (d: DesignListItem) => {
    const name = window.prompt('Rename design', d.name)?.trim()
    if (!name || name === d.name) return
    await renameDesign(d.id, name)
    void refresh()
  }

  const onDelete = async (d: DesignListItem) => {
    if (!window.confirm(`Delete “${d.name}”? This can’t be undone.`)) return
    await deleteDesign(d.id)
    setDesigns((cur) => cur?.filter((x) => x.id !== d.id) ?? null)
  }

  return (
    <div className="min-h-full bg-bloom-50">
      <header className="flex items-center justify-between border-b border-bloom-200 bg-white/80 px-6 py-3">
        <h1 className="font-display text-lg font-semibold text-bloom-700">Bloom Studio</h1>
        <UserMenu />
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-bloom-ink">My designs</h2>
            <p className="mt-0.5 text-sm text-bloom-ink/55">
              {designs ? `${designs.length} design${designs.length === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <button
            onClick={() => void onNew()}
            disabled={creating}
            className="rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-bloom-700 disabled:opacity-50"
          >
            {creating ? 'Creating…' : '+ New design'}
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
            {error}
          </p>
        )}

        {legacy && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-bloom-100/70 px-4 py-3 ring-1 ring-bloom-200">
            <p className="text-sm text-bloom-ink/75">
              We found a design saved on this device (“{legacy.name}”). Save it to your account?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void onImportLegacy()}
                className="rounded-lg bg-bloom-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-bloom-700"
              >
                Save to my account
              </button>
              <button
                onClick={() => {
                  clearLegacyDesign()
                  setLegacy(null)
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-bloom-ink/60 hover:bg-bloom-100 hover:text-bloom-ink"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {designs && designs.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-bloom-200 bg-white/50 py-16 text-center">
            <p className="text-sm text-bloom-ink/60">No designs yet.</p>
            <button
              onClick={() => void onNew()}
              className="mt-3 rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white hover:bg-bloom-700"
            >
              Create your first design
            </button>
          </div>
        )}

        {designs && designs.length > 0 && (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map((d) => (
              <DesignCard
                key={d.id}
                design={d}
                onOpen={() => navigate(`/design/${d.id}`)}
                onRename={() => void onRename(d)}
                onDelete={() => void onDelete(d)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function DesignCard({
  design,
  onOpen,
  onRename,
  onDelete,
}: {
  design: DesignListItem
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const updated = new Date(design.updated_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return (
    <li className="group overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-bloom-ink/[0.04] transition hover:-translate-y-0.5 hover:shadow-panel">
      <button
        onClick={onOpen}
        className="block aspect-[4/3] w-full overflow-hidden bg-bloom-100"
        aria-label={`Open ${design.name}`}
      >
        {design.thumbnail_url ? (
          <img src={design.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl text-bloom-ink/25">
            ❧
          </span>
        )}
      </button>
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <button onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-sm font-medium text-bloom-ink">{design.name}</p>
          <p className="text-[11px] text-bloom-ink/45">Edited {updated}</p>
        </button>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <IconAction label="Rename" onClick={onRename}>
            <path d="M4 20h4L18.5 9.5a1.5 1.5 0 000-2.5l-1.5-1.5a1.5 1.5 0 00-2.5 0L4 16v4z" />
          </IconAction>
          <IconAction label="Delete" onClick={onDelete} danger>
            <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
          </IconAction>
        </div>
      </div>
    </li>
  )
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-bloom-100 ${
        danger ? 'text-red-700/70 hover:text-red-700' : 'text-bloom-ink/60 hover:text-bloom-ink'
      }`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {children}
      </svg>
    </button>
  )
}
