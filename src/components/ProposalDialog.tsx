import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStudio } from '../domain/store'
import { useAuth } from '../domain/auth'
import { buildRecipe } from '../domain/recipe'
import {
  clientIncludedItems,
  defaultProposalDetails,
  gbp,
  proposalToPdf,
  type ProposalDetails,
} from '../domain/proposal'
import {
  readProposalDefaults,
  readProposalDraft,
  writeProposalDefaults,
  writeProposalDraft,
} from '../lib/proposalPrefs'
import { canvasRegistry } from '../render/registry'
import { downloadBlob } from '../utils/download'

const fieldCls =
  'w-full rounded-lg border border-bloom-200 bg-white px-3 py-2 text-sm focus:border-bloom-500 focus:outline-none focus:ring-2 focus:ring-bloom-500/20'
const labelCls = 'mb-1 block text-xs font-semibold text-bloom-ink/60'

/** M6 proposal builder: compose a branded client PDF from the current design. */
export function ProposalDialog({ onClose }: { onClose: () => void }) {
  const { id } = useParams<{ id: string }>()
  const doc = useStudio((s) => s.doc)
  const profile = useAuth((s) => s.profile)
  const recipe = useMemo(() => buildRecipe(doc), [doc])
  const included = useMemo(() => clientIncludedItems(recipe), [recipe])

  const [details, setDetails] = useState<ProposalDetails>(() => {
    const saved = id ? readProposalDraft(id) : null
    if (saved) return saved
    const defs = readProposalDefaults()
    const base = defaultProposalDetails({
      businessName: defs?.businessName ?? profile?.organisation ?? profile?.display_name ?? '',
    })
    if (defs?.terms) base.terms = defs.terms
    return base
  })
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Capture the design once when the dialog opens; reused for preview + PDF.
  useEffect(() => {
    let alive = true
    void canvasRegistry.api?.exportPng().then((png) => alive && setImage(png ?? null))
    return () => {
      alive = false
    }
  }, [])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = <K extends keyof ProposalDetails>(key: K, value: ProposalDetails[K]) =>
    setDetails((d) => ({ ...d, [key]: value }))

  const download = async () => {
    setBusy(true)
    setError(null)
    try {
      const blob = await proposalToPdf({ recipe, designName: doc.name, designImage: image, details })
      const who = details.clientName.trim() || doc.name
      downloadBlob(`${who} — proposal.pdf`, blob)
      if (id) writeProposalDraft(id, details)
      writeProposalDefaults({ businessName: details.businessName, terms: details.terms })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the proposal PDF.')
    } finally {
      setBusy(false)
    }
  }

  const eventBits = [details.eventName.trim(), details.eventDate.trim()].filter(Boolean)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bloom-ink/40 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-bloom-200 px-5 py-3">
          <div>
            <h2 className="font-display text-base font-semibold text-bloom-ink">Client proposal</h2>
            <p className="text-xs text-bloom-ink/55">Design, pricing and terms in one branded PDF.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-bloom-ink/60 hover:bg-bloom-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
          {/* Form */}
          <div className="min-h-0 space-y-3 overflow-y-auto border-b border-bloom-200 p-5 md:border-b-0 md:border-r">
            <div>
              <label className={labelCls}>Business name</label>
              <input className={fieldCls} value={details.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Your studio" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Client name</label>
                <input className={fieldCls} value={details.clientName} onChange={(e) => set('clientName', e.target.value)} placeholder="e.g. Alex Rivera" />
              </div>
              <div>
                <label className={labelCls}>Event date</label>
                <input className={fieldCls} value={details.eventDate} onChange={(e) => set('eventDate', e.target.value)} placeholder="e.g. 14 June 2026" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Occasion</label>
              <input className={fieldCls} value={details.eventName} onChange={(e) => set('eventName', e.target.value)} placeholder="e.g. Spring wedding" />
            </div>
            <div>
              <label className={labelCls}>Cover note</label>
              <textarea className={fieldCls} rows={3} value={details.intro} onChange={(e) => set('intro', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Terms &amp; conditions</label>
              <textarea className={fieldCls} rows={4} value={details.terms} onChange={(e) => set('terms', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Quote valid</label>
              <input className={fieldCls} value={details.validUntil} onChange={(e) => set('validUntil', e.target.value)} placeholder="e.g. 30 days from issue" />
            </div>
          </div>

          {/* Live preview */}
          <div className="min-h-0 overflow-y-auto bg-bloom-50 p-5">
            <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-soft ring-1 ring-bloom-ink/[0.05]">
              <h3 className="font-display text-xl font-semibold text-bloom-700">
                {details.businessName.trim() || 'Floral proposal'}
              </h3>
              <p className="text-xs uppercase tracking-wide text-bloom-ink/45">Floral proposal</p>
              <div className="my-3 h-0.5 rounded bg-bloom-600/70" />

              {details.clientName.trim() && (
                <p className="text-sm font-semibold text-bloom-ink">Prepared for {details.clientName.trim()}</p>
              )}
              {eventBits.length > 0 && (
                <p className="text-xs text-bloom-ink/55">{eventBits.join('  ·  ')}</p>
              )}

              {details.intro.trim() && (
                <p className="mt-3 text-sm leading-relaxed text-bloom-ink/80">{details.intro.trim()}</p>
              )}

              <div className="mt-3 overflow-hidden rounded-lg bg-bloom-50 ring-1 ring-bloom-200">
                {image ? (
                  <img src={image} alt="Design preview" className="mx-auto max-h-56 w-full object-contain" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-bloom-ink/40">
                    Rendering design…
                  </div>
                )}
              </div>

              {included.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-bloom-700">Your arrangement</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-bloom-ink/80">
                    {included.map((item, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="truncate">{item.label}</span>
                        <span className="shrink-0 tabular-nums text-bloom-ink/55">×{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex items-baseline justify-between border-t border-bloom-100 pt-3">
                <span className="text-sm font-semibold text-bloom-ink">Total investment</span>
                <span className="text-lg font-bold text-bloom-700">{gbp(recipe.suggestedRetail)}</span>
              </div>
              <p className="text-[11px] text-bloom-ink/45">
                {recipe.vatEnabled ? `Includes VAT at ${Math.round(recipe.vatRate * 100)}%.` : 'VAT not applicable.'}
              </p>

              {details.terms.trim() && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-bloom-700">Terms &amp; conditions</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-bloom-ink/55">{details.terms.trim()}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-bloom-200 px-5 py-3">
          {error ? <p className="text-xs text-bloom-clay">{error}</p> : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-bloom-ink/60 hover:bg-bloom-100">
              Cancel
            </button>
            <button
              onClick={() => void download()}
              disabled={busy || recipe.stemCount === 0}
              className="rounded-lg bg-bloom-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-bloom-700 disabled:opacity-50"
              title={recipe.stemCount === 0 ? 'Add stems to the design first' : undefined}
            >
              {busy ? 'Building…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
