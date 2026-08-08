import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getSharedDesign, submitFeedback } from '../lib/shareApi'
import type { FeedbackVerdict, SharedDesign as SharedDesignRow } from '../lib/types'
import { buildRecipe } from '../domain/recipe'
import { SharePreview } from '../components/canvas/SharePreview'

type State =
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; design: SharedDesignRow }

/**
 * The client-facing view behind a read-only share link (`/s/:token`). Anyone
 * with the link sees the design and its quote — no account — and can leave one
 * approve / request-changes response. For students this is the hand-in surface;
 * for florists, the client sign-off.
 */
export default function SharedDesign() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setState({ kind: 'notfound' })
      return
    }
    getSharedDesign(token)
      .then((design) => {
        if (cancelled) return
        setState(design ? { kind: 'ready', design } : { kind: 'notfound' })
      })
      .catch((err) => {
        if (cancelled) return
        setState({ kind: 'error', message: err instanceof Error ? err.message : 'Something went wrong.' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (state.kind === 'loading') return <CenteredNote>Loading design…</CenteredNote>
  if (state.kind === 'notfound')
    return (
      <CenteredNote>
        <p className="font-medium text-bloom-ink">This link isn’t available.</p>
        <p className="mt-1 text-sm text-bloom-ink/60">
          The share link may have been turned off, or the address is incomplete.
        </p>
      </CenteredNote>
    )
  if (state.kind === 'error') return <CenteredNote>{state.message}</CenteredNote>

  return <SharedView token={token!} design={state.design} />
}

function SharedView({ token, design }: { token: string; design: SharedDesignRow }) {
  const recipe = useMemo(() => buildRecipe(design.doc), [design.doc])

  return (
    <div className="min-h-full bg-bloom-100/40">
      <header className="border-b border-bloom-200 bg-white/80 px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="font-display text-lg font-semibold text-bloom-700">Florafo</span>
          <span className="chip bg-bloom-100 text-bloom-700">Shared design</span>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-5 py-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="Design preview" className="flex flex-col">
          <h1 className="font-display text-xl font-semibold text-bloom-ink">{design.name}</h1>
          <p className="mt-0.5 text-xs text-bloom-ink/50">
            Updated {new Date(design.updated_at).toLocaleDateString()}
          </p>
          <div className="mt-3 aspect-[4/3] overflow-hidden rounded-2xl border border-bloom-200 bg-white">
            <SharePreview doc={design.doc} />
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <QuoteCard recipe={recipe} />
          <FeedbackForm token={token} />
        </div>
      </main>
    </div>
  )
}

function QuoteCard({ recipe }: { recipe: ReturnType<typeof buildRecipe> }) {
  return (
    <section aria-label="Recipe and quote" className="rounded-2xl border border-bloom-200 bg-white p-4">
      <h2 className="font-display text-sm font-semibold text-bloom-ink">Recipe</h2>
      <ul className="mt-2 divide-y divide-bloom-100 text-sm">
        {recipe.lines.map((line) => (
          <li key={line.key} className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="min-w-0">
              <span className="font-medium text-bloom-ink">{line.count}×</span>{' '}
              <span className="text-bloom-ink/80">{line.varietyName}</span>
              <span className="text-bloom-ink/45"> · {line.colorwayName}</span>
              {line.outOfSeason && <span className="chip ml-1.5 bg-amber-50 text-amber-700">seasonal</span>}
            </span>
            <span className="shrink-0 tabular-nums text-bloom-ink/70">£{line.lineTotal.toFixed(2)}</span>
          </li>
        ))}
        {recipe.vessel && (
          <li className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="text-bloom-ink/80">{recipe.vessel.name}</span>
            <span className="shrink-0 tabular-nums text-bloom-ink/70">£{recipe.vesselRetail.toFixed(2)}</span>
          </li>
        )}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-t border-bloom-200 pt-3">
        <span className="text-sm font-medium text-bloom-ink">Suggested price</span>
        <span className="font-display text-lg font-semibold tabular-nums text-bloom-700">
          £{recipe.suggestedRetail.toFixed(2)}
        </span>
      </div>
      {recipe.vatEnabled && (
        <p className="mt-1 text-right text-[11px] text-bloom-ink/45">
          incl. VAT £{recipe.vat.toFixed(2)}
        </p>
      )}
    </section>
  )
}

function FeedbackForm({ token }: { token: string }) {
  const [verdict, setVerdict] = useState<FeedbackVerdict | null>(null)
  const [note, setNote] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const send = async () => {
    if (!verdict) return
    setStatus('sending')
    try {
      await submitFeedback(token, verdict, note, reviewer)
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <section className="rounded-2xl border border-bloom-500/40 bg-bloom-100 p-4 text-sm">
        <p className="font-medium text-bloom-700">Thanks — your response has been sent.</p>
        <p className="mt-1 text-bloom-ink/60">
          {verdict === 'approved'
            ? 'The florist has been notified that you approved this design.'
            : 'The florist has been notified that you’d like some changes.'}
        </p>
      </section>
    )
  }

  return (
    <section aria-label="Your response" className="rounded-2xl border border-bloom-200 bg-white p-4">
      <h2 className="font-display text-sm font-semibold text-bloom-ink">Your response</h2>
      <p className="mt-0.5 text-xs text-bloom-ink/55">Let the florist know what you think.</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setVerdict('approved')}
          aria-pressed={verdict === 'approved'}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            verdict === 'approved'
              ? 'border-bloom-600 bg-bloom-100 text-bloom-700'
              : 'border-bloom-200 text-bloom-ink/70 hover:bg-bloom-100'
          }`}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => setVerdict('changes_requested')}
          aria-pressed={verdict === 'changes_requested'}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            verdict === 'changes_requested'
              ? 'border-bloom-clay bg-orange-50 text-bloom-clay'
              : 'border-bloom-200 text-bloom-ink/70 hover:bg-bloom-100'
          }`}
        >
          Request changes
        </button>
      </div>

      <input
        value={reviewer}
        onChange={(e) => setReviewer(e.target.value)}
        placeholder="Your name (optional)"
        className="mt-3 w-full rounded-lg border border-bloom-200 px-3 py-2 text-sm focus:border-bloom-500 focus:outline-none"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          verdict === 'changes_requested' ? 'What would you like changed?' : 'Add a note (optional)'
        }
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-bloom-200 px-3 py-2 text-sm focus:border-bloom-500 focus:outline-none"
      />

      {status === 'error' && (
        <p className="mt-2 text-xs text-bloom-clay">Couldn’t send that — please try again.</p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={!verdict || status === 'sending'}
        className="mt-3 w-full rounded-lg bg-bloom-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-bloom-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'sending' ? 'Sending…' : 'Send response'}
      </button>
    </section>
  )
}

function CenteredNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-bloom-100/40 px-6 text-center">
      <div className="max-w-sm">{children}</div>
    </div>
  )
}
