import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { blankDocument, starterTemplate } from '../domain/templates'
import { createDesign } from '../lib/designsApi'
import { listReviewBoard } from '../lib/shareApi'
import { clearLegacyDesign, readLegacyDesign } from '../lib/legacyDesign'
import { AppSidebar, MobileTopBar } from '../components/AppSidebar'
import { DesignCard, EmptyState, GridSkeleton } from '../components/DesignCard'
import { useDesigns } from '../hooks/useDesigns'
import { useAuth } from '../domain/auth'
import type { DesignDocument } from '../domain/types'

/** How many designs the Recent home surfaces; the rest live under My designs. */
const RECENT_LIMIT = 12

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
    icon: <path d="M12 13c2.5 0 4-1.8 4-4s-1.5-4-4-4-4 1.8-4 4 1.5 4 4 4zm0 0v7m-4 0h8" />,
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

/** The Recent home (route `/`): quick-create + the 12 most recent designs. */
export default function Dashboard() {
  const navigate = useNavigate()
  const location = useLocation()
  const profile = useAuth((s) => s.profile)
  const firstName = (profile?.display_name ?? '').split(' ')[0]

  const { designs, error, onRename, onDelete } = useDesigns()
  const [creating, setCreating] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [legacy, setLegacy] = useState<DesignDocument | null>(() => readLegacyDesign())

  useEffect(() => {
    let active = true
    listReviewBoard()
      .then((b) => active && setUnreadCount(b.filter((d) => d.review_status === 'new').length))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Deep-link support: scroll to a section named in the URL hash.
  useEffect(() => {
    if (!location.hash) return
    const el = document.querySelector(location.hash)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, location.key, designs])

  const create = async (build: () => DesignDocument) => {
    setCreating(true)
    try {
      const doc = build()
      const id = await createDesign(doc.name, doc)
      navigate(`/design/${id}`)
    } catch {
      setCreating(false)
    }
  }

  const onImportLegacy = async () => {
    if (!legacy) return
    try {
      const id = await createDesign(legacy.name, legacy)
      clearLegacyDesign()
      navigate(`/design/${id}`)
    } catch {
      // best-effort; the banner stays so the user can retry
    }
  }

  const recent = designs?.slice(0, RECENT_LIMIT) ?? null

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="recent" unread={unreadCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10">
          {/* Hero */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-[15px] text-bloom-ink/55">
              Design an arrangement, cost it instantly, and learn as you go.
            </p>
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
              {designs && designs.length > RECENT_LIMIT && (
                <Link to="/designs" className="text-sm font-medium text-bloom-700 hover:underline">
                  See all {designs.length} →
                </Link>
              )}
            </div>

            {!designs && !error && <GridSkeleton />}

            {recent && recent.length > 0 && (
              <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {recent.map((d) => (
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

            {designs && designs.length === 0 && !error && (
              <EmptyState onStart={() => void create(QUICK_STARTS[0].build)} disabled={creating} />
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
