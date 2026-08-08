import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import Login from './routes/Login'
import SignUp from './routes/SignUp'
import AuthCallback from './routes/AuthCallback'
import Dashboard from './routes/Dashboard'
import Account from './routes/Account'
import Onboarding from './routes/Onboarding'
import Editor from './routes/Editor'
import Responses from './routes/Responses'
import SharedDesign from './routes/SharedDesign'

/** Route table. Public auth screens + protected app (dashboard + editor). */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      {/* Public read-only share link — no account required. */}
      <Route path="/s/:token" element={<SharedDesign />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/welcome" element={<Onboarding />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/responses" element={<Responses />} />
        <Route path="/account" element={<Account />} />
        <Route path="/design/:id" element={<Editor />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
