import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { blankDocument } from '../domain/templates'
import { createDesign } from '../lib/designsApi'
import { UserMenu } from './auth/UserMenu'

/** The Florafo mark: a styled serif "F" (Fraunces), inheriting its colour. */
export function FlorafoGlyph({ className }: { className?: string }) {
  return (
    <span className={`font-display font-semibold leading-none ${className ?? ''}`} aria-hidden>
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
  active: 'recent' | 'designs' | 'responses'
  unread?: number
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [creating, setCreating] = useState(false)

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

  // Templates / Recent are sections on the dashboard. Scroll to them directly
  // (hopping to the dashboard first when we're on another page).
  const goToSection = (sectionId: string) => {
    const scroll = () => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (location.pathname !== '/') {
      navigate('/')
      setTimeout(scroll, 200)
    } else {
      scroll()
    }
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-bloom-200 bg-white/70 px-4 py-5 md:flex">
      <Link to="/" className="flex items-center gap-2 px-2">
        <BrandMark />
        <span className="font-display text-lg font-semibold tracking-tight text-bloom-700">
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
        <NavItem onClick={() => goToSection('start')} icon={<path d="M5 4h11a2 2 0 012 2v14l-6-3-6 3V4z" />}>
          Templates
        </NavItem>
        <NavItem to="/responses" active={active === 'responses'} badge={unread} icon={<path d="M4 5h16v11H8l-4 4V5z" />}>
          Responses
        </NavItem>
      </nav>

      <div className="mt-auto border-t border-bloom-200 pt-3">
        <UserMenu />
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
        <span className="font-display text-lg font-semibold tracking-tight text-bloom-700">
          Florafo
        </span>
      </Link>
      <UserMenu />
    </div>
  )
}
