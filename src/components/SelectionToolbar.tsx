import { useStudio } from '../domain/store'
import { FLOWER_INDEX } from '../data/catalog'
import {
  BAND_LABELS,
  DEPTH_BANDS,
  STEM_SCALE_MAX,
  STEM_SCALE_MIN,
  type DepthBand,
  type PlacedStem,
} from '../domain/types'

/**
 * Context bar for the selection. Every control maps to an invertible command
 * (multi-stem operations batch into ONE undo step). Scale is bounded
 * botanical variation (±15%) — flowers never stretch.
 */
export function SelectionToolbar() {
  const selectedIds = useStudio((s) => s.selectedIds)
  const doc = useStudio((s) => s.doc)
  const stems = doc.stems.filter((s) => selectedIds.includes(s.id))

  if (stems.length === 0) {
    return (
      <div className="flex h-11 items-center justify-center text-xs text-bloom-ink/50">
        Click a stem to select · drag empty space for marquee · ⇧click adds · ⌥click digs ·
        double-click enters a cluster · press ? for all shortcuts
      </div>
    )
  }

  return stems.length === 1 ? <SingleStemToolbar stem={stems[0]} /> : <MultiToolbar stems={stems} />
}

function SingleStemToolbar({ stem }: { stem: PlacedStem }) {
  const updateSelected = useStudio((s) => s.updateSelected)
  const updateStem = useStudio((s) => s.updateStem)
  const layerSelected = useStudio((s) => s.layerSelected)
  const scaleSelected = useStudio((s) => s.scaleSelected)
  const duplicateSelected = useStudio((s) => s.duplicateSelected)
  const removeSelected = useStudio((s) => s.removeSelected)
  const ungroupSelected = useStudio((s) => s.ungroupSelected)

  const variety = FLOWER_INDEX[stem.varietyId]
  if (!variety) return null

  return (
    <div className="flex h-11 flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-sm font-medium">{variety.commonName}</span>

      <NumField
        label="X"
        value={+(stem.x / 10).toFixed(1)}
        suffix="cm"
        onCommit={(v) => updateStem(stem.id, { x: Math.round(v * 100) / 10 })}
      />
      <NumField
        label="Y"
        value={+(stem.y / 10).toFixed(1)}
        suffix="cm"
        onCommit={(v) => updateStem(stem.id, { y: Math.round(v * 100) / 10 })}
      />
      <NumField
        label="∠"
        value={Math.round(stem.rotation)}
        suffix="°"
        onCommit={(v) => updateStem(stem.id, { rotation: v })}
      />
      <NumField
        label="Size"
        value={Math.round(stem.scale * 100)}
        suffix="%"
        onCommit={(v) =>
          updateStem(stem.id, {
            scale: Math.min(STEM_SCALE_MAX, Math.max(STEM_SCALE_MIN, v / 100)),
          })
        }
      />

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

      <BandSelect value={stem.band} />

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

      {stem.clusterId && (
        <button className="btn" title="Remove from cluster (⇧⌘G)" onClick={ungroupSelected}>
          Uncluster
        </button>
      )}

      <button className="btn-icon ml-1" aria-label="Duplicate" title="Duplicate (D)"
        onClick={duplicateSelected}>⧉</button>
      <button className="btn-icon text-red-800" aria-label="Remove stem" title="Remove (⌫)"
        onClick={removeSelected}>✕</button>
    </div>
  )
}

