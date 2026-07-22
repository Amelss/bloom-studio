import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../domain/auth'
import { AuthLoading } from '../components/auth/ProtectedRoute'

/**
 * OAuth return target. The Supabase client (detectSessionInUrl + PKCE) exchanges
 * the code automatically on load; we just wait for the session to appear, then
 * route into the app — with a short fallback to /login if it never does.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
      return
    }
    const t = setTimeout(() => {
      if (!useAuth.getState().user) navigate('/login', { replace: true })
    }, 4000)
    return () => clearTimeout(t)
  }, [user, navigate])

  return <AuthLoading />
}
