import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStudio } from '../domain/store'
import { FLOWER_CATALOG } from '../data/catalog'
import type { GridStepMm } from '../domain/store'

/**
 * The primary tool rail — a compact vertical icon toolbar on the left, in the
 * mould of Illustrator / Figma / Affinity. Cursor tools sit at the top;
 * selection actions (transform, arrange, group, duplicate, delete) in the
 * middle, disabled until something is selected; view controls at the bottom.
 * Tools with variations open a labelled fly-out to the right, so one icon
 * carries a family of related commands and the rail stays short as we grow.
 */

/* ------------------------------- icons -------------------------------- */

type IconProps = { className?: string }
const svg = (children: ReactNode) => (p: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
    aria-hidden
  >
    {children}
  </svg>
)

const IconSelect = svg(<path d="M5 3l6 15 2.2-6.2L19.5 9.5 5 3z" />)
const IconHand = svg(
  <>
    <path d="M8 11V5.5a1.5 1.5 0 013 0V11" />
    <path d="M11 11V4.5a1.5 1.5 0 013 0V11" />
    <path d="M14 11V6a1.5 1.5 0 013 0v6.5c0 4-2.5 7.5-6.5 7.5S6 17.5 6 14.5V12a1.5 1.5 0 013 0" />
  </>,
)
const IconTransform = svg(
  <>
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 3v6h-6" />
  </>,
)
const IconArrange = svg(
  <>
    <path d="M12 3l8 4-8 4-8-4 8-4z" />
    <path d="M4 12l8 4 8-4" />
    <path d="M4 16.5l8 4 8-4" opacity="0.5" />
  </>,
)
const IconGroup = svg(
  <>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="13" width="7" height="7" rx="1" />
    <path d="M13 7h4M7 13v4" opacity="0.6" />
  </>,
)
const IconDuplicate = svg(
  <>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 4H6a2 2 0 00-2 2v10" />
  </>,
)
const IconTrash = svg(
  <>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
    <path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
  </>,
)
const IconBrush = svg(
  <>
    <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
    <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
  </>,
)
const IconGrid = svg(
  <>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M9 4v16M15 4v16M4 9h16M4 15h16" opacity="0.7" />
  </>,
)
const IconGuides = svg(
  <>
    <circle cx="12" cy="12" r="8" strokeDasharray="3 3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </>,
)
/* --------------------------- building blocks --------------------------- */

interface FlyItem {
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

/** A rail button: runs `onClick` directly, or opens `flyout` to the side. */
function Tool({
  icon: Icon,
  label,
  hint,
  active,
  disabled,
  hasFlyout,
  isOpen,
  onClick,
  children,
}: {
  icon: (p: IconProps) => ReactNode
  label: string
  /** Why the tool is unavailable — shown in the tooltip when disabled. */
  hint?: string
  active?: boolean
  disabled?: boolean
  hasFlyout?: boolean
  isOpen?: boolean
  onClick: () => void
  children?: ReactNode
}) {
  const tip = disabled && hint ? `${label} — ${hint}` : label
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={tip}
        aria-disabled={disabled}
        aria-pressed={active}
        aria-haspopup={hasFlyout || undefined}
        aria-expanded={hasFlyout ? isOpen : undefined}
        disabled={disabled}
        onClick={onClick}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
          active
            ? 'bg-bloom-600 text-white'
            : 'text-bloom-ink/75 hover:bg-bloom-100 hover:text-bloom-ink'
        } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
      >
        <Icon />
        {hasFlyout && (
          <span className="absolute bottom-0.5 right-0.5 h-1 w-1 rounded-sm bg-current opacity-40" aria-hidden />
        )}
      </button>
      {/* Hover tooltip — named to the right of the rail, hidden while the
          fly-out is open so the two never overlap. */}
      {!isOpen && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-[60] hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-bloom-ink px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block"
        >
          {tip}
        </span>
      )}
      {isOpen && children}
    </div>
  )
}

/** A labelled fly-out panel opening to the right of its tool. */
function Flyout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      role="menu"
      aria-label={title}
      className="absolute left-[calc(100%+8px)] top-0 z-50 min-w-[13rem] rounded-xl border border-bloom-200 bg-white p-1.5 shadow-xl"
    >
      <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-bloom-ink/40">
        {title}
      </p>
      {children}
    </div>
  )
}

