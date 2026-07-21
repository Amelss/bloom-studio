import { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { LibraryPanel } from './components/LibraryPanel'
import { Toolbar } from './components/Toolbar'
import { SidePanel } from './components/SidePanel'
import { SelectionToolbar } from './components/SelectionToolbar'
import { ContextMenu } from './components/ContextMenu'
import { ShortcutsOverlay } from './components/ShortcutsOverlay'
import { Announcer } from './components/Announcer'
import { PixiStage } from './components/canvas/PixiStage'
import { CanvasControls } from './components/canvas/CanvasControls'
import { canvasRegistry } from './render/registry'
import { useStudio } from './domain/store'

export default function App() {
  useKeyboardShortcuts()
  const libraryOpen = useStudio((s) => s.libraryOpen)
  const insightsOpen = useStudio((s) => s.insightsOpen)
  const setLibraryOpen = useStudio((s) => s.setLibraryOpen)
  const setInsightsOpen = useStudio((s) => s.setInsightsOpen)

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {libraryOpen ? (
          <LibraryPanel onCollapse={() => setLibraryOpen(false)} />
        ) : (
          <CollapsedTab side="left" label="Flower library" onExpand={() => setLibraryOpen(true)} />
        )}
        <Toolbar />
        <main className="flex min-w-0 flex-1 flex-col" aria-label="Design workspace">
          <SelectionToolbar />
          <div className="relative min-h-0 flex-1">
            <PixiStage />
            <CanvasControls />
          </div>
        </main>
        {insightsOpen ? (
          <SidePanel onCollapse={() => setInsightsOpen(false)} />
        ) : (
          <CollapsedTab side="right" label="Recipe & insights" onExpand={() => setInsightsOpen(true)} />
        )}
      </div>
      <ContextMenu />
      <ShortcutsOverlay />
      <Announcer />
    </div>
  )
}

/**
 * The slim rail a collapsed side panel leaves behind: a chevron to reopen it
 * plus a vertical label, so the panel is one click away and the canvas keeps
 * the reclaimed width.
 */
function CollapsedTab({
  side,
  label,
  onExpand,
}: {
  side: 'left' | 'right'
  label: string
  onExpand: () => void
}) {
  return (
    <div
      className={`flex w-9 shrink-0 flex-col items-center bg-white/70 ${
        side === 'left' ? 'border-r' : 'border-l'
      } border-bloom-200`}
    >
      <button
        type="button"
        onClick={onExpand}
        title={`Show ${label}`}
        aria-label={`Show ${label}`}
        className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg text-bloom-ink/70 transition-colors hover:bg-bloom-100 hover:text-bloom-ink"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {side === 'left' ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
        </svg>
      </button>
      <span
        className="mt-3 select-none text-[11px] font-semibold uppercase tracking-wide text-bloom-ink/45"
        style={{ writingMode: 'vertical-rl' }}
      >
        {label}
      </span>
    </div>
  )
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      const store = useStudio.getState()
      const isModifier = e.metaKey || e.ctrlKey

      // Escape works through the UI stack: overlay → menu → brush → cluster → selection.
      if (e.key === 'Escape') {
        if (store.shortcutsOpen) store.setShortcutsOpen(false)
        else if (store.contextMenu) store.setContextMenu(null)
        else if (store.brush) store.setBrush(null)
        else if (store.enteredClusterId) store.exitCluster()
        else store.setSelection([])
        return
      }

      // Hold X for the depth x-ray (bands fan apart).
      if (e.key.toLowerCase() === 'x' && !isModifier) {
        if (!e.repeat) store.setXrayActive(true)
        return
      }
      if (e.key === '?') {
        store.setShortcutsOpen(!store.shortcutsOpen)
        return
      }

      // Camera
      if (e.key === ' ') {
        e.preventDefault() // stop page scroll; hold to pan
        if (!e.repeat) canvasRegistry.api?.setSpacePan(true)
        return
      }
      if (isModifier && e.key === '0') {
        e.preventDefault()
        canvasRegistry.api?.fitArtboard()
        return
      }
      if (isModifier && e.key === '1') {
        e.preventDefault()
        canvasRegistry.api?.zoomTo100()
        return
      }
      if (isModifier && e.key === '2') {
        e.preventDefault()
        canvasRegistry.api?.fitSelection()
        return
      }
      if (!isModifier && (e.key === '+' || e.key === '=')) {
        canvasRegistry.api?.zoomBy(1.25)
        return
      }
      if (!isModifier && e.key === '-') {
        canvasRegistry.api?.zoomBy(0.8)
        return
      }
      if (e.key === '"') {
        store.setGridVisible(!store.gridVisible)
        return
      }

      // Cursor tools (V select · H hand/pan), matching creative-app convention.
      if (!isModifier && e.key.toLowerCase() === 'v') {
        store.setTool('select')
        return
      }
      if (!isModifier && e.key.toLowerCase() === 'h') {
        store.setTool('pan')
        return
      }

      // History & selection-wide commands
      if (isModifier && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (isModifier && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        store.selectAll()
        return
      }
      if (isModifier && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (e.shiftKey) store.ungroupSelected()
        else store.groupSelected()
        return
      }

      // Panel toggles: [ hides/shows the left library, ] the right insights.
      // Only when nothing is selected, so a selection keeps the brackets for
      // layer order ([ send backward, ] bring forward).
      if (!isModifier && !store.selectedIds.length && (e.key === '[' || e.key === ']')) {
        if (e.key === '[') store.setLibraryOpen(!store.libraryOpen)
        else store.setInsightsOpen(!store.insightsOpen)
        return
      }

      // Selected-stem operations
      if (!store.selectedIds.length) return
      const step = e.shiftKey ? 10 : 1 // mm

      if (isModifier && e.key === '[') {
        e.preventDefault()
        store.sendToBack()
        return
      }
      if (isModifier && e.key === ']') {
        e.preventDefault()
        store.bringToFront()
        return
      }
      if (isModifier && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        store.duplicateSelected()
        return
      }

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault()
          store.removeSelected()
          break
        case 'ArrowLeft':
          e.preventDefault()
          store.nudgeSelected(-step, 0)
          break
        case 'ArrowRight':
          e.preventDefault()
          store.nudgeSelected(step, 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          store.nudgeSelected(0, -step)
          break
        case 'ArrowDown':
          e.preventDefault()
          store.nudgeSelected(0, step)
          break
        case '[':
          store.layerSelected('backward')
          break
        case ']':
          store.layerSelected('forward')
          break
        case 'd':
        case 'D':
          store.duplicateSelected()
          break
        case 'f':
        case 'F':
          store.flipSelected()
          break
        case 'r':
          store.rotateSelected(15)
          break
        case 'R':
          store.rotateSelected(-15)
          break
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') canvasRegistry.api?.setSpacePan(false)
      if (e.key.toLowerCase() === 'x') useStudio.getState().setXrayActive(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])
}
