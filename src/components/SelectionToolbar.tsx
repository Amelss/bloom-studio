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
 * Properties bar for the current selection — position, angle, size, depth band
 * and colourway. Actions (rotate, scale, flip, arrange, cluster, duplicate,
 * delete) live on the left tool rail; this bar is strictly the "inspector"
 * half of that split, so a control never appears in two places. Every field
 * maps to an invertible command; multi-stem edits batch into ONE undo step.
 * Scale is bounded botanical variation (±15%) — flowers never stretch.
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

  return stems.length === 1 ? <SingleProps stem={stems[0]} /> : <MultiProps stems={stems} />
}

function SingleProps({ stem }: { stem: PlacedStem }) {
  const updateStem = useStudio((s) => s.updateStem)
  const updateSelected = useStudio((s) => s.updateSelected)

  const variety = FLOWER_INDEX[stem.varietyId]
  if (!variety) return null

  return (
    <div className="flex min-h-[2.75rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 py-1">
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

      {/* Teach multi-select at the moment it's useful — the hint bar is gone
          once something is selected, so a first-timer never learns it. */}
      <span className="ml-1 hidden text-[11px] text-bloom-ink/45 lg:inline">
        ⇧-click another to select several
      </span>
    </div>
  )
}

function MultiProps({ stems }: { stems: PlacedStem[] }) {
  const updateSelected = useStudio((s) => s.updateSelected)

  const bands = new Set(stems.map((s) => s.band))
  const sameCluster =
    stems[0].clusterId != null && stems.every((s) => s.clusterId === stems[0].clusterId)

  // Colourway swatches only when every stem is the same variety.
  const sameVariety = stems.every((s) => s.varietyId === stems[0].varietyId)
  const variety = sameVariety ? FLOWER_INDEX[stems[0].varietyId] : null
  const colorwayIds = new Set(stems.map((s) => s.colorwayId))

  return (
    <div className="flex h-11 flex-wrap items-center justify-center gap-2">
      <span className="mr-1 text-sm font-medium">
        {stems.length} stems{sameCluster ? ' · cluster' : ''}
      </span>

      <BandSelect value={bands.size === 1 ? stems[0].band : null} />

      {variety && variety.colorways.length > 1 && (
        <span className="ml-1 inline-flex items-center gap-1" role="group" aria-label="Colourway">
          {variety.colorways.map((c) => (
            <button
              key={c.id}
              aria-label={`Colour: ${c.name}`}
              title={c.name}
              onClick={() => updateSelected({ colorwayId: c.id })}
              className={`h-5 w-5 rounded-full border ${
                colorwayIds.size === 1 && colorwayIds.has(c.id)
                  ? 'border-bloom-ink ring-1 ring-bloom-ink'
                  : 'border-bloom-200'
              }`}
              style={{ backgroundColor: c.petal }}
            />
          ))}
        </span>
      )}
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
