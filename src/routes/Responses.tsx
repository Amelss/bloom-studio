import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppSidebar, MobileTopBar } from '../components/AppSidebar'
import { INBOX_SEEN_KEY, deleteFeedback, listInbox, resolveFeedback } from '../lib/shareApi'
import type { FeedbackInboxItem } from '../lib/types'

type Tab = 'all' | 'changes_requested' | 'approved'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'approved', label: 'Approved' },
]

/**
 * The client responses page: every approve / request-changes reply across the
 * florist's shared designs, split into All · Changes requested · Approved. A
 * design only appears under Approved once its client actually approved it. The
 * florist can mark a response done (once they've actioned the change) or delete
 * it. Reached from the sidebar; opening it clears the unread badge.
 */
export default function Responses() {
  const navigate = useNavigate()
  const [inbox, setInbox] = useState<FeedbackInboxItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [busy, setBusy] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    listInbox()
      .then((f) => {
        if (!active) return
        setInbox(f)
        // Viewing the page clears the dashboard's unread badge.
        if (f[0]) localStorage.setItem(INBOX_SEEN_KEY, f[0].created_at)
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load responses.'))
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(() => {
    const list = inbox ?? []
    return {
      all: list.length,
      changes_requested: list.filter((f) => f.verdict === 'changes_requested').length,
      approved: list.filter((f) => f.verdict === 'approved').length,
    }
  }, [inbox])

  const visible = useMemo(
    () => (inbox ?? []).filter((f) => tab === 'all' || f.verdict === tab),
    [inbox, tab],
  )

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(id))
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t work — please try again.')
    } finally {
      setBusy((b) => {
        const next = new Set(b)
        next.delete(id)
        return next
      })
    }
  }

  const onResolve = (item: FeedbackInboxItem, resolved: boolean) =>
    withBusy(item.id, async () => {
      await resolveFeedback(item.id, resolved)
      setInbox((cur) =>
        (cur ?? []).map((f) =>
          f.id === item.id ? { ...f, resolved_at: resolved ? new Date().toISOString() : null } : f,
        ),
      )
    })

  const onDelete = (item: FeedbackInboxItem) => {
    if (!window.confirm('Delete this response? This can’t be undone.')) return
    void withBusy(item.id, async () => {
      await deleteFeedback(item.id)
      setInbox((cur) => (cur ?? []).filter((f) => f.id !== item.id))
    })
  }

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="responses" />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-bloom-ink sm:text-3xl">
            Client responses
          </h1>
          <p className="mt-1 text-[15px] text-bloom-ink/55">
            Approvals and change requests from the links you’ve shared.
          </p>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-bloom-500 bg-bloom-100 text-bloom-700'
                    : 'border-bloom-200 text-bloom-ink/65 hover:bg-bloom-100'
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-xs text-bloom-ink/40">{counts[t.id]}</span>
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-5 rounded-xl bg-bloom-clay/[0.08] px-4 py-3 text-sm text-bloom-clay ring-1 ring-bloom-clay/20">
              {error}
            </p>
          )}

          <div className="mt-5">
            {!inbox && !error && <ListSkeleton />}

            {inbox && inbox.length === 0 && (
              <EmptyState message="No responses yet. Share a design and your client’s reply will land here." />
            )}

            {inbox && inbox.length > 0 && visible.length === 0 && (
              <EmptyState
                message={
                  tab === 'approved'
                    ? 'No approved designs yet.'
                    : 'Nothing waiting on changes — nice.'
                }
              />
            )}

            {visible.length > 0 && (
              <ul className="space-y-3">
                {visible.map((item) => (
                  <ResponseCard
                    key={item.id}
                    item={item}
                    busy={busy.has(item.id)}
                    onOpen={() => item.design && navigate(`/design/${item.design.id}`)}
                    onResolve={(resolved) => void onResolve(item, resolved)}
                    onDelete={() => onDelete(item)}
                  />
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function ResponseCard({
  item,
  busy,
  onOpen,
  onResolve,
  onDelete,
}: {
  item: FeedbackInboxItem
  busy: boolean
  onOpen: () => void
  onResolve: (resolved: boolean) => void
  onDelete: () => void
}) {
  const approved = item.verdict === 'approved'
  const resolved = !!item.resolved_at
  const when = new Date(item.created_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <li
      className={`flex flex-col gap-3 rounded-xl border bg-white p-3 sm:flex-row ${
        resolved ? 'border-bloom-200 opacity-70' : 'border-bloom-200'
      }`}
    >
      <button
        onClick={onOpen}
        className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-bloom-100 sm:h-20 sm:w-28"
        aria-label={item.design ? `Open ${item.design.name}` : 'Open design'}
      >
        {item.design?.thumbnail_url ? (
          <img src={item.design.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl text-bloom-ink/20">❧</span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`chip ${approved ? 'bg-bloom-100 text-bloom-700' : 'bg-orange-50 text-bloom-clay'}`}>
            {approved ? 'Approved' : 'Changes requested'}
          </span>
          {resolved && <span className="chip bg-bloom-100 text-bloom-ink/60">Done</span>}
          <button
            onClick={onOpen}
            className="min-w-0 truncate text-sm font-medium text-bloom-ink hover:underline"
          >
            {item.design?.name ?? 'Untitled design'}
          </button>
          <span className="ml-auto shrink-0 text-xs text-bloom-ink/40">{when}</span>
        </div>

        {item.note && <p className="mt-1.5 text-sm text-bloom-ink/80">{item.note}</p>}
        {item.reviewer_name && (
          <p className="mt-0.5 text-xs text-bloom-ink/45">— {item.reviewer_name}</p>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          {resolved ? (
            <button
              onClick={() => onResolve(false)}
              disabled={busy}
              className="rounded-lg border border-bloom-200 px-2.5 py-1 text-xs font-medium text-bloom-ink/70 transition-colors hover:bg-bloom-100 disabled:opacity-50"
            >
              Reopen
            </button>
          ) : (
            <button
              onClick={() => onResolve(true)}
              disabled={busy}
              className="rounded-lg bg-bloom-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-bloom-700 disabled:opacity-50"
            >
              Done
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-red-700/70 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

function ListSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-bloom-200 bg-white p-3">
          <div className="h-20 w-28 shrink-0 animate-pulse rounded-lg bg-bloom-100" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 w-1/3 animate-pulse rounded bg-bloom-100" />
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-bloom-100" />
            <div className="h-2.5 w-1/4 animate-pulse rounded bg-bloom-100" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-bloom-200 bg-white px-6 py-14 text-center text-sm text-bloom-ink/55">
      {message}
    </div>
  )
}
