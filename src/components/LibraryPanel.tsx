import { useMemo, useState } from 'react'
import { FLOWER_CATALOG, VESSEL_CATALOG } from '../data/catalog'
import { photoThumbSrc } from '../render/textures'
import { useStudio } from '../domain/store'
import type { StemCategory } from '../domain/types'

const CATEGORY_LABELS: Record<StemCategory, string> = {
  focal: 'Focal',
  secondary: 'Secondary',
  filler: 'Filler',
  line: 'Line',
  foliage: 'Foliage',
}

const FILTERS: Array<{ id: StemCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'focal', label: 'Focal' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'filler', label: 'Filler' },
  { id: 'line', label: 'Line' },
  { id: 'foliage', label: 'Foliage' },
]

export function LibraryPanel({ onCollapse }: { onCollapse?: () => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StemCategory | 'all'>('all')
  const addStem = useStudio((s) => s.addStem)
  const setVessel = useStudio((s) => s.setVessel)
  const vesselId = useStudio((s) => s.doc.vesselId)
  const learningMode = useStudio((s) => s.learningMode)
  const photoAssetsReady = useStudio((s) => s.photoAssetsReady)

  const flowers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return FLOWER_CATALOG.filter((f) => {
      if (filter !== 'all' && f.category !== filter) return false
      if (!q) return true
      return (
        f.commonName.toLowerCase().includes(q) ||
        f.botanicalName.toLowerCase().includes(q) ||
        f.colorways.some((c) => c.name.toLowerCase().includes(q))
      )
    })
  }, [query, filter])

  return (
    <aside
      className="scroll-slim flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-bloom-200 bg-white/70 p-3"
      aria-label="Flower library"
    >
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Flower library</h2>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Hide flower library"
            aria-label="Hide flower library"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-bloom-ink/55 transition-colors hover:bg-bloom-100 hover:text-bloom-ink"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
      </div>
      <input
        type="search"
        placeholder="Search roses, lilac, eucalyptus…"
        aria-label="Search the flower library"
        className="rounded-lg border border-bloom-200 bg-white px-3 py-1.5 text-sm"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by design role">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`chip border ${
              filter === f.id
                ? 'border-bloom-700 bg-bloom-600 text-white'
                : 'border-bloom-200 bg-white text-bloom-ink/70 hover:bg-bloom-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-2">
        {flowers.map((flower) => {
          const preview = flower.colorways[0]
          const photo = photoAssetsReady ? photoThumbSrc(flower.id, preview.id) : null
          return (
            <li key={flower.id}>
              <div
                role="button"
                tabIndex={0}
                draggable
                className="group flex w-full cursor-pointer flex-col items-center rounded-xl border border-bloom-200 bg-white p-2 text-center shadow-sm transition hover:border-bloom-500 hover:shadow"
                onClick={() => addStem(flower.id)}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/x-bloom-flower',
                    JSON.stringify({ varietyId: flower.id }),
                  )
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    addStem(flower.id)
                  }
                }}
                aria-label={`Add ${flower.commonName} to the canvas`}
                title={
                  learningMode
                    ? `${flower.education.role} (drag onto the canvas to place)`
                    : `${flower.commonName} — drag onto the canvas to place`
                }
              >
                <span className="flex h-16 w-14 items-end justify-center" aria-hidden>
                  {photo && <img className="max-h-full max-w-full object-contain" alt="" src={photo} />}
                </span>
                <span className="mt-1 text-xs font-semibold leading-tight">{flower.commonName}</span>
                <span className="text-[10px] italic text-bloom-ink/50">{flower.botanicalName}</span>
                <span className="mt-0.5 text-[10px] text-bloom-ink/60">
                  £{flower.guidePriceGBP.toFixed(2)} · {CATEGORY_LABELS[flower.category]}
                </span>
                <span className="mt-1 flex items-center gap-1">
                  {flower.colorways.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      aria-label={`Add ${flower.commonName} in ${c.name}`}
                      title={`Add in ${c.name}`}
                      className="h-3.5 w-3.5 rounded-full border border-bloom-200 transition group-hover:scale-110"
                      style={{ backgroundColor: c.petal }}
                      onClick={(e) => {
                        e.stopPropagation()
                        addStem(flower.id, c.id)
                      }}
                    />
                  ))}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {flowers.length === 0 && (
        <p className="text-xs text-bloom-ink/50">No flowers match — try a different search.</p>
      )}

      <h2 className="panel-title mt-2">Vessel & mechanics</h2>
      <div className="flex flex-col gap-1.5" role="group" aria-label="Choose a vessel">
        <button
          className={`rounded-lg border px-3 py-1.5 text-left text-xs ${
            vesselId === null ? 'border-bloom-700 bg-bloom-100' : 'border-bloom-200 bg-white hover:bg-bloom-100'
          }`}
          onClick={() => setVessel(null)}
        >
          <span className="font-semibold">No vessel</span>
          <span className="block text-bloom-ink/60">Loose stems / practice placement</span>
        </button>
        {VESSEL_CATALOG.map((vessel) => (
          <button
            key={vessel.id}
            className={`rounded-lg border px-3 py-1.5 text-left text-xs ${
              vesselId === vessel.id
                ? 'border-bloom-700 bg-bloom-100'
                : 'border-bloom-200 bg-white hover:bg-bloom-100'
            }`}
            onClick={() => setVessel(vessel.id)}
            title={learningMode ? vessel.education : vessel.name}
          >
            <span className="font-semibold">{vessel.name}</span>
            <span className="block text-bloom-ink/60">
              £{vessel.priceGBP.toFixed(2)} · {vessel.mechanics}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
