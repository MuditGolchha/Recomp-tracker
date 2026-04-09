import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import AuthForm from './components/AuthForm'
import Dashboard from './pages/Dashboard'
import Nutrition from './pages/Nutrition'
import Gym from './pages/Gym'
import Sleep from './pages/Sleep'
import Progress from './pages/Progress'
import TrainerView from './pages/TrainerView'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }
  return user ? children : <Navigate to="/login" />
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <AuthForm />} />
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
