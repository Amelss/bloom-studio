import { useStudio } from '../../domain/store'
import { FLOWER_INDEX, getColorway } from '../../data/catalog'
import { BAND_LABELS, DEPTH_BANDS, type DepthBand } from '../../domain/types'

/**
 * The Depth panel: the florist's answer to a layers panel. Four bands,
 * front-most first, with per-band hide (alt-click = solo) and lock.
 * "Hide everything but greenery" is a structural x-ray of the design.
 */
export function DepthPanel() {
  const doc = useStudio((s) => s.doc)
  const selectedIds = useStudio((s) => s.selectedIds)
  const selectOne = useStudio((s) => s.selectOne)
  const toggleSelect = useStudio((s) => s.toggleSelect)
  const hiddenBands = useStudio((s) => s.hiddenBands)
  const lockedBands = useStudio((s) => s.lockedBands)
  const toggleBandHidden = useStudio((s) => s.toggleBandHidden)
  const soloBand = useStudio((s) => s.soloBand)
  const toggleBandLocked = useStudio((s) => s.toggleBandLocked)
  const learningMode = useStudio((s) => s.learningMode)

  const bandsFrontFirst = [...DEPTH_BANDS].reverse()

  return (
    <div className="flex flex-col gap-3">
      {learningMode && (
        <p className="rounded-lg bg-bloom-100 px-3 py-2 text-xs text-bloom-ink/70">
          Designs are built in depth: foliage skeleton at the back, body, focal blooms, then
          floating accents. Hide a band (👁) to x-ray the structure — ⌥-click to solo it.
        </p>
      )}
      {bandsFrontFirst.map((band) => (
        <BandSection
          key={band}
          band={band}
          hidden={hiddenBands.includes(band)}
          locked={lockedBands.includes(band)}
          onToggleHidden={(solo) => (solo ? soloBand(band) : toggleBandHidden(band))}
          onToggleLocked={() => toggleBandLocked(band)}
          stems={doc.stems.filter((s) => s.band === band).sort((a, b) => b.order - a.order)}
          selectedIds={selectedIds}
          onSelect={(id, additive) => (additive ? toggleSelect(id) : selectOne(id))}
        />
      ))}
    </div>
  )
}

function BandSection({
  band,
  hidden,
  locked,
  stems,
  selectedIds,
  onToggleHidden,
  onToggleLocked,
  onSelect,
}: {
  band: DepthBand
  hidden: boolean
  locked: boolean
  stems: ReturnType<typeof useStudio.getState>['doc']['stems']
  selectedIds: string[]
  onToggleHidden: (solo: boolean) => void
  onToggleLocked: () => void
  onSelect: (id: string, additive: boolean) => void
}) {
  return (
    <section aria-label={`${BAND_LABELS[band]} band`} className="rounded-xl border border-bloom-200 bg-white">
      <header className="flex items-center gap-1.5 border-b border-bloom-100 px-2.5 py-1.5">
        <h3 className="flex-1 text-xs font-semibold">
          {BAND_LABELS[band]}
          <span className="ml-1 font-normal text-bloom-ink/50">({stems.length})</span>
        </h3>
        <button
          className={`btn-icon !px-1.5 !py-0.5 text-xs ${hidden ? 'opacity-40' : ''}`}
          aria-pressed={hidden}
          aria-label={`${hidden ? 'Show' : 'Hide'} ${BAND_LABELS[band]} band`}
          title={`${hidden ? 'Show' : 'Hide'} band · ⌥-click to solo`}
          onClick={(e) => onToggleHidden(e.altKey)}
        >
          {hidden ? '−' : '👁'}
        </button>
        <button
          className={`btn-icon !px-1.5 !py-0.5 text-xs ${locked ? 'bg-bloom-100 ring-1 ring-bloom-500' : ''}`}
          aria-pressed={locked}
          aria-label={`${locked ? 'Unlock' : 'Lock'} ${BAND_LABELS[band]} band`}
          title={locked ? 'Unlock band' : 'Lock band (visible but not selectable)'}
          onClick={onToggleLocked}
        >
          {locked ? '🔒' : '🔓'}
        </button>
      </header>
      {stems.length === 0 ? (
        <p className="px-2.5 py-1.5 text-[11px] text-bloom-ink/40">Empty</p>
      ) : (
        <ul>
          {stems.map((stem) => {
            const variety = FLOWER_INDEX[stem.varietyId]
            const colorway = getColorway(stem.varietyId, stem.colorwayId)
            const selected = selectedIds.includes(stem.id)
            return (
              <li key={stem.id}>
                <button
                  className={`flex w-full items-center gap-2 px-2.5 py-1 text-left text-xs ${
                    selected ? 'bg-bloom-100 font-medium' : 'hover:bg-bloom-50'
                  }`}
                  aria-pressed={selected}
                  onClick={(e) => onSelect(stem.id, e.shiftKey)}
                  title="Click selects · ⇧-click adds to selection"
                >
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-full border border-bloom-200"
                    style={{ backgroundColor: colorway?.petal }}
                  />
                  <span className="flex-1 truncate">
                    {variety?.commonName ?? stem.varietyId}
                    <span className="ml-1 text-bloom-ink/45">{colorway?.name}</span>
                  </span>
                  {stem.clusterId && <span aria-label="In a cluster" title="In a cluster">⛓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
