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
import { CanvasFooter } from './components/canvas/CanvasFooter'
import { canvasRegistry } from './render/registry'
import { useStudio } from './domain/store'

export default function App() {
  useKeyboardShortcuts()

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LibraryPanel />
        <Toolbar />
        <main className="flex min-w-0 flex-1 flex-col px-3 pb-1 pt-0" aria-label="Design workspace">
          <SelectionToolbar />
          <div className="min-h-0 flex-1">
            <PixiStage />
          </div>
          <CanvasFooter />
        </main>
        <SidePanel />
      </div>
      <ContextMenu />
      <ShortcutsOverlay />
      <Announcer />
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

      // Selected-stem operations
      if (!store.selectedIds.length) return
      const step = e.shiftKey ? 10 : 1 // mm

      if (isModifier && e.key === '[') {
        e.preventDefault()
        store.bandSelected('backward')
        return
      }
      if (isModifier && e.key === ']') {
        e.preventDefault()
        store.bandSelected('forward')
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
