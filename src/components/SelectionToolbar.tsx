import { useStudio } from '../domain/store'
import { FLOWER_INDEX } from '../data/catalog'
import { DEPTH_BANDS, STEM_SCALE_MAX, STEM_SCALE_MIN, type DepthBand } from '../domain/types'

const BAND_LABELS: Record<DepthBand, string> = {
  background: 'Background',
  body: 'Body',
  focal: 'Focal',
  accents: 'Accents',
}

/**
 * Context bar for the selected stem. Every control maps to an invertible
 * command, so the whole toolbar is undo-safe. Scale is bounded botanical
 * variation (±15%) — flowers never stretch.
 */
export function SelectionToolbar() {
  const selectedId = useStudio((s) => s.selectedId)
  const stem = useStudio((s) => s.doc.stems.find((x) => x.id === s.selectedId))
  const updateSelected = useStudio((s) => s.updateSelected)
  const layerSelected = useStudio((s) => s.layerSelected)
  const scaleSelected = useStudio((s) => s.scaleSelected)
  const duplicateSelected = useStudio((s) => s.duplicateSelected)
  const removeSelected = useStudio((s) => s.removeSelected)

  if (!selectedId || !stem) {
    return (
      <div className="flex h-11 items-center justify-center text-xs text-bloom-ink/50">
        Select a stem to adjust it — or click a flower in the library to add one. Keyboard:
        arrows move · R rotates · [ ] depth · ⌘[ ⌘] band · D duplicates · F flips · ⌫ removes
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

      <button className="btn-icon" aria-label="Smaller" title="Smaller (real size −5%)"
        disabled={stem.scale <= STEM_SCALE_MIN} onClick={() => scaleSelected(-0.05)}>−</button>
      <button className="btn-icon" aria-label="Larger" title="Larger (real size +5%)"
        disabled={stem.scale >= STEM_SCALE_MAX} onClick={() => scaleSelected(0.05)}>＋</button>

      <button className="btn-icon" aria-label="Flip horizontally" title="Flip (F)"
        onClick={() => updateSelected({ flipX: !stem.flipX })}>⇋</button>

      <button className="btn-icon" aria-label="Send backward in band" title="Recess ( [ )"
        onClick={() => layerSelected('backward')}>▽</button>
      <button className="btn-icon" aria-label="Bring forward in band" title="Advance ( ] )"
        onClick={() => layerSelected('forward')}>△</button>

      <label className="ml-1 inline-flex items-center gap-1 text-xs text-bloom-ink/70">
        Band
        <select
          className="rounded-lg border border-bloom-200 bg-white px-1.5 py-1 text-xs"
          value={stem.band}
          onChange={(e) => updateSelected({ band: e.target.value as DepthBand })}
          aria-label="Depth band"
          title="Depth band (⌘[ / ⌘] to move)"
        >
          {DEPTH_BANDS.map((band) => (
            <option key={band} value={band}>
              {BAND_LABELS[band]}
            </option>
          ))}
        </select>
      </label>

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
