import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { blankDocument, starterTemplate } from '../domain/templates'
import { createDesign, deleteDesign, listDesigns, renameDesign } from '../lib/designsApi'
import { INBOX_SEEN_KEY, listInbox } from '../lib/shareApi'
import { clearLegacyDesign, readLegacyDesign } from '../lib/legacyDesign'
import { AppSidebar, FlorafoGlyph, MobileTopBar } from '../components/AppSidebar'
import { useAuth } from '../domain/auth'
import type { DesignListItem } from '../lib/types'
import type { DesignDocument } from '../domain/types'

/** Time-of-day greeting for the hero. */
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/** The quick-create row — each opens the editor pre-set for a design style. */
const QUICK_STARTS: {
  key: string
  title: string
  blurb: string
  build: () => DesignDocument
  icon: React.ReactNode
}[] = [
  {
    key: 'bouquet',
    title: 'Hand-tied bouquet',
    blurb: 'Spiral wrap, ready to build',
    build: () => {
      const d = blankDocument('Hand-tied bouquet')
      d.vesselId = 'kraft-wrap'
      return d
    },
    icon: (
      <path d="M12 13c2.5 0 4-1.8 4-4s-1.5-4-4-4-4 1.8-4 4 1.5 4 4 4zm0 0v7m-4 0h8" />
    ),
  },
  {
    key: 'compote',
    title: 'Compote arrangement',
    blurb: 'Footed bowl, garden style',
    build: () => {
      const d = blankDocument('Compote arrangement')
      d.vesselId = 'compote'
      return d
    },
    icon: <path d="M4 9h16l-2 6a3 3 0 01-3 2H9a3 3 0 01-3-2L4 9zm8 8v3m-3 0h6" />,
  },
  {
    key: 'starter',
    title: 'Guided starter',
    blurb: 'A worked bouquet to learn from',
    build: () => starterTemplate(),
    icon: <path d="M5 4h11a2 2 0 012 2v14l-6-3-6 3V4zm0 0v0" />,
  },
  {
    key: 'blank',
    title: 'Blank canvas',
    blurb: 'Start from nothing',
    build: () => blankDocument('Untitled arrangement'),
    icon: <path d="M12 5v14M5 12h14" />,
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const profile = useAuth((s) => s.profile)
  const firstName = (profile?.display_name ?? '').split(' ')[0]

  const [designs, setDesigns] = useState<DesignListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [query, setQuery] = useState('')
  const [legacy, setLegacy] = useState<DesignDocument | null>(() => readLegacyDesign())
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setDesigns(await listDesigns())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your designs.')
    }
  }, [])

  useEffect(() => {
    let active = true
    listDesigns()
      .then((d) => active && setDesigns(d))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load your designs.'))
    // Unread badge for the Responses page — best-effort, never blocks designs.
    listInbox()
      .then((f) => {
        if (!active) return
        const seenAt = localStorage.getItem(INBOX_SEEN_KEY) ?? ''
        setUnreadCount(f.filter((x) => x.created_at > seenAt).length)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const create = async (build: () => DesignDocument) => {
    setCreating(true)
    try {
      const doc = build()
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

  const filtered = useMemo(() => {
    if (!designs) return null
    const q = query.trim().toLowerCase()
    return q ? designs.filter((d) => d.name.toLowerCase().includes(q)) : designs
  }, [designs, query])

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="designs" unread={unreadCount} />

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10">
          {/* Hero */}
          <div className="mb-6">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-[15px] text-bloom-ink/55">
              Design an arrangement, cost it instantly, and learn as you go.
            </p>
          </div>

          {/* Search — inline in the content flow, matching the card grid width */}
          <div className="relative mb-8">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bloom-ink/35"
              viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your designs"
              className="w-full rounded-lg border border-bloom-200 bg-white py-2 pl-10 pr-4 text-sm text-bloom-ink placeholder:text-bloom-ink/40 focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20"
            />
          </div>

          {error && (
            <p className="mb-6 rounded-xl bg-bloom-600/[0.06] px-4 py-3 text-sm text-bloom-700 ring-1 ring-bloom-600/15">
              {error}
            </p>
          )}

          {legacy && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bloom-200 bg-white px-4 py-3">
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

          {/* Quick-start row */}
          <section id="start" className="mb-10 scroll-mt-20">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-bloom-ink/45">
              Start something new
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {QUICK_STARTS.map((q) => (
                <button
                  key={q.key}
                  onClick={() => void create(q.build)}
                  disabled={creating}
                  className="group flex flex-col items-start gap-3 rounded-2xl border border-bloom-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-bloom-500/50 disabled:opacity-60"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bloom-600/[0.12] text-bloom-600 transition group-hover:bg-bloom-600 group-hover:text-white">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      {q.icon}
                    </svg>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-bloom-ink">{q.title}</span>
                    <span className="mt-0.5 block text-xs text-bloom-ink/50">{q.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Recent designs */}
          <section id="recent" className="scroll-mt-20">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-display text-xl font-semibold text-bloom-ink">Recent designs</h2>
              {designs && (
                <span className="text-sm text-bloom-ink/45">
                  {designs.length} design{designs.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {!designs && !error && <GridSkeleton />}

            {filtered && filtered.length > 0 && (
              <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((d) => (
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

            {designs && designs.length > 0 && filtered && filtered.length === 0 && (
              <p className="rounded-xl border border-bloom-200 bg-white px-4 py-10 text-center text-sm text-bloom-ink/50">
                No designs match “{query}”.
              </p>
            )}

            {designs && designs.length === 0 && !error && (
              <EmptyState onStart={() => void create(QUICK_STARTS[0].build)} disabled={creating} />
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

/* ──────────────────────────── pieces ──────────────────────────── */

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-bloom-200 bg-white">
          <div className="aspect-[4/3] w-full animate-pulse bg-bloom-100" />
          <div className="space-y-2 px-3 py-3">
            <div className="h-3 w-2/3 animate-pulse rounded bg-bloom-100" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-bloom-100" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyState({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-bloom-200 bg-white px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bloom-600/[0.12] text-bloom-600">
        <FlorafoGlyph className="text-[34px]" />
      </span>
      <h3 className="font-display text-lg font-semibold text-bloom-ink">Your studio is ready</h3>
      <p className="mt-1 max-w-sm text-sm text-bloom-ink/55">
        Nothing here yet. Start a hand-tied bouquet and your recipe and costs build themselves as you design.
      </p>
      <button
        onClick={onStart}
        disabled={disabled}
        className="mt-5 rounded-xl bg-bloom-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-bloom-700 disabled:opacity-50"
      >
        Create your first design
      </button>
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
    <li className="group overflow-hidden rounded-xl border border-bloom-200 bg-white transition hover:-translate-y-0.5 hover:border-bloom-500/50">
      <button
        onClick={onOpen}
        className="block aspect-[4/3] w-full overflow-hidden bg-bloom-100"
        aria-label={`Open ${design.name}`}
      >
        {design.thumbnail_url ? (
          <img src={design.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl text-bloom-ink/20">❧</span>
        )}
      </button>
      <div className="flex items-start justify-between gap-2 px-3 py-2.5">
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
