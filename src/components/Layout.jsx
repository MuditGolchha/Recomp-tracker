import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Utensils,
  Dumbbell,
  Moon,
  TrendingUp,
  Users,
  LogOut,
  Menu,
  X,
  Target,
} from 'lucide-react'
import { useState } from 'react'

const icons = { LayoutDashboard, Utensils, Dumbbell, Moon, TrendingUp, Users }

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/nutrition', label: 'Nutrition', icon: 'Utensils' },
  { path: '/gym', label: 'Gym', icon: 'Dumbbell' },
  { path: '/sleep', label: 'Sleep', icon: 'Moon' },
  { path: '/progress', label: 'Progress', icon: 'TrendingUp' },
  { path: '/coach-dashboard', label: 'Coach', icon: 'Users' },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6 text-emerald-400" />
          <span className="font-bold text-lg">RecompTracker</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-gray-900 border-r border-gray-800
          transform transition-transform lg:transform-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-6 hidden lg:block">
            <div className="flex items-center gap-2">
              <Target className="w-7 h-7 text-emerald-400" />
              <span className="font-bold text-xl">RecompTracker</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Abs by June 9 🎯</p>
          </div>

          <nav className="px-3 mt-4 lg:mt-0">
            {navItems.map(({ path, label, icon }) => {
              const Icon = icons[icon]
              return (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors text-sm font-medium
                    ${isActive
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </NavLink>
              )
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 mb-2">{user?.email}</div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen lg:ml-0">
          <div className="max-w-6xl mx-auto p-4 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
