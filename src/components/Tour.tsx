import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useStudio } from '../domain/store'

/** Persisted flag so the first-run tour auto-starts only once per device. */
const SEEN_KEY = 'bloom-tour-seen-v1'

export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // private mode / storage disabled — the tour just won't be remembered
  }
}

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface Step {
  /** `[data-tour="…"]` anchor, or null for a centred, no-spotlight step. */
  target: string | null
  title: string
  body: string
  placement: Placement
}

const STEPS: Step[] = [
  {
    target: '[data-tour="library"]',
    title: 'Your flower library',
    body: 'Search or browse, then drag a stem onto the canvas. Foliage tucks in behind your blooms automatically.',
    placement: 'right',
  },
  {
    target: '[data-tour="toolbar"]',
    title: 'Design tools',
    body: 'Select, move, rotate, arrange, group and delete. Every tool has a shortcut — press ? any time to see them.',
    placement: 'right',
  },
  {
    target: '[data-tour="canvas"]',
    title: 'The canvas',
    body: 'Arrange your stems here. Smart guides and magnetic form guides help you build a balanced shape.',
    placement: 'top',
  },
  {
    target: '[data-tour="insights"]',
    title: 'Live recipe & costing',
    body: 'Your arrangement is priced as you build — stems, vessel, labour and VAT. Export it or share it with a client.',
    placement: 'left',
  },
  {
    target: '[data-tour="learning"]',
    title: 'Learning mode',
    body: 'Flip this on for live design feedback, a scored report card, and guided exercises as you work.',
    placement: 'bottom',
  },
]

const SPOT_PAD = 8 // breathing room around the highlighted element
const GAP = 14 // distance from the element to the tooltip card
const MARGIN = 12 // keep the card this far from the viewport edge

/**
 * The guided first-run tour: a spotlight that walks a new user through the five
 * regions of the editor. Auto-runs once (remembered per device); replayable from
 * the keyboard-shortcuts overlay. Anchored to `data-tour` attributes so it can't
 * drift out of sync with the layout — a missing anchor degrades to a centred card.
 */
export function Tour() {
  const open = useStudio((s) => s.tourOpen)
  const setOpen = useStudio((s) => s.setTourOpen)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null)

  // Auto-start once, after the editor has had a moment to lay out.
  useEffect(() => {
    if (tourSeen()) return
    const t = setTimeout(() => {
      if (!tourSeen()) {
        setStep(0)
        setOpen(true)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [setOpen])

  // Reset to the first step each time the tour opens.
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  // Track the current target's position (and the viewport), live.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      const sel = STEPS[step]?.target
      const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step])

  // Place the tooltip card relative to the target, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) return
    const card = cardRef.current
    const cw = card?.offsetWidth ?? 288
    const ch = card?.offsetHeight ?? 160
    if (!rect) {
      setCardPos({ top: (viewport.h - ch) / 2, left: (viewport.w - cw) / 2 })
      return
    }
    const { placement } = STEPS[step]
    let top: number
    let left: number
    switch (placement) {
      case 'bottom':
        top = rect.bottom + GAP
        left = rect.left + rect.width / 2 - cw / 2
        break
      case 'top':
        top = rect.top - GAP - ch
        left = rect.left + rect.width / 2 - cw / 2
        break
      case 'right':
        left = rect.right + GAP
        top = rect.top + rect.height / 2 - ch / 2
        break
      case 'left':
      default:
        left = rect.left - GAP - cw
        top = rect.top + rect.height / 2 - ch / 2
        break
    }
    top = Math.min(Math.max(top, MARGIN), viewport.h - ch - MARGIN)
    left = Math.min(Math.max(left, MARGIN), viewport.w - cw - MARGIN)
    setCardPos({ top, left })
  }, [open, step, rect, viewport])

  const finish = () => {
    markSeen()
    setOpen(false)
  }

  // Escape ends the tour; arrows page through it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        finish()
      } else if (e.key === 'ArrowRight') {
        e.stopPropagation()
        setStep((s) => Math.min(s + 1, STEPS.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation()
        setStep((s) => Math.max(s - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const spot = rect
    ? { x: rect.left - SPOT_PAD, y: rect.top - SPOT_PAD, w: rect.width + SPOT_PAD * 2, h: rect.height + SPOT_PAD * 2 }
    : null

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Editor tour">
      {/* Dimmed backdrop with a cut-out over the highlighted element. Catches
          clicks so the app underneath stays inert while the tour runs. */}
      <svg width={viewport.w} height={viewport.h} className="absolute inset-0">
        <defs>
          <mask id="tour-spot">
            <rect x={0} y={0} width={viewport.w} height={viewport.h} fill="white" />
            {spot && <rect x={spot.x} y={spot.y} width={spot.w} height={spot.h} rx={12} fill="black" />}
          </mask>
        </defs>
        <rect x={0} y={0} width={viewport.w} height={viewport.h} fill="#1c2b24" opacity={0.55} mask="url(#tour-spot)" />
        {spot && (
          <rect
            x={spot.x}
            y={spot.y}
            width={spot.w}
            height={spot.h}
            rx={12}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            opacity={0.9}
          />
        )}
      </svg>

      {/* Tooltip card */}
      <div
        ref={cardRef}
        className="absolute w-72 rounded-2xl bg-white p-4 shadow-pop ring-1 ring-bloom-ink/[0.08]"
        style={{ top: cardPos?.top ?? -9999, left: cardPos?.left ?? -9999 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bloom-600">
            Step {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={finish}
            className="text-xs font-medium text-bloom-ink/45 hover:text-bloom-ink hover:underline"
          >
            Skip
          </button>
        </div>
        <h3 className="mt-1.5 font-display text-base font-semibold text-bloom-ink">{current.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-bloom-ink/70">{current.body}</p>

        {/* Progress dots */}
        <div className="mt-3 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-5 bg-bloom-600' : 'w-1.5 bg-bloom-200'
              }`}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-bloom-ink/60 hover:bg-bloom-100 hover:text-bloom-ink disabled:opacity-0"
          >
            Back
          </button>
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="rounded-lg bg-bloom-600 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-bloom-700"
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
