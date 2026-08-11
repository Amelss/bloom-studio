import { PRINCIPLES } from '../education/principles'
import {
  newCriterion,
  presetRubricFromPrinciples,
  rubricMaxTotal,
} from '../education/rubric'
import type { Rubric } from '../lib/types'

const fieldCls =
  'w-full rounded-lg border border-bloom-200 bg-white px-3 py-2 text-sm focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20'

/**
 * The rubric builder used when creating or editing an assignment. Controlled:
 * `value` is null for the legacy free 0–100 grade, or a list of weighted
 * criteria for rubric grading.
 */
export function RubricEditor({
  value,
  onChange,
}: {
  value: Rubric | null
  onChange: (rubric: Rubric | null) => void
}) {
  const usingRubric = value != null
  const rubric = value ?? []

  const setRubric = (next: Rubric) => onChange(next)
  const patchAt = (i: number, patch: Partial<Rubric[number]>) =>
    setRubric(rubric.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const removeAt = (i: number) => setRubric(rubric.filter((_, idx) => idx !== i))

  return (
    <div className="rounded-xl border border-bloom-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-bloom-ink/45">Scoring</p>
          <p className="mt-0.5 text-xs text-bloom-ink/55">
            {usingRubric
              ? 'Score each criterion when grading; the total rolls up to a mark out of 100.'
              : 'Grade with a single mark out of 100.'}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-bloom-200 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`rounded-md px-2.5 py-1 transition ${
              !usingRubric ? 'bg-bloom-600 text-white' : 'text-bloom-ink/60 hover:bg-bloom-100'
            }`}
          >
            Simple grade
          </button>
          <button
            type="button"
            onClick={() => onChange(rubric.length ? rubric : [newCriterion()])}
            className={`rounded-md px-2.5 py-1 transition ${
              usingRubric ? 'bg-bloom-600 text-white' : 'text-bloom-ink/60 hover:bg-bloom-100'
            }`}
          >
            Rubric
          </button>
        </div>
      </div>

      {usingRubric && (
        <div className="mt-4 space-y-3">
          {rubric.length === 0 && (
            <p className="text-sm text-bloom-ink/50">Add a criterion to get started.</p>
          )}

          {rubric.map((c, i) => (
            <div key={c.id} className="rounded-lg border border-bloom-100 bg-bloom-50/60 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={c.label}
                    onChange={(e) => patchAt(i, { label: e.target.value })}
                    placeholder="Criterion (e.g. Focal point)"
                    className={fieldCls}
                  />
                  <input
                    value={c.description}
                    onChange={(e) => patchAt(i, { description: e.target.value })}
                    placeholder="What you're looking for (optional)"
                    className={`${fieldCls} text-bloom-ink/70`}
                  />
                </div>
                <div className="flex shrink-0 flex-col items-center">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-bloom-ink/40">Pts</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={c.max}
                    onChange={(e) => patchAt(i, { max: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    className="w-16 rounded-lg border border-bloom-200 px-2 py-2 text-center text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${c.label || 'criterion'}`}
                  className="mt-5 shrink-0 rounded-lg px-2 py-1 text-bloom-ink/40 hover:bg-bloom-100 hover:text-bloom-clay"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setRubric([...rubric, newCriterion()])}
              className="rounded-lg border border-bloom-300 bg-white px-3 py-1.5 text-xs font-semibold text-bloom-700 hover:bg-bloom-100"
            >
              + Add criterion
            </button>
            {rubric.length === 0 && (
              <button
                type="button"
                onClick={() => setRubric(presetRubricFromPrinciples(PRINCIPLES))}
                className="text-xs font-medium text-bloom-700 hover:underline"
              >
                Use design principles
              </button>
            )}
            <span className="ml-auto text-xs font-semibold text-bloom-ink/60">
              Total: {rubricMaxTotal(rubric)} pts
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
