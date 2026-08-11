import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../domain/auth'

/** Full-screen loader shown while the first session check resolves. */
export function AuthLoading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-bloom-50">
      <div className="flex flex-col items-center gap-3 text-bloom-ink/50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-bloom-200 border-t-bloom-600" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )
}

/** Gate for authenticated routes; bounces signed-out users to /login. */
export function ProtectedRoute() {
  const loading = useAuth((s) => s.loading)
  const user = useAuth((s) => s.user)
  const profile = useAuth((s) => s.profile)
  const location = useLocation()

  if (loading) return <AuthLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // New users (typically Google) haven't picked a role yet → onboard first.
  // Only redirect once the profile has loaded, and never away from /welcome itself.
  if (profile && !profile.onboarded && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />
  }
  return <Outlet />
}

/**
 * Gate for the course/tracking layer (Progress, Classroom): student / educator /
 * admin only. Professionals (any experience level) are bounced home. Nested
 * inside ProtectedRoute, so the user is already known here; only redirect once
 * the profile has loaded so we don't bounce a real student.
 */
export function ClassroomRoute() {
  const profile = useAuth((s) => s.profile)
  const role = profile?.role
  const hasClassroom = role === 'student' || role === 'educator' || role === 'admin'
  if (profile && !hasClassroom) return <Navigate to="/" replace />
  return <Outlet />
}
