import { Link } from 'react-router-dom'
import { useStudio } from '../domain/store'
import type { PaperOption } from '../domain/types'
import { UserMenu } from './auth/UserMenu'

const PAPERS: Array<{ id: PaperOption; label: string }> = [
  { id: 'white', label: 'White' },
  { id: 'ivory', label: 'Ivory' },
  { id: 'blush', label: 'Blush' },
  { id: 'charcoal', label: 'Charcoal' },
]

export function TopBar() {
  const docName = useStudio((s) => s.doc.name)
  const doc = useStudio((s) => s.doc)
  const renameDesign = useStudio((s) => s.renameDesign)
  const undo = useStudio((s) => s.undo)
  const redo = useStudio((s) => s.redo)
  const canUndo = useStudio((s) => s.past.length > 0)
  const canRedo = useStudio((s) => s.future.length > 0)
  const learningMode = useStudio((s) => s.learningMode)
  const setLearningMode = useStudio((s) => s.setLearningMode)
  const newDesign = useStudio((s) => s.newDesign)
  const paper = useStudio((s) => s.doc.artboards[0]?.paper ?? 'white')
  const setPaper = useStudio((s) => s.setPaper)

  const confirmNew = () => {
    if (
      doc.stems.length === 0 ||
      window.confirm('Start a new design? Your current design will be replaced (this cannot be undone).')
    ) {
      newDesign('blank')
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-bloom-200 bg-white/80 px-4 py-2">
      <Link
        to="/"
        title="Back to my designs"
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-bloom-700 transition-colors hover:bg-bloom-100"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 6l-6 6 6 6" />
        </svg>
        <span className="font-display text-lg font-semibold">Bloom Studio</span>
      </Link>

      {/* Uncontrolled with a remount key: external name changes (undo/import)
          refresh the field without state-syncing effects. */}
      <input
        key={docName}
        aria-label="Design name"
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium hover:border-bloom-200 focus:border-bloom-200 focus:bg-white"
        defaultValue={docName}
        onBlur={(e) => renameDesign(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />

      <div className="flex items-center gap-1.5">
        <button className="btn-icon" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (⌘Z)">
          ↩
        </button>
        <button className="btn-icon" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (⇧⌘Z)">
          ↪
        </button>

        <label className="flex items-center gap-1.5 text-xs text-bloom-ink/55" title="Presentation ground — white bouquets need a darker paper">
          Paper
          <select
            className="rounded-lg bg-bloom-100/60 px-1.5 py-1 text-sm text-bloom-ink transition-colors hover:bg-bloom-100 focus:bg-white"
            value={paper}
            onChange={(e) => setPaper(e.target.value as PaperOption)}
            aria-label="Artboard paper"
          >
            {PAPERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="btn cursor-pointer select-none" title="Show live feedback and flower notes while you design">
          <input
            type="checkbox"
            className="accent-bloom-600"
            checked={learningMode}
            onChange={(e) => setLearningMode(e.target.checked)}
          />
          Learning mode
        </label>

        <button className="btn" onClick={confirmNew} title="Start a new blank canvas">
          New
        </button>

        <span className="mx-1 h-6 w-px bg-bloom-200" aria-hidden />
        <UserMenu />
      </div>
    </header>
  )
}