function MultiToolbar({ stems }: { stems: PlacedStem[] }) {
  const rotateSelected = useStudio((s) => s.rotateSelected)
  const scaleSelected = useStudio((s) => s.scaleSelected)
  const flipSelected = useStudio((s) => s.flipSelected)
  const layerSelected = useStudio((s) => s.layerSelected)
  const duplicateSelected = useStudio((s) => s.duplicateSelected)
  const removeSelected = useStudio((s) => s.removeSelected)
  const groupSelected = useStudio((s) => s.groupSelected)
  const ungroupSelected = useStudio((s) => s.ungroupSelected)

  const bands = new Set(stems.map((s) => s.band))
  const sameCluster =
    stems[0].clusterId != null && stems.every((s) => s.clusterId === stems[0].clusterId)
  const anyClustered = stems.some((s) => s.clusterId)

  return (
    <div className="flex h-11 flex-wrap items-center justify-center gap-1.5">
      <span className="mr-1 text-sm font-medium">
        {stems.length} stems{sameCluster ? ' · cluster' : ''}
      </span>

      <button className="btn-icon" aria-label="Rotate all left" title="Rotate −15° each"
        onClick={() => rotateSelected(-15)}>⟲</button>
      <button className="btn-icon" aria-label="Rotate all right" title="Rotate +15° each"
        onClick={() => rotateSelected(15)}>⟳</button>
      <button className="btn-icon" aria-label="Smaller" title="Smaller (−5% each)"
        onClick={() => scaleSelected(-0.05)}>−</button>
      <button className="btn-icon" aria-label="Larger" title="Larger (+5% each)"
        onClick={() => scaleSelected(0.05)}>＋</button>
      <button className="btn-icon" aria-label="Flip all" title="Flip (F)"
        onClick={flipSelected}>⇋</button>
      <button className="btn-icon" aria-label="Send backward" title="Recess ( [ )"
        onClick={() => layerSelected('backward')}>▽</button>
      <button className="btn-icon" aria-label="Bring forward" title="Advance ( ] )"
        onClick={() => layerSelected('forward')}>△</button>

      <BandSelect value={bands.size === 1 ? stems[0].band : null} />

      {!sameCluster && stems.length >= 2 && (
        <button className="btn" title="Cluster — wire these stems as one unit (⌘G)" onClick={groupSelected}>
          Cluster
        </button>
      )}
      {anyClustered && (
        <button className="btn" title="Uncluster (⇧⌘G)" onClick={ungroupSelected}>
          Uncluster
        </button>
      )}

      <button className="btn-icon ml-1" aria-label="Duplicate selection" title="Duplicate (D)"
        onClick={duplicateSelected}>⧉</button>
      <button className="btn-icon text-red-800" aria-label="Remove selection" title="Remove (⌫)"
        onClick={removeSelected}>✕</button>
    </div>
  )
}

function BandSelect({ value }: { value: DepthBand | null }) {
  const updateSelected = useStudio((s) => s.updateSelected)
  return (
    <label className="ml-1 inline-flex items-center gap-1 text-xs text-bloom-ink/70">
      Band
      <select
        className="rounded-lg border border-bloom-200 bg-white px-1.5 py-1 text-xs"
        value={value ?? ''}
        onChange={(e) => updateSelected({ band: e.target.value as DepthBand })}
        aria-label="Depth band"
        title="Depth band (⌘[ / ⌘] to move)"
      >
        {value === null && <option value="">mixed</option>}
        {DEPTH_BANDS.map((band) => (
          <option key={band} value={band}>
            {BAND_LABELS[band]}
          </option>
        ))}
      </select>
    </label>
  )
}

function NumField({
  label,
  value,
  suffix,
  onCommit,
}: {
  label: string
  value: number
  suffix: string
  onCommit: (value: number) => void
}) {
  return (
    <label className="inline-flex items-center gap-0.5 text-xs text-bloom-ink/70">
      {label}
      <input
        // Uncontrolled + remount on external change: no state-sync effects.
        key={value}
        type="number"
        defaultValue={value}
        aria-label={`${label} (${suffix})`}
        className="w-14 rounded-lg border border-bloom-200 bg-white px-1.5 py-1 text-right text-xs tabular-nums"
        onBlur={(e) => {
          const v = parseFloat(e.target.value)
          if (Number.isFinite(v) && v !== value) onCommit(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      <span aria-hidden>{suffix}</span>
    </label>
  )
}
