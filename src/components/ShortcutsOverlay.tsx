import { useMemo, useState } from 'react'
import { useStudio } from '../domain/store'

interface ShortcutGroup {
  title: string
  items: Array<[keys: string, action: string]>
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Canvas & camera',
    items: [
      ['Space + drag', 'Pan (also middle-mouse or scroll)'],
      ['⌘ + scroll / pinch', 'Zoom to cursor'],
      ['⌘0 · ⌘1 · ⌘2', 'Fit artboard · 100% · fit selection'],
      ['+ / −', 'Step zoom'],
      ["Shift+'", 'Toggle grid'],
    ],
  },
  {
    title: 'Selecting',
    items: [
      ['Click', 'Select stem (whole cluster)'],
      ['Drag empty space', 'Marquee select'],
      ['⇧ Click', 'Add / remove from selection'],
      ['⌥ Click', 'Dig through overlapping stems'],
      ['Double-click', 'Enter a cluster (edit one member)'],
      ['⌘A', 'Select all'],
      ['Right-click', 'Select-same, cluster, remove…'],
      ['Esc', 'Deselect / exit cluster'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Drag', 'Move (smart guides + form guide + grid snap)'],
      ['⌘ while dragging', 'Suspend all snapping'],
      ['Corner handles', 'Resize (bounded ±15%)'],
      ['Top handle', 'Rotate — hold ⇧ for 15° steps'],
      ['R / ⇧R', 'Rotate ±15°'],
      ['Arrows / ⇧ Arrows', 'Nudge 1mm / 10mm'],
      ['F', 'Flip'],
      ['D or ⌘D', 'Duplicate'],
      ['⌘G / ⇧⌘G', 'Cluster / uncluster'],
      ['⌫', 'Remove'],
      ['⌘Z / ⇧⌘Z', 'Undo / redo'],
    ],
  },
  {
    title: 'Depth',
    items: [
      ['[ / ]', 'Recess / advance within band'],
      ['⌘[ / ⌘]', 'Move to the band behind / in front'],
    ],
  },
]

/** Searchable shortcut reference; toggled with `?`. */
export function ShortcutsOverlay() {
  const open = useStudio((s) => s.shortcutsOpen)
  const setOpen = useStudio((s) => s.setShortcutsOpen)
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return GROUPS
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        ([keys, action]) => keys.toLowerCase().includes(q) || action.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length)
  }, [query])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bloom-ink/30 p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-bloom-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-bloom-700">Keyboard shortcuts</h2>
          <input
            type="search"
            placeholder="Filter…"
            aria-label="Filter shortcuts"
            className="ml-auto w-44 rounded-lg border border-bloom-200 px-2.5 py-1 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn-icon" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title}>
              <h3 className="panel-title mb-1.5">{group.title}</h3>
              <dl className="space-y-1">
                {group.items.map(([keys, action]) => (
                  <div key={keys + action} className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="whitespace-nowrap rounded bg-bloom-100 px-1.5 py-0.5 font-mono text-xs">
                      {keys}
                    </dt>
                    <dd className="text-right text-bloom-ink/75">{action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="mt-4 text-xs text-bloom-ink/50">
          Every shortcut also exists as a visible control — the keyboard is acceleration, never
          the only path.
        </p>
      </div>
    </div>
  )
}
