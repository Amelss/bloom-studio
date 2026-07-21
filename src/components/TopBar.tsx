import { useRef, type MouseEvent } from 'react'
import { useStudio, migrateDocument } from '../domain/store'
import { canvasRegistry } from '../render/registry'
import { downloadFile, downloadUrl } from '../utils/download'
import type { PaperOption } from '../domain/types'

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
  const importDesign = useStudio((s) => s.importDesign)
  const paper = useStudio((s) => s.doc.artboards[0]?.paper ?? 'white')
  const setPaper = useStudio((s) => s.setPaper)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeMenu = (e: MouseEvent) => {
    const details = (e.currentTarget as HTMLElement).closest('details')
    if (details) details.open = false
  }

  const confirmNew = (kind: 'starter' | 'blank') => {
    if (
      doc.stems.length === 0 ||
      window.confirm('Start a new design? Your current design will be replaced (this cannot be undone).')
    ) {
      newDesign(kind)
    }
  }

  const exportPng = async () => {
    const dataUrl = await canvasRegistry.api?.exportPng()
    if (dataUrl) downloadUrl(`${doc.name}.png`, dataUrl)
  }

  const onImportFile = async (file: File) => {
    try {
      const imported = migrateDocument(JSON.parse(await file.text()))
      importDesign(imported)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not read that design file.')
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-bloom-200 bg-white/80 px-4 py-2">
      <h1 className="font-display text-lg font-semibold text-bloom-700">
        Bloom Studio
        <span className="chip ml-2 bg-bloom-100 align-middle text-bloom-700">Student Edition</span>
      </h1>

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

        <details className="relative">
          <summary className="btn cursor-pointer list-none">New ▾</summary>
          <div className="absolute right-0 z-50 mt-1.5 w-48 rounded-xl bg-white p-1 shadow-pop ring-1 ring-bloom-ink/[0.06]">
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                confirmNew('starter')
              }}
            >
              Starter bouquet template
            </button>
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                confirmNew('blank')
              }}
            >
              Blank canvas
            </button>
          </div>
        </details>

        <details className="relative">
          <summary className="btn cursor-pointer list-none">Export ▾</summary>
          <div className="absolute right-0 z-50 mt-1.5 w-56 rounded-xl bg-white p-1 shadow-pop ring-1 ring-bloom-ink/[0.06]">
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                void exportPng()
              }}
            >
              Design snapshot (PNG)
            </button>
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                downloadFile(`${doc.name}.bloom.json`, 'application/json', JSON.stringify(doc, null, 2))
              }}
            >
              Design file (.bloom.json)
            </button>
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                fileInputRef.current?.click()
              }}
            >
              Import design file…
            </button>
          </div>
        </details>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onImportFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </header>
  )
}
