import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppSidebar, MobileTopBar } from './AppSidebar'

/** Shared frame for every course page: sidebar, mobile bar, and an optional
 *  back link (breadcrumb) above the content. */
export function ClassroomShell({
  children,
  back,
}: {
  children: ReactNode
  back?: { to: string; label: string }
}) {
  return (
    <div className="flex min-h-full bg-bloom-50 text-bloom-ink">
      <AppSidebar active="classroom" />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8 lg:px-10">
          {back && (
            <Link to={back.to} className="text-sm font-medium text-bloom-700 hover:underline">
              ← {back.label}
            </Link>
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
