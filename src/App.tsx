import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ParentGate } from './components/ParentGate'
import Assistant from './pages/Assistant'
import Login from './pages/Login'
import ParentAssignments from './pages/ParentAssignments'
import ParentOverview from './pages/ParentOverview'
import ParentShell from './pages/ParentShell'
import StudentHome from './pages/StudentHome'
import { AuthProvider, useAuth } from './state/auth'
import { DataProvider } from './state/data'
import { LockProvider } from './state/lock'

/** Everything behind this needs a signed-in family (or demo mode). */
function FamilyArea() {
  const { loading, signedIn } = useAuth()
  if (loading) return null
  if (!signedIn) return <Navigate to="/login" replace />
  return (
    <LockProvider>
      <DataProvider>
        <Outlet />
      </DataProvider>
    </LockProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<FamilyArea />}>
            <Route path="/" element={<StudentHome />} />
            <Route path="/parent" element={<ParentGate><ParentShell /></ParentGate>}>
              <Route index element={<ParentOverview />} />
              <Route path="assignments" element={<ParentAssignments />} />
              <Route path="assistant" element={<Assistant />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
