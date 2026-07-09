import { useStudio } from '../domain/store'
import { FLOWER_INDEX } from '../data/catalog'

/**
 * Context bar for the selected stem: rotate, scale, flip, depth, colour,
 * duplicate, delete. Every control maps to an invertible command, so the
 * whole toolbar is undo-safe.
 */
export function SelectionToolbar() {
  const selectedId = useStudio((s) => s.selectedId)
  const stem = useStudio((s) => s.doc.stems.find((x) => x.id === s.selectedId))
  const updateSelected = useStudio((s) => s.updateSelected)
  const layerSelected = useStudio((s) => s.layerSelected)
  const duplicateSelected = useStudio((s) => s.duplicateSelected)
  const removeSelected = useStudio((s) => s.removeSelected)

  if (!selectedId || !stem) {
    return (
      <div className="flex h-11 items-center justify-center text-xs text-bloom-ink/50">
        Select a stem to adjust it — or click a flower in the library to add one. Keyboard:
        arrows move · R rotates · [ ] change depth · D duplicates · F flips · ⌫ removes
      </div>
    )
  }

  const variety = FLOWER_INDEX[stem.varietyId]
  if (!variety) return null

  return (
    <div className="flex h-11 flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-sm font-medium">{variety.commonName}</span>

      <button className="btn-icon" aria-label="Rotate left" title="Rotate left (Shift+R)"
        onClick={() => updateSelected({ rotation: stem.rotation - 15 })}>⟲</button>
      <button className="btn-icon" aria-label="Rotate right" title="Rotate right (R)"
        onClick={() => updateSelected({ rotation: stem.rotation + 15 })}>⟳</button>

      <button className="btn-icon" aria-label="Smaller" title="Smaller"
        onClick={() => updateSelected({ scale: Math.max(0.4, +(stem.scale - 0.1).toFixed(2)) })}>−</button>
      <button className="btn-icon" aria-label="Larger" title="Larger"
        onClick={() => updateSelected({ scale: Math.min(2, +(stem.scale + 0.1).toFixed(2)) })}>＋</button>

      <button className="btn-icon" aria-label="Flip horizontally" title="Flip (F)"
        onClick={() => updateSelected({ flipX: !stem.flipX })}>⇋</button>

      <button className="btn-icon" aria-label="Send backward" title="Recess — send backward ( [ )"
        onClick={() => layerSelected('backward')}>▽</button>
      <button className="btn-icon" aria-label="Bring forward" title="Advance — bring forward ( ] )"
        onClick={() => layerSelected('forward')}>△</button>

      {variety.colorways.length > 1 && (
        <span className="ml-1 inline-flex items-center gap-1" role="group" aria-label="Colourway">
          {variety.colorways.map((c) => (
            <button
              key={c.id}
              aria-label={`Colour: ${c.name}`}
              title={c.name}
              onClick={() => updateSelected({ colorwayId: c.id })}
              className={`h-5 w-5 rounded-full border ${
                stem.colorwayId === c.id ? 'border-bloom-ink ring-1 ring-bloom-ink' : 'border-bloom-200'
              }`}
              style={{ backgroundColor: c.petal }}
            />
          ))}
        </span>
      )}

      <button className="btn-icon ml-1" aria-label="Duplicate" title="Duplicate (D)"
        onClick={duplicateSelected}>⧉</button>
      <button className="btn-icon text-red-800" aria-label="Remove stem" title="Remove (⌫)"
        onClick={removeSelected}>✕</button>
    </div>
  )
}
