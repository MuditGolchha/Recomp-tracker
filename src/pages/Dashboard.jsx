import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { USER_DEFAULTS } from '../lib/constants'
import MacroRing from '../components/MacroRing'
import { format, differenceInDays, parseISO } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area,
} from 'recharts'
import { Target, Flame, Zap, Moon, Dumbbell, TrendingDown, Calendar } from 'lucide-react'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [todayFood, setTodayFood] = useState([])
  const [weightData, setWeightData] = useState([])
  const [proteinData, setProteinData] = useState([])
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [lastSleep, setLastSleep] = useState(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  const targets = {
    calories: profile?.target_calories || USER_DEFAULTS.target_calories,
    protein: profile?.target_protein_g || USER_DEFAULTS.target_protein_g,
    carbs: profile?.target_carbs_g || USER_DEFAULTS.target_carbs_g,
    fat: profile?.target_fat_g || USER_DEFAULTS.target_fat_g,
  }

  const daysLeft = differenceInDays(new Date('2026-06-09'), new Date())

  useEffect(() => {
    if (!user) return
    loadDashboard()
  }, [user])

  async function loadDashboard() {
    const [foodRes, weightRes, proteinRes, workoutRes, sleepRes] = await Promise.all([
      supabase.from('food_log').select('*').eq('user_id', user.id).eq('logged_at', today),
      supabase.from('weekly_progress').select('recorded_date, weight_kg').eq('user_id', user.id).order('recorded_date'),
      supabase.from('food_log').select('logged_at, protein_g').eq('user_id', user.id).gte('logged_at', format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd')),
      supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('workout_date', { ascending: false }).limit(5),
      supabase.from('sleep_log').select('*').eq('user_id', user.id).order('sleep_date', { ascending: false }).limit(1),
    ])

    setTodayFood(foodRes.data || [])
    setWeightData((weightRes.data || []).map(d => ({
      date: format(parseISO(d.recorded_date), 'MMM d'),
      weight: Number(d.weight_kg),
    })))

    // Aggregate protein by day
    const proteinByDay = {}
    ;(proteinRes.data || []).forEach(f => {
      const day = f.logged_at
      proteinByDay[day] = (proteinByDay[day] || 0) + Number(f.protein_g)
    })
    setProteinData(Object.entries(proteinByDay).map(([date, protein]) => ({
      date: format(parseISO(date), 'MMM d'),
      protein: Math.round(protein),
      target: targets.protein,
    })))

    setRecentWorkouts(workoutRes.data || [])
    setLastSleep(sleepRes.data?.[0] || null)
  }

  const totals = todayFood.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein_g),
    carbs: acc.carbs + Number(f.carbs_g),
    fat: acc.fat + Number(f.fat_g),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Hey {profile?.full_name || 'Mudit'} 👋
          </h1>
          <p className="text-gray-400 mt-1">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center gap-2 px-4 py-2 bg-emerald-500/10 rounded-full border border-emerald-500/20">
          <Target className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-400 font-medium">{daysLeft} days to goal</span>
        </div>
      </div>

      {/* Today's Macros */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          Today's Nutrition
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 justify-items-center">
          <MacroRing label="Calories" current={totals.calories} target={targets.calories} color="#10b981" unit="kcal" />
          <MacroRing label="Protein" current={totals.protein} target={targets.protein} color="#3b82f6" />
          <MacroRing label="Carbs" current={totals.carbs} target={targets.carbs} color="#f59e0b" />
          <MacroRing label="Fat" current={totals.fat} target={targets.fat} color="#ef4444" />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weight Trend */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-blue-400" />
            Weight Trend
          </h2>
          {weightData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={weightData}>
                <defs>
                  <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Area type="monotone" dataKey="weight" stroke="#3b82f6" fill="url(#weightGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600">
              No weight data yet. Log your first weigh-in under Progress.
            </div>
          )}
        </div>

        {/* Protein Consistency */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Protein (Last 30 Days)
          </h2>
          {proteinData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={proteinData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="protein" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="target" stroke="#ef4444" strokeDasharray="5 5" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600">
              No nutrition data yet. Start logging meals!
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Recent Workouts */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Dumbbell className="w-4 h-4" />
            Recent Workouts
          </h3>
          {recentWorkouts.length > 0 ? (
            <div className="space-y-2">
              {recentWorkouts.slice(0, 3).map(w => (
                <div key={w.id} className="flex justify-between items-center">
                  <span className="text-sm text-white">{w.name || 'Workout'}</span>
                  <span className="text-xs text-gray-500">{format(parseISO(w.workout_date), 'MMM d')}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No workouts logged yet</p>
          )}
        </div>

        {/* Last Sleep */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Moon className="w-4 h-4" />
            Last Night's Sleep
          </h3>
          {lastSleep ? (
            <div>
              <div className="text-2xl font-bold text-white">{lastSleep.duration_hours}h</div>
              <div className="text-sm text-gray-500">
                Quality: {'⭐'.repeat(lastSleep.quality || 0)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No sleep data yet</p>
          )}
        </div>

        {/* Countdown */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Deadline
          </h3>
          <div className="text-2xl font-bold text-emerald-400">{daysLeft}</div>
          <div className="text-sm text-gray-500">days until June 9</div>
          <div className="mt-2 w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(((61 - daysLeft) / 61) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
