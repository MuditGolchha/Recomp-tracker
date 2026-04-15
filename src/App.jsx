import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import AuthForm from './components/AuthForm'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Nutrition from './pages/Nutrition'
import Gym from './pages/Gym'
import Sleep from './pages/Sleep'
import Progress from './pages/Progress'
import TrainerView from './pages/TrainerView'
import CoachDashboard from './pages/CoachDashboard'
import MyPlan from './pages/MyPlan'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }) {
  const { user, loading, needsOnboarding } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" />
  if (needsOnboarding) return <Navigate to="/onboarding" />
  return children
}

function AppRoutes() {
  const { user, loading, needsOnboarding } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? (needsOnboarding ? <Navigate to="/onboarding" /> : <Navigate to="/" />) : <AuthForm />} />
      <Route path="/onboarding" element={user ? (needsOnboarding ? <Onboarding /> : <Navigate to="/" />) : <Navigate to="/login" />} />
      <Route path="/trainer" element={<TrainerView />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/gym" element={<Gym />} />
        <Route path="/sleep" element={<Sleep />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/share" element={<TrainerView />} />
        <Route path="/my-plan" element={<MyPlan />} />
        <Route path="/coach-dashboard" element={<CoachDashboard />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
