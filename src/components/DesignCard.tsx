import { FlorafoGlyph } from './AppSidebar'
import type { DesignListItem } from '../lib/types'

/** A single design tile — thumbnail, name, edited date, hover rename/delete. */
export function DesignCard({
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

/** A grid of shimmering placeholders while designs load. */
export function GridSkeleton() {
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

/** First-run state, prompting the user to create their first design. */
export function EmptyState({ onStart, disabled }: { onStart: () => void; disabled: boolean }) {
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
