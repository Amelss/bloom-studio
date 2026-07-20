import { useMemo } from 'react'
import { useStudio } from '../../domain/store'
import { buildRecipe, recipeToCSV } from '../../domain/recipe'
import { downloadFile } from '../../utils/download'

const MARKUP_OPTIONS = [2, 2.5, 3, 3.5, 4]

/**
 * The live recipe: counted from the canvas, never typed in. Editable unit
 * prices (wholesale prices vary by market and week) and a configurable
 * retail markup.
 */
export function RecipePanel() {
  const doc = useStudio((s) => s.doc)
  const setMarkup = useStudio((s) => s.setMarkup)
  const setPriceOverride = useStudio((s) => s.setPriceOverride)
  const learningMode = useStudio((s) => s.learningMode)

  const recipe = useMemo(() => buildRecipe(doc), [doc])

  return (
    <div className="flex flex-col gap-3">
      {recipe.lines.length === 0 ? (
        <p className="text-sm text-bloom-ink/60">
          Add stems to the canvas and your recipe builds itself — every stem counted, costed, and
          ready to order.
        </p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-bloom-200/70 text-[10px] uppercase tracking-wide text-bloom-ink/40">
              <th className="pb-2 pr-1 font-semibold">Item</th>
              <th className="pb-2 pr-1 text-right font-semibold">Qty</th>
              <th className="pb-2 pr-1 text-right font-semibold">Unit £</th>
              <th className="pb-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {recipe.lines.map((line) => (
              <tr key={line.key} className="border-b border-bloom-100">
                <td className="py-1.5 pr-1">
                  <span className="font-medium">{line.varietyName}</span>
                  <span className="block text-bloom-ink/50">{line.colorwayName}</span>
                </td>
                <td className="py-1.5 pr-1 text-right tabular-nums">{line.count}</td>
                <td className="py-1.5 pr-1 text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    aria-label={`Unit price for ${line.varietyName}`}
                    className={`w-14 rounded px-1 py-0.5 text-right tabular-nums transition-colors hover:bg-bloom-100 focus:bg-white focus:shadow-soft ${
                      line.isOverride ? 'bg-bloom-100 font-medium text-bloom-700' : 'bg-transparent'
                    }`}
                    value={line.unitPrice}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      setPriceOverride(line.varietyId, Number.isFinite(value) && value >= 0 ? value : null)
                    }}
                  />
                </td>
                <td className="py-1.5 text-right tabular-nums">£{line.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
            {recipe.vessel && (
              <tr className="border-b border-bloom-100">
                <td className="py-1.5 pr-1 font-medium">{recipe.vessel.name}</td>
                <td className="py-1.5 pr-1 text-right">1</td>
                <td className="py-1.5 pr-1 text-right tabular-nums">£{recipe.vessel.price.toFixed(2)}</td>
                <td className="py-1.5 text-right tabular-nums">£{recipe.vessel.price.toFixed(2)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-bloom-ink/60">Total stems</dt>
          <dd className="font-semibold tabular-nums">{recipe.stemCount}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-bloom-ink/60">Material cost</dt>
          <dd className="font-semibold tabular-nums">£{recipe.materialCost.toFixed(2)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-bloom-ink/60">
            <label htmlFor="markup-select">Markup</label>
          </dt>
          <dd>
            <select
              id="markup-select"
              className="rounded bg-bloom-100/60 px-1.5 py-1 text-sm transition-colors hover:bg-bloom-100 focus:bg-white"
              value={recipe.markup}
              onChange={(e) => setMarkup(parseFloat(e.target.value))}
            >
              {MARKUP_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}×
                </option>
              ))}
            </select>
          </dd>
        </div>
        <div className="mt-1 flex items-baseline justify-between border-t border-bloom-200/70 pt-2.5">
          <dt className="text-sm text-bloom-ink/60">Suggested retail</dt>
          <dd className="font-display text-2xl font-semibold tabular-nums text-bloom-700">
            £{recipe.suggestedRetail.toFixed(2)}
          </dd>
        </div>
      </dl>

      {recipe.vessel && (
        <p className="rounded-lg bg-bloom-100 px-3 py-2 text-xs text-bloom-ink/70">
          <span className="font-semibold">Mechanics:</span> {recipe.vessel.mechanics}
        </p>
      )}

      {learningMode && recipe.stemCount > 0 && (
        <p className="rounded-lg bg-bloom-100/50 px-3 py-2 text-xs leading-relaxed text-bloom-ink/70">
          <span className="font-semibold text-bloom-700">Why this matters:</span> under-counting stems is
          invisible on the invoice and fatal to margin. Studios typically mark up wholesale cost
          2–4× and may add labour on top — try changing the markup and watch the retail price.
        </p>
      )}

      <button
        className="btn justify-center"
        disabled={recipe.stemCount === 0}
        onClick={() => downloadFile(`${doc.name}-recipe.csv`, 'text/csv', recipeToCSV(recipe, doc.name))}
      >
        Download recipe & shopping list (CSV)
      </button>
    </div>
  )
}
