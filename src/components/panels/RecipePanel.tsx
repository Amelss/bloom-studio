import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { useStudio, migrateDocument } from '../../domain/store'
import { buildRecipe, PRICING_DEFAULTS, recipeToCSV, recipeToDocx, recipeToPdf } from '../../domain/recipe'
import { downloadBlob, downloadFile, downloadUrl } from '../../utils/download'
import { canvasRegistry } from '../../render/registry'

const MARKUP_OPTIONS = [2, 2.5, 3, 3.5, 4]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The live recipe: counted from the canvas, never typed in. Editable unit
 * prices (wholesale prices vary by market and week) and a configurable
 * retail markup.
 */
export function RecipePanel() {
  const doc = useStudio((s) => s.doc)
  const setMarkup = useStudio((s) => s.setMarkup)
  const setPriceOverride = useStudio((s) => s.setPriceOverride)
  const updatePricing = useStudio((s) => s.updatePricing)
  const learningMode = useStudio((s) => s.learningMode)
  const importDesign = useStudio((s) => s.importDesign)

  const recipe = useMemo(() => buildRecipe(doc), [doc])
  const [exporting, setExporting] = useState<null | 'csv' | 'docx' | 'pdf'>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const closeMenu = (e: MouseEvent) => {
    const details = (e.currentTarget as HTMLElement).closest('details')
    if (details) details.open = false
  }

  const download = async (format: 'csv' | 'docx' | 'pdf') => {
    setExporting(format)
    try {
      const base = `${doc.name}-recipe`
      if (format === 'csv') {
        downloadFile(`${base}.csv`, 'text/csv', recipeToCSV(recipe, doc.name))
      } else if (format === 'docx') {
        downloadBlob(`${base}.docx`, await recipeToDocx(recipe, doc.name))
      } else {
        downloadBlob(`${base}.pdf`, await recipeToPdf(recipe, doc.name))
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not export the recipe.')
    } finally {
      setExporting(null)
    }
  }

  const exportPng = async () => {
    const dataUrl = await canvasRegistry.api?.exportPng()
    if (dataUrl) downloadUrl(`${doc.name}.png`, dataUrl)
  }

  const onImportFile = async (file: File) => {
    try {
      const imported = migrateDocument(JSON.parse(await file.text()))
      importDesign(imported)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not read that design file.')
    }
  }

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

      {/* Cost breakdown — how the retail price is actually built up. */}
      <dl className="space-y-1 text-sm">
        <SummaryRow label="Total stems" value={String(recipe.stemCount)} />
        <SummaryRow label="Flower cost" value={`£${recipe.flowerCost.toFixed(2)}`} />
        <SummaryRow label="Wastage (conditioning)" value={`£${recipe.wastage.toFixed(2)}`} muted />
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-bloom-ink/60">
            <label htmlFor="markup-select">Flowers ×</label>
            <select
              id="markup-select"
              className="rounded bg-bloom-100/60 px-1.5 py-0.5 text-xs transition-colors hover:bg-bloom-100 focus:bg-white"
              value={recipe.markup}
              onChange={(e) => setMarkup(parseFloat(e.target.value))}
            >
              {MARKUP_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}×
                </option>
              ))}
            </select>
          </dt>
          <dd className="font-semibold tabular-nums">£{recipe.flowerRetail.toFixed(2)}</dd>
        </div>
        {recipe.vessel && (
          <SummaryRow label={`Vessel (${recipe.vessel.name})`} value={`£${recipe.vesselRetail.toFixed(2)}`} />
        )}
        <SummaryRow label="Labour" value={`£${recipe.labour.toFixed(2)}`} />
        {recipe.vatEnabled && (
          <SummaryRow label={`VAT (${Math.round(recipe.vatRate * 100)}%)`} value={`£${recipe.vat.toFixed(2)}`} muted />
        )}
        <div className="mt-1 flex items-baseline justify-between border-t border-bloom-200/70 pt-2.5">
          <dt className="text-sm text-bloom-ink/60">Suggested retail</dt>
          <dd className="font-display text-2xl font-semibold tabular-nums text-bloom-700">
            £{recipe.suggestedRetail.toFixed(2)}
          </dd>
        </div>
      </dl>

      {/* Pricing controls — seasonality, VAT, and the studio's rates. */}
      <div className="space-y-2 rounded-lg border border-bloom-200 p-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="month-select" className="text-bloom-ink/60">Priced for</label>
          <select
            id="month-select"
            className="rounded bg-bloom-100/60 px-1.5 py-0.5 transition-colors hover:bg-bloom-100 focus:bg-white"
            value={recipe.month}
            onChange={(e) => updatePricing({ month: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center justify-between gap-2">
          <span className="text-bloom-ink/60">Add VAT (20%)</span>
          <input
            type="checkbox"
            className="accent-bloom-600"
            checked={recipe.vatEnabled}
            onChange={(e) => updatePricing({ vatEnabled: e.target.checked })}
          />
        </label>
        <details>
          <summary className="cursor-pointer list-none text-bloom-ink/45 transition-colors hover:text-bloom-ink">
            Adjust labour &amp; rates ▾
          </summary>
          <div className="mt-2 space-y-1.5">
            <NumberRow
              label="Labour £/hour"
              value={doc.pricing.labourRatePerHour ?? PRICING_DEFAULTS.labourRatePerHour}
              step="1"
              onChange={(v) => updatePricing({ labourRatePerHour: v })}
            />
            <NumberRow
              label="Minutes per stem"
              value={doc.pricing.minutesPerStem ?? PRICING_DEFAULTS.minutesPerStem}
              step="0.5"
              onChange={(v) => updatePricing({ minutesPerStem: v })}
            />
            <NumberRow
              label="Vessel markup ×"
              value={doc.pricing.vesselMarkup ?? PRICING_DEFAULTS.vesselMarkup}
              step="0.5"
              onChange={(v) => updatePricing({ vesselMarkup: v })}
            />
            <NumberRow
              label="Wastage %"
              value={Math.round((doc.pricing.wastageRate ?? PRICING_DEFAULTS.wastageRate) * 100)}
              step="1"
              onChange={(v) => updatePricing({ wastageRate: v / 100 })}
            />
          </div>
        </details>
      </div>

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

      <div className="flex flex-col gap-1">
        {/* Recipe & shopping list, in the format the studio prefers.
            Shared `name` makes the two menus mutually exclusive: opening one
            closes the other. */}
        <details name="recipe-actions" className="relative">
          <summary className="btn w-full justify-center !py-1 cursor-pointer list-none text-xs">
            {exporting ? 'Downloading…' : 'Download ▾'}
          </summary>
          <div className="absolute top-full left-0 z-50 mt-1.5 w-full rounded-xl bg-white p-1 shadow-pop ring-1 ring-bloom-ink/[0.06]">
            {([
              ['csv', 'Spreadsheet (CSV)'],
              ['docx', 'Word document (.docx)'],
              ['pdf', 'PDF document (.pdf)'],
            ] as const).map(([format, label]) => (
              <button
                key={format}
                className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={recipe.stemCount === 0 || exporting !== null}
                onClick={(e) => {
                  closeMenu(e)
                  void download(format)
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </details>

        {/* Whole-design export + import, relocated here from the top bar. */}
        <details name="recipe-actions" className="relative">
          <summary className="btn w-full justify-center !py-1 cursor-pointer list-none text-xs">Export ▾</summary>
          <div className="absolute top-full left-0 z-50 mt-1.5 w-full rounded-xl bg-white p-1 shadow-pop ring-1 ring-bloom-ink/[0.06]">
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                void exportPng()
              }}
            >
              Design snapshot (PNG)
            </button>
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                downloadFile(`${doc.name}.bloom.json`, 'application/json', JSON.stringify(doc, null, 2))
              }}
            >
              Design file (.bloom.json)
            </button>
            <button
              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-bloom-100"
              onClick={(e) => {
                closeMenu(e)
                fileInputRef.current?.click()
              }}
            >
              Import design file…
            </button>
          </div>
        </details>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onImportFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function SummaryRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={muted ? 'text-bloom-ink/45' : 'text-bloom-ink/60'}>{label}</dt>
      <dd className={`tabular-nums ${muted ? 'text-bloom-ink/55' : 'font-semibold'}`}>{value}</dd>
    </div>
  )
}

function NumberRow({
  label,
  value,
  step,
  onChange,
}: {
  label: string
  value: number
  step: string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-bloom-ink/60">{label}</span>
      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          if (Number.isFinite(v) && v >= 0) onChange(v)
        }}
        className="w-16 rounded bg-bloom-100/60 px-1.5 py-0.5 text-right tabular-nums transition-colors hover:bg-bloom-100 focus:bg-white"
      />
    </label>
  )
}
