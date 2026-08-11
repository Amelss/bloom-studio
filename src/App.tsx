import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, ClassroomRoute } from './components/auth/ProtectedRoute'
import Login from './routes/Login'
import SignUp from './routes/SignUp'
import AuthCallback from './routes/AuthCallback'
import Dashboard from './routes/Dashboard'
import Account from './routes/Account'
import Onboarding from './routes/Onboarding'
import Editor from './routes/Editor'
import Designs from './routes/Designs'
import Progress from './routes/Progress'
import Classroom from './routes/Classroom'
import Course from './routes/Course'
import CreateAssignment from './routes/CreateAssignment'
import CourseAssignments from './routes/CourseAssignments'
import CourseSubmissions from './routes/CourseSubmissions'
import CourseStudents from './routes/CourseStudents'
import CourseInsights from './routes/CourseInsights'
import Assignment from './routes/Assignment'
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
        <Route path="/designs" element={<Designs />} />
        {/* Course/tracking layer — student/educator/admin only. */}
        <Route element={<ClassroomRoute />}>
          <Route path="/progress" element={<Progress />} />
          <Route path="/classroom" element={<Classroom />} />
          <Route path="/classroom/:courseId" element={<Course />} />
          <Route path="/classroom/:courseId/new" element={<CreateAssignment />} />
          <Route path="/classroom/:courseId/assignments" element={<CourseAssignments />} />
          <Route path="/classroom/:courseId/submissions" element={<CourseSubmissions />} />
          <Route path="/classroom/:courseId/students" element={<CourseStudents />} />
          <Route path="/classroom/:courseId/insights" element={<CourseInsights />} />
          <Route path="/classroom/:courseId/a/:assignmentId" element={<Assignment />} />
        </Route>
        <Route path="/responses" element={<Responses />} />
        <Route path="/account" element={<Account />} />
        <Route path="/design/:id" element={<Editor />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