function FlyRow({ label, shortcut, onClick, active, disabled }: FlyItem) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        active ? 'bg-bloom-100 font-medium text-bloom-700' : 'hover:bg-bloom-100'
      } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent`}
    >
      <span>{label}</span>
      {shortcut && <kbd className="text-[10px] tabular-nums text-bloom-ink/40">{shortcut}</kbd>}
    </button>
  )
}

function Divider() {
  return <div className="my-1 h-px w-6 self-center bg-bloom-200" aria-hidden />
}

const GRID_STEPS: GridStepMm[] = [5, 10, 25, 50]

/* -------------------------------- toolbar ------------------------------- */

export function Toolbar() {
  const [open, setOpen] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const tool = useStudio((s) => s.tool)
  const setTool = useStudio((s) => s.setTool)
  const brush = useStudio((s) => s.brush)
  const setBrush = useStudio((s) => s.setBrush)

  const selectedIds = useStudio((s) => s.selectedIds)
  const stems = useStudio((s) => s.doc.stems)
  const selected = stems.filter((st) => selectedIds.includes(st.id))
  const hasSelection = selected.length > 0
  const canGroup =
    selected.length >= 2 && !(selected[0].clusterId && selected.every((st) => st.clusterId === selected[0].clusterId))
  const anyClustered = selected.some((st) => st.clusterId)

  const rotateSelected = useStudio((s) => s.rotateSelected)
  const flipSelected = useStudio((s) => s.flipSelected)
  const scaleSelected = useStudio((s) => s.scaleSelected)
  const layerSelected = useStudio((s) => s.layerSelected)
  const bandSelected = useStudio((s) => s.bandSelected)
  const duplicateSelected = useStudio((s) => s.duplicateSelected)
  const removeSelected = useStudio((s) => s.removeSelected)
  const groupSelected = useStudio((s) => s.groupSelected)
  const ungroupSelected = useStudio((s) => s.ungroupSelected)

  const learningMode = useStudio((s) => s.learningMode)
  const gridVisible = useStudio((s) => s.gridVisible)
  const setGridVisible = useStudio((s) => s.setGridVisible)
  const gridSnap = useStudio((s) => s.gridSnap)
  const setGridSnap = useStudio((s) => s.setGridSnap)
  const gridStepMm = useStudio((s) => s.gridStepMm)
  const setGridStepMm = useStudio((s) => s.setGridStepMm)
  const showFormGuide = useStudio((s) => s.showFormGuide)
  const setShowFormGuide = useStudio((s) => s.setShowFormGuide)
  const balanceVisible = useStudio((s) => s.balanceVisible)
  const setBalanceVisible = useStudio((s) => s.setBalanceVisible)
  const tiltEnabled = useStudio((s) => s.tiltEnabled)
  const setTiltEnabled = useStudio((s) => s.setTiltEnabled)

  // Close the open fly-out on Escape or a click outside the rail.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id))
  // Run a selection action and close the fly-out.
  const run = (fn: () => void) => () => {
    fn()
    setOpen(null)
  }

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Tools"
      className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-bloom-200 bg-white/80 py-2"
    >
      {/* Cursor tools */}
      <Tool icon={IconSelect} label="Select tool (V)" active={tool === 'select' && !brush} onClick={() => setTool('select')} />
      <Tool icon={IconHand} label="Pan tool (H)" active={tool === 'pan'} onClick={() => setTool('pan')} />

      <Divider />

      {/* Transform */}
      <Tool
        icon={IconTransform}
        label="Transform"
        hint="select a flower first"
        hasFlyout
        disabled={!hasSelection}
        isOpen={open === 'transform'}
        onClick={() => toggle('transform')}
      >
        <Flyout title="Transform">
          <FlyRow label="Rotate left 15°" shortcut="⇧R" onClick={run(() => rotateSelected(-15))} />
          <FlyRow label="Rotate right 15°" shortcut="R" onClick={run(() => rotateSelected(15))} />
          <FlyRow label="Flip horizontal" shortcut="F" onClick={run(flipSelected)} />
          <FlyRow label="Enlarge 5%" shortcut="" onClick={run(() => scaleSelected(0.05))} />
          <FlyRow label="Shrink 5%" shortcut="" onClick={run(() => scaleSelected(-0.05))} />
        </Flyout>
      </Tool>

      {/* Arrange (depth) */}
      <Tool
        icon={IconArrange}
        label="Arrange"
        hint="select a flower first"
        hasFlyout
        disabled={!hasSelection}
        isOpen={open === 'arrange'}
        onClick={() => toggle('arrange')}
      >
        <Flyout title="Arrange (depth)">
          <FlyRow label="Bring forward" shortcut="]" onClick={run(() => layerSelected('forward'))} />
          <FlyRow label="Send backward" shortcut="[" onClick={run(() => layerSelected('backward'))} />
          <FlyRow label="Move up a band" shortcut="⌘]" onClick={run(() => bandSelected('forward'))} />
          <FlyRow label="Move down a band" shortcut="⌘[" onClick={run(() => bandSelected('backward'))} />
        </Flyout>
      </Tool>

      {/* Group */}
      <Tool
        icon={IconGroup}
        label="Cluster"
        hint="select two or more flowers"
        hasFlyout
        disabled={!canGroup && !anyClustered}
        isOpen={open === 'group'}
        onClick={() => toggle('group')}
      >
        <Flyout title="Cluster">
          <FlyRow label="Cluster selection" shortcut="⌘G" disabled={!canGroup} onClick={run(groupSelected)} />
          <FlyRow label="Uncluster" shortcut="⇧⌘G" disabled={!anyClustered} onClick={run(ungroupSelected)} />
        </Flyout>
      </Tool>

      <Tool icon={IconDuplicate} label="Duplicate (⌘D)" hint="select a flower first" disabled={!hasSelection} onClick={run(duplicateSelected)} />
      <Tool icon={IconTrash} label="Delete (⌫)" hint="select a flower first" disabled={!hasSelection} onClick={run(removeSelected)} />

      <Divider />

      {/* Filler brush */}
      <Tool
        icon={IconBrush}
        label={brush ? 'Filler brush — click to stop painting' : 'Filler brush'}
        hasFlyout
        active={!!brush}
        isOpen={open === 'brush'}
        onClick={() => (brush ? setBrush(null) : toggle('brush'))}
      >
        <Flyout title="Filler brush — paint a stroke">
          <div className="max-h-64 overflow-y-auto">
            {brush && (
              <FlyRow label="Stop painting" shortcut="Esc" active onClick={run(() => setBrush(null))} />
            )}
            {FLOWER_CATALOG.map((f) => (
              <FlyRow
                key={f.id}
                label={f.commonName}
                active={brush?.varietyId === f.id}
                onClick={run(() => setBrush({ varietyId: f.id, colorwayId: f.colorways[0].id }))}
              />
            ))}
          </div>
        </Flyout>
      </Tool>

      <Divider />

      {/* View controls */}
      <Tool
        icon={IconGrid}
        label="Grid & snapping"
        hasFlyout
        active={gridVisible || gridSnap}
        isOpen={open === 'grid'}
        onClick={() => toggle('grid')}
      >
        <Flyout title="Grid & snapping">
          <FlyRow label="Show grid" shortcut="⇧'" active={gridVisible} onClick={() => setGridVisible(!gridVisible)} />
          <FlyRow label="Snap to grid" active={gridSnap} onClick={() => setGridSnap(!gridSnap)} />
          <div className="mt-1 flex items-center justify-between gap-2 px-2.5 py-1 text-sm">
            <span>Grid size</span>
            <select
              className="rounded-lg border border-bloom-200 bg-white px-1.5 py-1 text-xs"
              value={gridStepMm}
              onChange={(e) => setGridStepMm(Number(e.target.value) as GridStepMm)}
              aria-label="Grid size"
            >
              {GRID_STEPS.map((step) => (
                <option key={step} value={step}>
                  {step} mm
                </option>
              ))}
            </select>
          </div>
        </Flyout>
      </Tool>

      <Tool
        icon={IconGuides}
        label="Learning overlays"
        hint="turn on Learning mode"
        hasFlyout
        disabled={!learningMode}
        active={learningMode && (showFormGuide || balanceVisible || tiltEnabled)}
        isOpen={open === 'guides'}
        onClick={() => toggle('guides')}
      >
        <Flyout title="Learning overlays">
          <FlyRow label="Form guide" active={showFormGuide} onClick={() => setShowFormGuide(!showFormGuide)} />
          <FlyRow label="Balance point" active={balanceVisible} onClick={() => setBalanceVisible(!balanceVisible)} />
          <FlyRow label="Depth tilt" active={tiltEnabled} onClick={() => setTiltEnabled(!tiltEnabled)} />
        </Flyout>
      </Tool>
    </div>
  )
}
