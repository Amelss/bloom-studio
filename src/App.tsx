import { useEffect } from 'react'
import { TopBar } from './components/TopBar'
import { LibraryPanel } from './components/LibraryPanel'
import { SidePanel } from './components/SidePanel'
import { SelectionToolbar } from './components/SelectionToolbar'
import { CanvasStage } from './components/canvas/CanvasStage'
import { useStudio } from './domain/store'

export default function App() {
  useKeyboardShortcuts()

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LibraryPanel />
        <main className="flex min-w-0 flex-1 flex-col gap-1 p-3" aria-label="Design workspace">
          <SelectionToolbar />
          <CanvasStage />
        </main>
        <SidePanel />
      </div>
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

      if (isModifier && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }

      if (!store.selectedId) return
      const stem = store.doc.stems.find((s) => s.id === store.selectedId)
      if (!stem) return
      const step = e.shiftKey ? 10 : 2

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
          store.updateSelected({ flipX: !stem.flipX })
          break
        case 'r':
          store.updateSelected({ rotation: stem.rotation + 15 })
          break
        case 'R':
          store.updateSelected({ rotation: stem.rotation - 15 })
          break
        case 'Escape':
          store.select(null)
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
