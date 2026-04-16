import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO, differenceInDays } from 'date-fns'
import {
  Users, UserPlus, ArrowLeft, ChevronRight, X, CheckCircle, XCircle,
  Dumbbell, CreditCard, CalendarCheck, TrendingUp, ClipboardList,
  Bell, StickyNote, Send, Trash2, Plus, Calendar, Check, AlertTriangle,
  Clock, ChevronDown, ChevronUp, Search, Edit3, Save, Play
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import LiveCoachSession from '../components/LiveCoachSession'

export default function CoachDashboard() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [showAddClient, setShowAddClient] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const [addResult, setAddResult] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientProfile, setClientProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) loadClients()
  }, [user])

  async function loadClients() {
    const { data: links } = await supabase
      .from('coach_clients')
      .select('*')
      .eq('coach_id', user.id)
      .eq('status', 'active')
    if (!links || links.length === 0) { setClients([]); return }

    const clientIds = links.map(l => l.client_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, target_calories, target_protein_g, target_carbs_g, target_fat_g, goal, start_weight_kg')
      .in('id', clientIds)

    const profileMap = {}
    ;(profiles || []).forEach(p => { profileMap[p.id] = p })

    // Get latest payment status for each client
    const { data: payments } = await supabase
      .from('client_payments')
      .select('client_id, status, due_date')
      .eq('coach_id', user.id)
      .order('due_date', { ascending: false })

    const paymentMap = {}
    ;(payments || []).forEach(p => {
      if (!paymentMap[p.client_id]) paymentMap[p.client_id] = p
    })

    // Get today's attendance
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: todayAttendance } = await supabase
      .from('attendance')
      .select('client_id, status')
      .eq('coach_id', user.id)
      .eq('date', today)

    const attendanceMap = {}
    ;(todayAttendance || []).forEach(a => { attendanceMap[a.client_id] = a.status })

    setClients(links.map(l => ({
      ...l,
      profile: profileMap[l.client_id] || null,
      latestPayment: paymentMap[l.client_id] || null,
      todayAttendance: attendanceMap[l.client_id] || null,
    })))
  }

  async function addClient() {
    if (!shareToken.trim()) return
    setAddResult(null)
    const { data, error } = await supabase.rpc('link_client_to_coach', {
      share_token_input: shareToken.trim()
    })
    if (error) {
      setAddResult({ error: error.message })
    } else if (data?.error) {
      setAddResult({ error: data.error })
    } else {
      setAddResult({ success: true, name: data.client_name })
      setShareToken('')
      loadClients()
      setTimeout(() => { setShowAddClient(false); setAddResult(null) }, 2000)
    }
  }

  async function openClient(client) {
    setSelectedClient(client)
    setClientProfile(client.profile)
    setActiveTab('overview')
  }

  async function markAttendance(clientId, status) {
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('coach_id', user.id)
      .eq('client_id', clientId)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert({
        coach_id: user.id,
        client_id: clientId,
        date: today,
        status,
      })
    }
    loadClients()
  }

  // ============ CLIENT VIEW ============
  if (selectedClient) {
    return (
      <ClientView
        client={selectedClient}
        profile={clientProfile}
        coachId={user.id}
        onBack={() => { setSelectedClient(null); loadClients() }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    )
  }

  // ============ CLIENT LIST ============
  const paidCount = clients.filter(c => c.latestPayment?.status === 'paid').length
  const lateCount = clients.filter(c => c.latestPayment?.status === 'late').length
  const presentToday = clients.filter(c => c.todayAttendance === 'present').length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Coach Dashboard</h1>
          <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, MMMM d')}</p>
        </div>
        <button onClick={() => setShowAddClient(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium">
          <UserPlus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Quick Stats */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Total Clients</div>
            <div className="text-2xl font-bold text-white">{clients.length}</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Present Today</div>
            <div className="text-2xl font-bold text-emerald-400">{presentToday}</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Payments Received</div>
            <div className="text-2xl font-bold text-blue-400">{paidCount}</div>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-500 mb-1">Late Payments</div>
            <div className={`text-2xl font-bold ${lateCount > 0 ? 'text-red-400' : 'text-gray-600'}`}>{lateCount}</div>
          </div>
        </div>
      )}

      {/* Client Cards */}
      {clients.length > 0 ? (
        <div className="space-y-2">
          {clients.map(client => {
            const payStatus = client.latestPayment?.status
            const isLate = payStatus === 'late'
            const isPending = payStatus === 'pending'

            return (
              <div key={client.id}
                className="bg-gray-900 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="flex items-center p-4">
                  {/* Quick attendance buttons */}
                  <div className="flex gap-1 mr-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); markAttendance(client.client_id, 'present') }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        client.todayAttendance === 'present' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-600 hover:text-emerald-400'
                      }`}
                      title="Present">
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); markAttendance(client.client_id, 'absent') }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        client.todayAttendance === 'absent' ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-600 hover:text-red-400'
                      }`}
                      title="Absent">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Client info */}
                  <button onClick={() => openClient(client)} className="flex-1 flex items-center justify-between text-left">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {client.profile?.full_name || 'Client'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {client.profile?.goal?.replace(/_/g, ' ') || 'No goal set'}
                        {client.profile?.target_calories && ` · ${client.profile.target_calories} kcal`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLate && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
                          Payment Due
                        </span>
                      )}
                      {isPending && (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/30">
                          Pending
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </div>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-900 rounded-2xl border border-gray-800">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No clients yet</h3>
          <p className="text-sm text-gray-600 mb-4">Ask your clients to share their 6-digit code with you</p>
          <button onClick={() => setShowAddClient(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium">
            Add Your First Client
          </button>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setShowAddClient(false); setAddResult(null) }}>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add Client</h3>
              <button onClick={() => { setShowAddClient(false); setAddResult(null) }} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Enter the 6-digit code from your client's <strong className="text-gray-300">Share</strong> page.
            </p>
            <input
              type="text"
              value={shareToken}
              onChange={(e) => setShareToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4 font-mono text-3xl text-center tracking-[0.3em]"
              autoFocus
            />
            {addResult?.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" /> {addResult.error}
              </div>
            )}
            {addResult?.success && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" /> Added {addResult.name}!
              </div>
            )}
            <button onClick={addClient} disabled={shareToken.length < 6}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors">
              Link Client
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// =============================================
// CLIENT VIEW - Full tabbed interface
// =============================================
function ClientView({ client, profile, coachId, onBack, activeTab, setActiveTab }) {
  const [liveOpen, setLiveOpen] = useState(false)
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Users },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'plan', label: 'Plan', icon: ClipboardList },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'notes', label: 'Notes', icon: StickyNote },
  ]

  return (
    <div>
      <div className="flex items-start gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-lg transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{profile?.full_name || 'Client'}</h1>
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {profile?.goal?.replace(/_/g, ' ') || 'No goal'}
            {profile?.target_calories && ` · ${profile.target_calories} kcal · ${profile.target_protein_g}g protein`}
          </p>
        </div>
        <button
          onClick={() => setLiveOpen(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium text-sm shadow-lg shadow-emerald-500/20 shrink-0"
        >
          <Play className="w-4 h-4" />
          <span className="hidden sm:inline">Start Live Session</span>
          <span className="sm:hidden">Start</span>
        </button>
      </div>

      {liveOpen && (
        <LiveCoachSession
          clientId={client.client_id}
          clientName={profile?.full_name || 'Client'}
          coachId={coachId}
          onClose={() => setLiveOpen(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:bg-gray-800'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'overview' && <OverviewTab clientId={client.client_id} profile={profile} coachId={coachId} />}
      {activeTab === 'workouts' && <WorkoutsTab clientId={client.client_id} coachId={coachId} />}
      {activeTab === 'progress' && <ProgressTab clientId={client.client_id} profile={profile} />}
      {activeTab === 'plan' && <PlanTab clientId={client.client_id} clientName={profile?.full_name} coachId={coachId} />}
      {activeTab === 'attendance' && <AttendanceTab clientId={client.client_id} coachId={coachId} />}
      {activeTab === 'payments' && <PaymentsTab clientId={client.client_id} clientName={profile?.full_name} coachId={coachId} monthlyFee={client.monthly_fee} />}
      {activeTab === 'notes' && <NotesTab clientId={client.client_id} coachId={coachId} />}
    </div>
  )
}


// =============================================
// OVERVIEW TAB
// =============================================
function OverviewTab({ clientId, profile, coachId }) {
  const [todayFood, setTodayFood] = useState([])
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [lastSleep, setLastSleep] = useState(null)
  const [attendance30d, setAttendance30d] = useState([])

  useEffect(() => { loadOverview() }, [clientId])

  async function loadOverview() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const thirtyAgo = format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd')

    const [foodRes, workoutRes, sleepRes, attendRes] = await Promise.all([
      supabase.from('food_log').select('*').eq('user_id', clientId).eq('logged_at', today),
      supabase.from('workout_sessions').select('*').eq('user_id', clientId).order('workout_date', { ascending: false }).limit(5),
      supabase.from('sleep_log').select('*').eq('user_id', clientId).order('sleep_date', { ascending: false }).limit(1),
      supabase.from('attendance').select('*').eq('client_id', clientId).eq('coach_id', coachId).gte('date', thirtyAgo),
    ])

    setTodayFood(foodRes.data || [])
    setRecentWorkouts(workoutRes.data || [])
    setLastSleep(sleepRes.data?.[0] || null)
    setAttendance30d(attendRes.data || [])
  }

  const totals = todayFood.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein_g),
  }), { calories: 0, protein: 0 })

  const presentDays = attendance30d.filter(a => a.status === 'present').length
  const absentDays = attendance30d.filter(a => a.status === 'absent').length
  const attendanceRate = (presentDays + absentDays) > 0 ? Math.round(presentDays / (presentDays + absentDays) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Today's Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-1">Today's Calories</div>
          <div className={`text-xl font-bold ${totals.calories > 0 ? 'text-white' : 'text-gray-600'}`}>
            {Math.round(totals.calories)}
          </div>
          <div className="text-xs text-gray-600">/ {profile?.target_calories || '—'} kcal</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-1">Today's Protein</div>
          <div className={`text-xl font-bold ${totals.protein >= (profile?.target_protein_g || 130) * 0.9 ? 'text-emerald-400' : totals.protein > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
            {Math.round(totals.protein)}g
          </div>
          <div className="text-xs text-gray-600">/ {profile?.target_protein_g || '—'}g</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-1">Attendance (30d)</div>
          <div className={`text-xl font-bold ${attendanceRate >= 80 ? 'text-emerald-400' : attendanceRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {attendanceRate}%
          </div>
          <div className="text-xs text-gray-600">{presentDays} of {presentDays + absentDays} days</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-1">Last Sleep</div>
          <div className="text-xl font-bold text-white">{lastSleep?.duration_hours || '—'}h</div>
          <div className="text-xs text-gray-600">{lastSleep ? `Quality: ${lastSleep.quality}/5` : 'No data'}</div>
        </div>
      </div>

      {/* Recent Workouts */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Workouts</h3>
        {recentWorkouts.length > 0 ? (
          <div className="space-y-2">
            {recentWorkouts.map(w => (
              <div key={w.id} className="flex justify-between text-sm py-1.5 border-b border-gray-800/50 last:border-0">
                <span className="text-gray-300">{w.name || 'Workout'}</span>
                <span className="text-gray-500">{w.workout_date}{w.duration_minutes ? ` · ${w.duration_minutes}min` : ''}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No recent workouts</p>
        )}
      </div>
    </div>
  )
}


// =============================================
// WORKOUTS TAB - Exercise progress tracking
// =============================================
function WorkoutsTab({ clientId, coachId }) {
  const [sessions, setSessions] = useState([])
  const [exerciseProgress, setExerciseProgress] = useState({})
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [expandedSession, setExpandedSession] = useState(null)
  const [expandedSets, setExpandedSets] = useState([])

  useEffect(() => { loadWorkouts() }, [clientId])

  async function loadWorkouts() {
    const { data: sessData } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', clientId)
      .order('workout_date', { ascending: false })
      .limit(30)
    setSessions(sessData || [])

    // Get all sets for progress tracking
    if (sessData && sessData.length > 0) {
      const sessionIds = sessData.map(s => s.id)
      const { data: setsData } = await supabase
        .from('workout_sets')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at')

      // Group by exercise and calculate max weight over time
      const progress = {}
      const sessionDateMap = {}
      sessData.forEach(s => { sessionDateMap[s.id] = s.workout_date })

      ;(setsData || []).forEach(set => {
        const name = set.exercise_name
        if (!progress[name]) progress[name] = []
        progress[name].push({
          date: sessionDateMap[set.session_id],
          weight: Number(set.weight_kg) || 0,
          reps: Number(set.reps) || 0,
          volume: (Number(set.weight_kg) || 0) * (Number(set.reps) || 0),
        })
      })

      // Aggregate by date (max weight per session)
      const aggregated = {}
      Object.entries(progress).forEach(([name, sets]) => {
        const byDate = {}
        sets.forEach(s => {
          if (!byDate[s.date] || s.weight > byDate[s.date].weight) {
            byDate[s.date] = s
          }
        })
        aggregated[name] = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
      })
      setExerciseProgress(aggregated)

      // Auto-select first exercise
      const names = Object.keys(aggregated)
      if (names.length > 0 && !selectedExercise) setSelectedExercise(names[0])
    }
  }

  async function toggleSession(sessionId) {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
      setExpandedSets([])
    } else {
      const { data } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at')
      setExpandedSession(sessionId)
      setExpandedSets(data || [])
    }
  }

  const exerciseNames = Object.keys(exerciseProgress)
  const chartData = selectedExercise ? (exerciseProgress[selectedExercise] || []).map(d => ({
    date: d.date.slice(5), // MM-DD
    weight: d.weight,
    volume: d.volume,
  })) : []

  return (
    <div className="space-y-4">
      {/* Exercise Progress Chart */}
      {exerciseNames.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Strength Progress</h3>
          <select
            value={selectedExercise || ''}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {exerciseNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} name="Weight (kg)" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-600 text-center py-6">Need 2+ sessions to show progress</p>
          )}
        </div>
      )}

      {/* Workout History */}
      <h3 className="text-sm font-medium text-gray-400">Workout History</h3>
      {sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map(s => (
            <div key={s.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <button onClick={() => toggleSession(s.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors">
                <div className="text-left">
                  <div className="text-sm font-medium text-white">{s.name || 'Workout'}</div>
                  <div className="text-xs text-gray-500">{s.workout_date}{s.duration_minutes ? ` · ${s.duration_minutes}min` : ''}</div>
                </div>
                {expandedSession === s.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {expandedSession === s.id && (
                <div className="px-3 pb-3 border-t border-gray-800 pt-2">
                  {expandedSets.length > 0 ? expandedSets.map(set => (
                    <div key={set.id} className="flex justify-between text-xs py-1 text-gray-400">
                      <span className="text-gray-300">{set.exercise_name}</span>
                      <span>{set.reps} x {set.weight_kg}kg{set.rpe ? ` @${set.rpe}` : ''}</span>
                    </div>
                  )) : <p className="text-xs text-gray-600">No sets recorded</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600 text-center py-8">No workouts yet</p>
      )}
    </div>
  )
}


// =============================================
// PROGRESS TAB - Weight, measurements
// =============================================
function ProgressTab({ clientId, profile }) {
  const [entries, setEntries] = useState([])
  const [strengthData, setStrengthData] = useState({})
  const [selectedExercise, setSelectedExercise] = useState('')

  useEffect(() => {
    loadProgress()
    loadStrength()
  }, [clientId])

  async function loadProgress() {
    const { data } = await supabase
      .from('weekly_progress')
      .select('*')
      .eq('user_id', clientId)
      .order('recorded_date', { ascending: false })
    setEntries(data || [])
  }

  async function loadStrength() {
    // Get this client's workout sessions
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, workout_date')
      .eq('user_id', clientId)
      .order('workout_date')
    if (!sessions || sessions.length === 0) return

    const sessionMap = {}
    sessions.forEach(s => { sessionMap[s.id] = s.workout_date })

    const { data: sets } = await supabase
      .from('workout_sets')
      .select('session_id, exercise_name, reps, weight_kg')
      .in('session_id', sessions.map(s => s.id))
    if (!sets || sets.length === 0) return

    // Group by exercise, take the top working set per date (max weight × reps)
    const byEx = {}
    sets.forEach(set => {
      if (!set.weight_kg || !set.reps) return
      const date = sessionMap[set.session_id]
      if (!date) return
      const key = set.exercise_name
      if (!byEx[key]) byEx[key] = {}
      // Estimated 1RM: weight × (1 + reps/30) (Epley)
      const e1rm = Number(set.weight_kg) * (1 + Number(set.reps) / 30)
      if (!byEx[key][date] || e1rm > byEx[key][date].e1rm) {
        byEx[key][date] = { e1rm, weight: Number(set.weight_kg), reps: Number(set.reps) }
      }
    })

    // Transform to { exerciseName: [{date, weight, e1rm}] }
    const result = {}
    Object.entries(byEx).forEach(([ex, dates]) => {
      result[ex] = Object.entries(dates)
        .map(([date, v]) => ({ date: date.slice(5), weight: v.weight, e1rm: Math.round(v.e1rm * 10) / 10, reps: v.reps }))
        .sort((a, b) => a.date.localeCompare(b.date))
    })
    setStrengthData(result)
    const exNames = Object.keys(result)
    if (exNames.length > 0 && !selectedExercise) setSelectedExercise(exNames[0])
  }

  const weightChart = [...entries].reverse().filter(e => e.weight_kg).map(e => ({
    date: e.recorded_date.slice(5),
    weight: Number(e.weight_kg),
  }))

  const waistChart = [...entries].reverse().filter(e => e.waist_cm).map(e => ({
    date: e.recorded_date.slice(5),
    waist: Number(e.waist_cm),
  }))

  const latestWeight = entries.find(e => e.weight_kg)?.weight_kg
  const startWeight = profile?.start_weight_kg || entries[entries.length - 1]?.weight_kg
  const change = latestWeight && startWeight ? (latestWeight - startWeight).toFixed(1) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Current</div>
          <div className="text-xl font-bold text-white">{latestWeight || '—'} kg</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Start</div>
          <div className="text-xl font-bold text-gray-400">{startWeight || '—'} kg</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
          <div className="text-xs text-gray-500 mb-1">Change</div>
          <div className={`text-xl font-bold ${change && Number(change) < 0 ? 'text-emerald-400' : change ? 'text-yellow-400' : 'text-gray-600'}`}>
            {change ? `${Number(change) > 0 ? '+' : ''}${change}` : '—'} kg
          </div>
        </div>
      </div>

      {weightChart.length > 1 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Weight Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {waistChart.length > 1 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Waist Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={waistChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="waist" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Strength Progress */}
      {Object.keys(strengthData).length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">Strength Progress</h3>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {Object.keys(strengthData).map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>
          {selectedExercise && strengthData[selectedExercise]?.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="p-2 bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-500">Top Weight</div>
                  <div className="text-lg font-semibold text-emerald-400">
                    {Math.max(...strengthData[selectedExercise].map(d => d.weight))} kg
                  </div>
                </div>
                <div className="p-2 bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-500">Est. 1RM</div>
                  <div className="text-lg font-semibold text-blue-400">
                    {Math.max(...strengthData[selectedExercise].map(d => d.e1rm))} kg
                  </div>
                </div>
                <div className="p-2 bg-gray-800/50 rounded-lg">
                  <div className="text-xs text-gray-500">Sessions</div>
                  <div className="text-lg font-semibold text-white">
                    {strengthData[selectedExercise].length}
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={strengthData[selectedExercise]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                  <YAxis stroke="#6b7280" fontSize={11} domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Weight (kg)" />
                  <Line type="monotone" dataKey="e1rm" stroke="#3b82f6" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 2 }} name="Est. 1RM" />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* Check-in History */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Check-ins</h3>
        {entries.length > 0 ? entries.map(e => (
          <div key={e.id} className="flex justify-between text-sm py-1.5 border-b border-gray-800/50 last:border-0">
            <span className="text-gray-300">{e.recorded_date}</span>
            <span className="text-gray-500">
              {e.weight_kg && `${e.weight_kg}kg`}{e.waist_cm && ` · ${e.waist_cm}cm`}{e.body_fat_pct && ` · ${e.body_fat_pct}%`}
            </span>
          </div>
        )) : <p className="text-sm text-gray-600">No check-ins yet</p>}
      </div>
    </div>
  )
}


// =============================================
// PLAN TAB - Workout programs + scheduling
// =============================================
function PlanTab({ clientId, clientName, coachId }) {
  const [programs, setPrograms] = useState([])
  const [plannedWorkouts, setPlannedWorkouts] = useState([])
  const [exercises, setExercises] = useState([])
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [showNewWorkout, setShowNewWorkout] = useState(false)
  const [newProgram, setNewProgram] = useState({ name: '', description: '', duration_weeks: 4 })
  const [newWorkout, setNewWorkout] = useState({ name: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), program_id: '', notes: '' })
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [planExercises, setPlanExercises] = useState([])
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [exSearch, setExSearch] = useState('')
  const [newExercise, setNewExercise] = useState({ exercise_name: '', sets: 3, reps: '10', weight_kg: '', rest_seconds: 90, notes: '' })

  useEffect(() => {
    loadPrograms()
    loadPlannedWorkouts()
    loadExerciseList()
  }, [clientId])

  async function loadExerciseList() {
    const { data } = await supabase.from('exercises').select('*').order('name')
    setExercises(data || [])
  }

  async function loadPrograms() {
    const { data } = await supabase
      .from('workout_programs')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
    setPrograms(data || [])
  }

  async function loadPlannedWorkouts() {
    const { data } = await supabase
      .from('planned_workouts')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .gte('scheduled_date', format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd'))
      .order('scheduled_date')
    setPlannedWorkouts(data || [])
  }

  async function createProgram() {
    const { data, error } = await supabase.from('workout_programs').insert({
      coach_id: coachId,
      client_id: clientId,
      name: newProgram.name,
      description: newProgram.description,
      duration_weeks: Number(newProgram.duration_weeks),
      start_date: format(new Date(), 'yyyy-MM-dd'),
    }).select().single()
    if (!error) {
      setShowNewProgram(false)
      setNewProgram({ name: '', description: '', duration_weeks: 4 })
      loadPrograms()

      // Send notification to client
      await supabase.from('notifications').insert({
        user_id: clientId,
        from_user_id: coachId,
        type: 'workout_assigned',
        title: 'New Program Assigned',
        message: `Your coach assigned you a new program: ${newProgram.name}`,
        link: '/gym',
      })
    }
  }

  async function createPlannedWorkout() {
    const { data, error } = await supabase.from('planned_workouts').insert({
      coach_id: coachId,
      client_id: clientId,
      program_id: newWorkout.program_id || null,
      name: newWorkout.name,
      scheduled_date: newWorkout.scheduled_date,
      notes: newWorkout.notes,
    }).select().single()
    if (!error) {
      setShowNewWorkout(false)
      setNewWorkout({ name: '', scheduled_date: format(new Date(), 'yyyy-MM-dd'), program_id: '', notes: '' })
      loadPlannedWorkouts()

      // Notify client
      await supabase.from('notifications').insert({
        user_id: clientId,
        from_user_id: coachId,
        type: 'workout_reminder',
        title: 'Workout Scheduled',
        message: `${newWorkout.name} on ${newWorkout.scheduled_date}`,
        link: '/gym',
      })
    }
  }

  async function openPlanDetail(workout) {
    setSelectedPlan(workout)
    const { data } = await supabase
      .from('planned_exercises')
      .select('*')
      .eq('planned_workout_id', workout.id)
      .order('sort_order')
    setPlanExercises(data || [])
  }

  async function addExerciseToPlan() {
    if (!selectedPlan || !newExercise.exercise_name) return
    const { error } = await supabase.from('planned_exercises').insert({
      planned_workout_id: selectedPlan.id,
      exercise_name: newExercise.exercise_name,
      sets: Number(newExercise.sets),
      reps: newExercise.reps,
      weight_kg: Number(newExercise.weight_kg) || null,
      rest_seconds: Number(newExercise.rest_seconds),
      notes: newExercise.notes,
      sort_order: planExercises.length,
    })
    if (!error) {
      setNewExercise({ exercise_name: '', sets: 3, reps: '10', weight_kg: '', rest_seconds: 90, notes: '' })
      setShowAddExercise(false)
      setExSearch('')
      openPlanDetail(selectedPlan)
    }
  }

  async function removeExerciseFromPlan(id) {
    await supabase.from('planned_exercises').delete().eq('id', id)
    openPlanDetail(selectedPlan)
  }

  async function updateWorkoutStatus(id, status) {
    await supabase.from('planned_workouts').update({ status }).eq('id', id)
    loadPlannedWorkouts()
    if (selectedPlan?.id === id) setSelectedPlan({ ...selectedPlan, status })
  }

  const filteredEx = exSearch.length >= 1
    ? exercises.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase()) && e.name.toLowerCase() !== exSearch.toLowerCase()).slice(0, 6)
    : []

  // Plan detail view
  if (selectedPlan) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setSelectedPlan(null)} className="p-1.5 hover:bg-gray-800 rounded-lg">
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div>
            <h3 className="text-lg font-semibold text-white">{selectedPlan.name}</h3>
            <p className="text-xs text-gray-500">{selectedPlan.scheduled_date}
              {selectedPlan.notes && ` · ${selectedPlan.notes}`}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => updateWorkoutStatus(selectedPlan.id, 'completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedPlan.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-400 hover:text-emerald-400'}`}>
              Completed
            </button>
            <button onClick={() => updateWorkoutStatus(selectedPlan.id, 'missed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedPlan.status === 'missed' ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400 hover:text-red-400'}`}>
              Missed
            </button>
          </div>
        </div>

        {/* Exercises in this plan */}
        {planExercises.length > 0 ? (
          <div className="space-y-2 mb-4">
            {planExercises.map((ex, i) => (
              <div key={ex.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">{ex.exercise_name}</div>
                  <div className="text-xs text-gray-500">
                    {ex.sets} sets x {ex.reps} reps
                    {ex.weight_kg && ` @ ${ex.weight_kg}kg`}
                    {ex.rest_seconds && ` · ${ex.rest_seconds}s rest`}
                  </div>
                  {ex.notes && <div className="text-xs text-gray-600 mt-1">{ex.notes}</div>}
                </div>
                <button onClick={() => removeExerciseFromPlan(ex.id)} className="text-gray-600 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 text-center py-6 mb-4">No exercises added yet</p>
        )}

        {/* Add exercise */}
        {showAddExercise ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" value={exSearch}
                onChange={(e) => { setExSearch(e.target.value); setNewExercise({ ...newExercise, exercise_name: e.target.value }) }}
                placeholder="Search exercise..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus />
              {filteredEx.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  {filteredEx.map(ex => (
                    <button key={ex.id}
                      onClick={() => { setNewExercise({ ...newExercise, exercise_name: ex.name }); setExSearch(ex.name); }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-white">
                      {ex.name} <span className="text-gray-500">- {ex.muscle_group}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div>
                <label className="text-xs text-gray-500">Sets</label>
                <input type="number" value={newExercise.sets} onChange={(e) => setNewExercise({ ...newExercise, sets: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Reps</label>
                <input type="text" value={newExercise.reps} onChange={(e) => setNewExercise({ ...newExercise, reps: e.target.value })}
                  placeholder="8-12"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Weight</label>
                <input type="number" value={newExercise.weight_kg} onChange={(e) => setNewExercise({ ...newExercise, weight_kg: e.target.value })}
                  placeholder="kg"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Rest (s)</label>
                <input type="number" value={newExercise.rest_seconds} onChange={(e) => setNewExercise({ ...newExercise, rest_seconds: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addExerciseToPlan} disabled={!newExercise.exercise_name}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">Add</button>
              <button onClick={() => { setShowAddExercise(false); setExSearch('') }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddExercise(true)}
            className="w-full py-2.5 border border-dashed border-gray-700 rounded-lg text-sm text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors">
            + Add Exercise
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Programs */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400">Programs</h3>
        <button onClick={() => setShowNewProgram(true)} className="text-xs text-emerald-400 hover:text-emerald-300">+ New Program</button>
      </div>

      {showNewProgram && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <input type="text" value={newProgram.name} onChange={(e) => setNewProgram({ ...newProgram, name: e.target.value })}
            placeholder="Program name (e.g. Phase 1 - Hypertrophy)" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus />
          <input type="text" value={newProgram.description} onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
            placeholder="Description (optional)" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="flex gap-2">
            <input type="number" value={newProgram.duration_weeks} onChange={(e) => setNewProgram({ ...newProgram, duration_weeks: e.target.value })}
              className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <span className="text-sm text-gray-500 self-center">weeks</span>
            <div className="flex-1" />
            <button onClick={createProgram} disabled={!newProgram.name} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm">Create</button>
            <button onClick={() => setShowNewProgram(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {programs.map(p => (
        <div key={p.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-sm font-medium text-white">{p.name}</div>
          <div className="text-xs text-gray-500">{p.duration_weeks} weeks · {p.status}{p.start_date && ` · Started ${p.start_date}`}</div>
          {p.description && <div className="text-xs text-gray-600 mt-1">{p.description}</div>}
        </div>
      ))}

      {/* Scheduled Workouts */}
      <div className="flex items-center justify-between mt-6">
        <h3 className="text-sm font-medium text-gray-400">Scheduled Workouts</h3>
        <button onClick={() => setShowNewWorkout(true)} className="text-xs text-emerald-400 hover:text-emerald-300">+ Schedule Workout</button>
      </div>

      {showNewWorkout && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <input type="text" value={newWorkout.name} onChange={(e) => setNewWorkout({ ...newWorkout, name: e.target.value })}
            placeholder="Workout name (e.g. Push Day)" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus />
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input type="date" value={newWorkout.scheduled_date} onChange={(e) => setNewWorkout({ ...newWorkout, scheduled_date: e.target.value })}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <select value={newWorkout.program_id} onChange={(e) => setNewWorkout({ ...newWorkout, program_id: e.target.value })}
              className="px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">No program</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <input type="text" value={newWorkout.notes} onChange={(e) => setNewWorkout({ ...newWorkout, notes: e.target.value })}
            placeholder="Notes (optional)" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="flex gap-2">
            <button onClick={createPlannedWorkout} disabled={!newWorkout.name}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm">Schedule</button>
            <button onClick={() => setShowNewWorkout(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {plannedWorkouts.map(w => {
        const isPast = w.scheduled_date < format(new Date(), 'yyyy-MM-dd')
        const isToday = w.scheduled_date === format(new Date(), 'yyyy-MM-dd')
        return (
          <button key={w.id} onClick={() => openPlanDetail(w)}
            className="w-full bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors text-left flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-2">
                {w.name}
                {isToday && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Today</span>}
                {w.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {w.status === 'missed' && <XCircle className="w-4 h-4 text-red-400" />}
              </div>
              <div className="text-xs text-gray-500">{w.scheduled_date}{w.notes && ` · ${w.notes}`}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        )
      })}

      {plannedWorkouts.length === 0 && !showNewWorkout && (
        <p className="text-sm text-gray-600 text-center py-6">No workouts scheduled</p>
      )}
    </div>
  )
}


// =============================================
// ATTENDANCE TAB
// =============================================
function AttendanceTab({ clientId, coachId }) {
  const [records, setRecords] = useState([])
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => { loadAttendance() }, [clientId, month])

  async function loadAttendance() {
    const startDate = `${month}-01`
    const endDate = `${month}-31`
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
    setRecords(data || [])
  }

  async function markDay(date, status) {
    // Optimistic UI update
    const existing = records.find(r => r.date === date)
    if (existing) {
      setRecords(records.map(r => r.date === date ? { ...r, status } : r))
    } else {
      setRecords([{ id: 'temp-' + date, date, status, coach_id: coachId, client_id: clientId }, ...records])
    }

    // Check if record exists already in DB
    const { data: dbExisting, error: selErr } = await supabase
      .from('attendance')
      .select('id')
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .eq('date', date)
      .maybeSingle()

    if (selErr) {
      console.error('attendance select error:', selErr)
      alert('Error checking attendance: ' + selErr.message)
      return
    }

    let result
    if (dbExisting) {
      result = await supabase.from('attendance').update({ status }).eq('id', dbExisting.id)
    } else {
      result = await supabase.from('attendance').insert({
        coach_id: coachId,
        client_id: clientId,
        date,
        status,
      })
    }

    if (result.error) {
      console.error('attendance save error:', result.error)
      alert('Error saving attendance: ' + result.error.message)
    }
    loadAttendance()
  }

  const present = records.filter(r => r.status === 'present').length
  const absent = records.filter(r => r.status === 'absent').length
  const total = present + absent
  const rate = total > 0 ? Math.round(present / total * 100) : 0

  // Generate last 14 days for quick marking
  const recentDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return format(d, 'yyyy-MM-dd')
  })
  const recordMap = {}
  records.forEach(r => { recordMap[r.date] = r.status })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{present}</div>
          <div className="text-xs text-gray-500">Present</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{absent}</div>
          <div className="text-xs text-gray-500">Absent</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 text-center">
          <div className={`text-2xl font-bold ${rate >= 80 ? 'text-emerald-400' : rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{rate}%</div>
          <div className="text-xs text-gray-500">Rate</div>
        </div>
      </div>

      {/* Quick mark last 14 days */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Last 14 Days</h3>
        <div className="space-y-1">
          {recentDays.map(date => {
            const status = recordMap[date]
            const dayName = format(parseISO(date), 'EEE, MMM d')
            return (
              <div key={date} className="flex items-center justify-between py-1.5">
                <span className={`text-sm ${date === format(new Date(), 'yyyy-MM-dd') ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {dayName}{date === format(new Date(), 'yyyy-MM-dd') && ' (Today)'}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => markDay(date, 'present')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${status === 'present' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-600 hover:text-emerald-400'}`}>
                    Present
                  </button>
                  <button onClick={() => markDay(date, 'absent')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${status === 'absent' ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-600 hover:text-red-400'}`}>
                    Absent
                  </button>
                  <button onClick={() => markDay(date, 'excused')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${status === 'excused' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-600 hover:text-yellow-400'}`}>
                    Excused
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


// =============================================
// PAYMENTS TAB
// =============================================
function PaymentsTab({ clientId, clientName, coachId, monthlyFee }) {
  const [payments, setPayments] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newPayment, setNewPayment] = useState({
    amount: monthlyFee || '',
    payment_type: 'monthly',
    status: 'pending',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    paid_date: '',
    months_covered: 1,
    notes: '',
  })

  useEffect(() => { loadPayments() }, [clientId])

  async function loadPayments() {
    const { data } = await supabase
      .from('client_payments')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .order('due_date', { ascending: false })
    setPayments(data || [])
  }

  async function addPayment() {
    const { error } = await supabase.from('client_payments').insert({
      coach_id: coachId,
      client_id: clientId,
      amount: Number(newPayment.amount),
      payment_type: newPayment.payment_type,
      status: newPayment.status,
      due_date: newPayment.due_date,
      paid_date: newPayment.paid_date || null,
      months_covered: Number(newPayment.months_covered),
      notes: newPayment.notes,
    })
    if (!error) {
      setShowAdd(false)
      setNewPayment({ amount: monthlyFee || '', payment_type: 'monthly', status: 'pending', due_date: format(new Date(), 'yyyy-MM-dd'), paid_date: '', months_covered: 1, notes: '' })
      loadPayments()

      // Notify client about payment
      if (newPayment.status === 'pending') {
        await supabase.from('notifications').insert({
          user_id: clientId,
          from_user_id: coachId,
          type: 'payment_due',
          title: 'Payment Due',
          message: `Payment of Rs. ${newPayment.amount} is due on ${newPayment.due_date}`,
        })
      }
    }
  }

  async function markPaid(id) {
    await supabase.from('client_payments').update({
      status: 'paid',
      paid_date: format(new Date(), 'yyyy-MM-dd'),
    }).eq('id', id)
    loadPayments()
  }

  async function markLate(id) {
    await supabase.from('client_payments').update({ status: 'late' }).eq('id', id)
    loadPayments()

    // Notify client
    await supabase.from('notifications').insert({
      user_id: clientId,
      from_user_id: coachId,
      type: 'payment_late',
      title: 'Payment Overdue',
      message: 'Your payment is overdue. Please clear your dues.',
    })
  }

  async function deletePayment(id) {
    await supabase.from('client_payments').delete().eq('id', id)
    loadPayments()
  }

  const totalReceived = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const totalPending = payments.filter(p => p.status === 'pending' || p.status === 'late').reduce((s, p) => s + Number(p.amount), 0)

  const statusColors = {
    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    late: 'bg-red-500/10 text-red-400 border-red-500/30',
    waived: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-1">Total Received</div>
          <div className="text-xl font-bold text-emerald-400">Rs. {totalReceived.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="text-xs text-gray-500 mb-1">Outstanding</div>
          <div className={`text-xl font-bold ${totalPending > 0 ? 'text-red-400' : 'text-gray-600'}`}>Rs. {totalPending.toLocaleString()}</div>
        </div>
      </div>

      <button onClick={() => setShowAdd(true)}
        className="w-full py-2.5 border border-dashed border-gray-700 rounded-lg text-sm text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors">
        + Record Payment
      </button>

      {showAdd && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs text-gray-500">Amount (Rs.)</label>
              <input type="number" value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Type</label>
              <select value={newPayment.payment_type} onChange={(e) => setNewPayment({ ...newPayment, payment_type: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="monthly">Monthly</option>
                <option value="advance">Advance</option>
                <option value="partial">Partial</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="text-xs text-gray-500">Due Date</label>
              <input type="date" value={newPayment.due_date} onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Status</label>
              <select value={newPayment.status} onChange={(e) => setNewPayment({ ...newPayment, status: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="late">Late</option>
                <option value="waived">Waived</option>
              </select>
            </div>
          </div>
          {newPayment.payment_type === 'advance' && (
            <div className="mb-2">
              <label className="text-xs text-gray-500">Months Covered</label>
              <input type="number" value={newPayment.months_covered} onChange={(e) => setNewPayment({ ...newPayment, months_covered: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          )}
          <input type="text" value={newPayment.notes} onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
            placeholder="Notes (optional)" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="flex gap-2">
            <button onClick={addPayment} disabled={!newPayment.amount}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Payment History */}
      {payments.map(p => (
        <div key={p.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Rs. {Number(p.amount).toLocaleString()}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[p.status]}`}>{p.status}</span>
              <span className="text-xs text-gray-600 capitalize">{p.payment_type}</span>
            </div>
            <div className="flex items-center gap-1">
              {(p.status === 'pending' || p.status === 'late') && (
                <button onClick={() => markPaid(p.id)} className="px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded">Mark Paid</button>
              )}
              {p.status === 'pending' && (
                <button onClick={() => markLate(p.id)} className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded">Mark Late</button>
              )}
              <button onClick={() => deletePayment(p.id)} className="p-1 text-gray-600 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Due: {p.due_date}
            {p.paid_date && ` · Paid: ${p.paid_date}`}
            {p.months_covered > 1 && ` · ${p.months_covered} months`}
            {p.notes && ` · ${p.notes}`}
          </div>
        </div>
      ))}

      {payments.length === 0 && !showAdd && (
        <p className="text-sm text-gray-600 text-center py-8">No payment records</p>
      )}
    </div>
  )
}


// =============================================
// NOTES TAB
// =============================================
function NotesTab({ clientId, coachId }) {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')

  useEffect(() => { loadNotes() }, [clientId])

  async function loadNotes() {
    const { data } = await supabase
      .from('coach_notes')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  async function addNote() {
    if (!newNote.trim()) return
    await supabase.from('coach_notes').insert({
      coach_id: coachId,
      client_id: clientId,
      content: newNote.trim(),
    })
    setNewNote('')
    loadNotes()
  }

  async function deleteNote(id) {
    await supabase.from('coach_notes').delete().eq('id', id)
    loadNotes()
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <div className="flex gap-2">
          <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
            placeholder="Write a note..." rows={2}
            className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm" />
          <button onClick={addNote} disabled={!newNote.trim()}
            className="px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-colors self-end">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {notes.map(note => (
        <div key={note.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex justify-between items-start">
            <div className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</div>
            <button onClick={() => deleteNote(note.id)} className="text-gray-600 hover:text-red-400 ml-2 shrink-0">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            {format(parseISO(note.created_at), 'EEE, MMM d · h:mm a')}
          </div>
        </div>
      ))}

      {notes.length === 0 && (
        <p className="text-sm text-gray-600 text-center py-8">No notes yet</p>
      )}
    </div>
  )
}
