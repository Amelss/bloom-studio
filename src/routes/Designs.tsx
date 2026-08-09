import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppSidebar, MobileTopBar } from '../components/AppSidebar'
import { DesignCard, GridSkeleton } from '../components/DesignCard'
import { useDesigns } from '../hooks/useDesigns'

/** My designs (route `/designs`): the full library, searchable. */
export default function Designs() {
  const navigate = useNavigate()
  const { designs, error, onRename, onDelete } = useDesigns()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!designs) return null
    const q = query.trim().toLowerCase()
    return q ? designs.filter((d) => d.name.toLowerCase().includes(q)) : designs
  }, [designs, query])

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="designs" />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10">
          <div className="mb-6 flex items-baseline justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-bloom-ink">My designs</h1>
            {designs && (
              <span className="text-sm text-bloom-ink/45">
                {designs.length} design{designs.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Search */}
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
            <p className="rounded-2xl border border-bloom-200 bg-white px-6 py-14 text-center text-sm text-bloom-ink/55">
              No designs yet. Start one from the home page.
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
