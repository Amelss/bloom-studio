import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { blankDocument } from '../domain/templates'
import { createDesign } from '../lib/designsApi'
import { countNewSubmissions, listMyAssignments, listMySubmissions } from '../lib/classroomApi'
import { countStudentNotifications } from '../lib/classroomSeen'
import { useAuth } from '../domain/auth'
import { UserMenu } from './auth/UserMenu'

/** The Florafo mark: a styled serif "F" (Fraunces), inheriting its colour. */
export function FlorafoGlyph({ className }: { className?: string }) {
  return (
    <span className={`font-brand font-semibold leading-none ${className ?? ''}`} aria-hidden>
      F
    </span>
  )
}

export function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bloom-700 text-white">
      <FlorafoGlyph className="text-[20px]" />
    </span>
  )
}

/** The desktop navigation rail, shared across the dashboard and its sub-pages. */
export function AppSidebar({
  active,
  unread = 0,
}: {
  active: 'recent' | 'designs' | 'progress' | 'classroom' | 'responses'
  unread?: number
}) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  // Classroom badge: educators see submissions awaiting review; students see
  // new (unseen) assignments + newly graded results. Recomputes on navigation
  // (the sidebar remounts), so viewing an item clears it on the next page.
  const role = useAuth((s) => s.profile?.role)
  const isEducator = role === 'educator' || role === 'admin'
  // Progress + Classroom are the course/tracking layer: student/educator/admin
  // only. Professionals (any experience level) don't get them.
  const hasClassroom = role === 'student' || role === 'educator' || role === 'admin'
  const [classroomBadge, setClassroomBadge] = useState(0)
  useEffect(() => {
    if (!hasClassroom) {
      setClassroomBadge(0)
      return
    }
    let active = true
    if (isEducator) {
      countNewSubmissions()
        .then((n) => active && setClassroomBadge(n))
        .catch(() => {})
    } else {
      Promise.all([listMyAssignments(), listMySubmissions()])
        .then(([assignments, submissions]) => {
          if (!active) return
          const { total } = countStudentNotifications(
            assignments.map((a) => a.id),
            submissions,
          )
          setClassroomBadge(total)
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [role, isEducator, hasClassroom])

  const newDesign = async () => {
    setCreating(true)
    try {
      const doc = blankDocument('Hand-tied bouquet')
      doc.vesselId = 'kraft-wrap'
      const id = await createDesign(doc.name, doc)
      navigate(`/design/${id}`)
    } catch {
      setCreating(false)
    }
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-bloom-200 bg-white/70 px-4 py-5 md:flex">
      <Link to="/" className="flex items-center gap-2 px-2">
        <BrandMark />
        <span className="font-brand text-lg font-semibold tracking-tight text-bloom-700">
          Florafo
        </span>
      </Link>

      <button
        onClick={() => void newDesign()}
        disabled={creating}
        className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-bloom-600 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-bloom-700 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New design
      </button>

      <nav className="mt-6 flex flex-col gap-0.5">
        <NavItem to="/" active={active === 'recent'} icon={<path d="M12 8v4l3 2M12 4a8 8 0 100 16 8 8 0 000-16z" />}>
          Recent
        </NavItem>
        <NavItem to="/designs" active={active === 'designs'} icon={<path d="M4 10.5 12 4l8 6.5M6 9v10a1 1 0 001 1h10a1 1 0 001-1V9" />}>
          My designs
        </NavItem>
        {/* Course/tracking layer — student/educator/admin only. */}
        {hasClassroom && (
          <>
            <NavItem to="/progress" active={active === 'progress'} icon={<path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" />}>
              Progress
            </NavItem>
            <NavItem to="/classroom" active={active === 'classroom'} badge={classroomBadge} icon={<path d="M3 7l9-4 9 4-9 4-9-4zM7 10v5c0 1 2 2 5 2s5-1 5-2v-5" />}>
              Classroom
            </NavItem>
          </>
        )}
        <NavItem to="/responses" active={active === 'responses'} badge={unread} icon={<path d="M4 5h16v11H8l-4 4V5z" />}>
          Responses
        </NavItem>
      </nav>

      <div className="mt-auto border-t border-bloom-200 pt-3">
        <UserMenu direction="up" />
      </div>
    </aside>
  )
}

function NavItem({
  children,
  icon,
  active,
  to,
  onClick,
  badge,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  active?: boolean
  to?: string
  onClick?: () => void
  badge?: number
}) {
  const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
    active
      ? 'bg-bloom-600/10 font-semibold text-bloom-700'
      : 'font-medium text-bloom-ink/60 hover:bg-bloom-ink/[0.05] hover:text-bloom-ink'
  }`
  const inner = (
    <>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      <span className="flex-1">{children}</span>
      {badge != null && badge > 0 && (
        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-bloom-600 px-1.5 text-[11px] font-semibold text-white">
          {badge}
        </span>
      )}
    </>
  )
  return to ? (
    <Link to={to} className={cls} aria-current={active ? 'page' : undefined}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/** The compact brand + account bar shown on mobile, where the sidebar is hidden. */
export function MobileTopBar() {
  return (
    <div className="flex items-center justify-between px-6 py-3 md:hidden">
      <Link to="/" className="flex items-center gap-2">
        <BrandMark />
        <span className="font-brand text-lg font-semibold tracking-tight text-bloom-700">
          Florafo
        </span>
      </Link>
      <UserMenu />
    </div>
  )
}
