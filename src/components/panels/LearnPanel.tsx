import { useMemo, useState } from 'react'
import { useStudio } from '../../domain/store'
import { analyzeDesign, type InsightTone } from '../../education/insights'
import { PRINCIPLES } from '../../education/principles'
import { FLOWER_INDEX, getColorway } from '../../data/catalog'

const TONE_STYLES: Record<InsightTone, { icon: string; className: string }> = {
  positive: { icon: '✓', className: 'border-bloom-500/50 bg-bloom-100 text-bloom-700' },
  tip: { icon: '✦', className: 'border-amber-500/40 bg-amber-50 text-amber-800' },
  watch: { icon: '!', className: 'border-bloom-clay/50 bg-orange-50 text-bloom-clay' },
}

/**
 * The learning layer: live feedback computed from the design's structured
 * data, notes on the selected flower, and the principle/practice library.
 */
export function LearnPanel() {
  const doc = useStudio((s) => s.doc)
  const selectedStem = useStudio((s) =>
    s.selectedIds.length === 1 ? s.doc.stems.find((x) => x.id === s.selectedIds[0]) : undefined,
  )
  const [openPrincipleId, setOpenPrincipleId] = useState<string | null>(null)

  const insights = useMemo(() => analyzeDesign(doc), [doc])
  const selectedVariety = selectedStem ? FLOWER_INDEX[selectedStem.varietyId] : null

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Live design feedback">
        <h3 className="panel-title mb-2">Design feedback</h3>
        <ul className="space-y-2" aria-live="polite">
          {insights.map((insight) => {
            const tone = TONE_STYLES[insight.tone]
            return (
              <li key={insight.id} className={`rounded-lg border px-3 py-2 ${tone.className}`}>
                <p className="flex items-start gap-2 text-xs font-semibold">
                  <span aria-hidden>{tone.icon}</span>
                  {insight.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-bloom-ink/80">{insight.body}</p>
                <button
                  className="mt-1 text-xs font-medium underline decoration-dotted underline-offset-2"
                  onClick={() =>
                    setOpenPrincipleId(openPrincipleId === insight.principleId ? null : insight.principleId)
                  }
                >
                  Why? → {PRINCIPLES.find((p) => p.id === insight.principleId)?.name}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {selectedVariety && selectedStem && (
        <section
          aria-label="Selected flower notes"
          className="rounded-xl border border-bloom-200 bg-white p-3"
        >
          <h3 className="font-display text-sm font-semibold">
            {selectedVariety.commonName}
            <span className="ml-1 text-xs font-normal italic text-bloom-ink/50">
              {selectedVariety.botanicalName}
            </span>
          </h3>
          <dl className="mt-1.5 space-y-1 text-xs text-bloom-ink/80">
            <div>
              <dt className="inline font-semibold">Colour: </dt>
              <dd className="inline">{getColorway(selectedStem.varietyId, selectedStem.colorwayId)?.name}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Season: </dt>
              <dd className="inline capitalize">{selectedVariety.seasons.join(', ')}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Fragility: </dt>
              <dd className="inline capitalize">{selectedVariety.fragility} · {selectedVariety.stemLengthCm}cm stems</dd>
            </div>
            <div>
              <dt className="font-semibold">Role in a design</dt>
              <dd>{selectedVariety.education.role}</dd>
            </div>
            <div>
              <dt className="font-semibold">Conditioning</dt>
              <dd>{selectedVariety.education.conditioning}</dd>
            </div>
            <div>
              <dt className="font-semibold">Design tip</dt>
              <dd>{selectedVariety.education.designTip}</dd>
            </div>
          </dl>
        </section>
      )}

      <section aria-label="Design principles reference">
        <h3 className="panel-title mb-2">Principles & practice</h3>
        <ul className="space-y-1.5">
          {PRINCIPLES.map((principle) => {
            const open = openPrincipleId === principle.id
            return (
              <li key={principle.id} className="rounded-lg border border-bloom-200 bg-white">
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold"
                  aria-expanded={open}
                  onClick={() => setOpenPrincipleId(open ? null : principle.id)}
                >
                  <span>
                    {principle.name}
                    {principle.group === 'practice' && (
                      <span className="chip ml-1.5 bg-bloom-100 text-bloom-700">studio practice</span>
                    )}
                  </span>
                  <span aria-hidden>{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div className="border-t border-bloom-100 px-3 py-2 text-xs leading-relaxed text-bloom-ink/80">
                    <p className="mb-1.5 font-medium">{principle.summary}</p>
                    <p>{principle.body}</p>
                    <p className="mt-2 rounded bg-bloom-100 px-2 py-1.5">
                      <span className="font-semibold">Try it: </span>
                      {principle.tryIt}
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
