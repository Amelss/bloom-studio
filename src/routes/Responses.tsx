import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppSidebar, MobileTopBar } from '../components/AppSidebar'
import { listReviewBoard, setDesignReviewStatus } from '../lib/shareApi'
import type { ReviewBoardItem, ReviewStatus } from '../lib/types'

type Tab = 'new' | 'in_review' | 'approved' | 'completed'

const TABS: { id: Tab; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'in_review', label: 'In Review' },
  { id: 'approved', label: 'Approved' },
  { id: 'completed', label: 'Completed' },
]

/**
 * The status chip reflects where the card sits: in New it shows the client's
 * verdict (Approved / Changes requested); in the workflow tabs it shows the
 * stage itself (In review / Approved / Completed).
 */
function statusChip(tab: Tab, item: ReviewBoardItem): { label: string; className: string } | null {
  if (tab === 'in_review') return { label: 'In review', className: 'bg-amber-50 text-amber-700' }
  if (tab === 'completed') return { label: 'Completed', className: 'bg-bloom-ink/[0.06] text-bloom-ink/60' }
  if (tab === 'approved') return { label: 'Approved', className: 'bg-bloom-100 text-bloom-700' }
  // New tab — reflect the reply itself.
  if (!item.latest) return null
  return item.latest.verdict === 'approved'
    ? { label: 'Approved', className: 'bg-bloom-100 text-bloom-700' }
    : { label: 'Changes requested', className: 'bg-orange-50 text-bloom-clay' }
}

/** Which tabs a board item belongs to (an approved-new design shows in two). */
function tabsFor(item: ReviewBoardItem): Tab[] {
  const tabs: Tab[] = []
  const approved = item.latest?.verdict === 'approved'
  if (item.review_status === 'new') tabs.push('new')
  if (item.review_status === 'in_review') tabs.push('in_review')
  if (approved && (item.review_status === 'new' || item.review_status === 'read')) tabs.push('approved')
  if (item.review_status === 'completed') tabs.push('completed')
  return tabs
}

/**
 * The review board: designs move New → In Review → Approved → Completed. A
 * design lands in New on any client reply; change requests go to In Review once
 * addressed, approvals are read and then completed. Reached from the sidebar.
 */
export default function Responses() {
  const navigate = useNavigate()
  const [board, setBoard] = useState<ReviewBoardItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('new')
  const [busy, setBusy] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    listReviewBoard()
      .then((b) => active && setBoard(b))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load responses.'))
    return () => {
      active = false
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { new: 0, in_review: 0, approved: 0, completed: 0 }
    for (const item of board ?? []) for (const t of tabsFor(item)) c[t] += 1
    return c
  }, [board])

  const visible = useMemo(
    () => (board ?? []).filter((item) => tabsFor(item).includes(tab)),
    [board, tab],
  )

  const setStatus = (item: ReviewBoardItem, status: ReviewStatus) => {
    setBusy((b) => new Set(b).add(item.id))
    void setDesignReviewStatus(item.id, status)
      .then(() =>
        setBoard((cur) =>
          (cur ?? []).map((d) => (d.id === item.id ? { ...d, review_status: status } : d)),
        ),
      )
      .catch((e) => setError(e instanceof Error ? e.message : 'That didn’t work — please try again.'))
      .finally(() =>
        setBusy((b) => {
          const next = new Set(b)
          next.delete(item.id)
          return next
        }),
      )
  }

  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="responses" unread={counts.new} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />

        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-bloom-ink sm:text-3xl">
            Client responses
          </h1>
          <p className="mt-1 text-[15px] text-bloom-ink/55">
            Track each shared design from first reply through to completed.
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
            {!board && !error && <ListSkeleton />}

            {board && board.length === 0 && (
              <EmptyState message="No responses yet. Share a design and your client’s reply will land here." />
            )}

            {board && board.length > 0 && visible.length === 0 && (
              <EmptyState message={EMPTY_BY_TAB[tab]} />
            )}

            {visible.length > 0 && (
              <ul className="space-y-3">
                {visible.map((item) => (
                  <BoardCard
                    key={item.id}
                    item={item}
                    tab={tab}
                    busy={busy.has(item.id)}
                    onOpen={() => navigate(`/design/${item.id}`)}
                    onSetStatus={(status) => setStatus(item, status)}
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

const EMPTY_BY_TAB: Record<Tab, string> = {
  new: 'Nothing new — you’re all caught up.',
  in_review: 'Nothing in review right now.',
  approved: 'No approved designs yet.',
  completed: 'No completed designs yet.',
}

function BoardCard({
  item,
  tab,
  busy,
  onOpen,
  onSetStatus,
}: {
  item: ReviewBoardItem
  tab: Tab
  busy: boolean
  onOpen: () => void
  onSetStatus: (status: ReviewStatus) => void
}) {
  const chip = statusChip(tab, item)
  const when = item.latest
    ? new Date(item.latest.created_at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-bloom-200 bg-white p-3 sm:flex-row">
      <button
        onClick={onOpen}
        className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-bloom-100 sm:h-20 sm:w-28"
        aria-label={`Open ${item.name}`}
      >
        {item.thumbnail_url ? (
          <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl text-bloom-ink/20">❧</span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {chip && <span className={`chip ${chip.className}`}>{chip.label}</span>}
          <button onClick={onOpen} className="min-w-0 truncate text-sm font-medium text-bloom-ink hover:underline">
            {item.name}
          </button>
          {when && <span className="ml-auto shrink-0 text-xs text-bloom-ink/40">{when}</span>}
        </div>

        {item.latest?.note && <p className="mt-1.5 text-sm text-bloom-ink/80">{item.latest.note}</p>}
        {item.latest?.reviewer_name && (
          <p className="mt-0.5 text-xs text-bloom-ink/45">— {item.latest.reviewer_name}</p>
        )}

        <CardActions item={item} tab={tab} busy={busy} onSetStatus={onSetStatus} />
      </div>
    </li>
  )
}

/** The action buttons depend on which tab the card is shown in. */
function CardActions({
  item,
  tab,
  busy,
  onSetStatus,
}: {
  item: ReviewBoardItem
  tab: Tab
  busy: boolean
  onSetStatus: (status: ReviewStatus) => void
}) {
  const primary = 'rounded-lg bg-bloom-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-bloom-700 disabled:opacity-50'
  const secondary = 'rounded-lg border border-bloom-200 px-2.5 py-1 text-xs font-medium text-bloom-ink/70 transition-colors hover:bg-bloom-100 disabled:opacity-50'

  if (tab === 'new') {
    const approved = item.latest?.verdict === 'approved'
    return (
      <div className="mt-2.5">
        {approved ? (
          <button onClick={() => onSetStatus('read')} disabled={busy} className={secondary}>
            Mark as read
          </button>
        ) : (
          <button onClick={() => onSetStatus('in_review')} disabled={busy} className={primary}>
            Mark as reviewed
          </button>
        )}
      </div>
    )
  }

  if (tab === 'approved') {
    return (
      <div className="mt-2.5">
        <button onClick={() => onSetStatus('completed')} disabled={busy} className={primary}>
          Completed
        </button>
      </div>
    )
  }

  return null
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
