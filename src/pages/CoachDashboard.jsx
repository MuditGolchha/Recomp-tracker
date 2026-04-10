import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO } from 'date-fns'
import {
  Users, Plus, UserPlus, ArrowLeft, Utensils, Dumbbell, Moon, Scale,
  TrendingDown, Trash2, StickyNote, Send, ChevronRight, AlertCircle,
  CheckCircle, XCircle, X
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

export default function CoachDashboard() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [showAddClient, setShowAddClient] = useState(false)
  const [shareToken, setShareToken] = useState('')
  const [addResult, setAddResult] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [clientData, setClientData] = useState(null)
  const [loadingClient, setLoadingClient] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (user) loadClients()
  }, [user])

  async function loadClients() {
    const { data } = await supabase
      .from('coach_clients')
      .select('*, profiles:client_id(full_name, target_calories, target_protein_g, target_carbs_g, target_fat_g)')
      .eq('coach_id', user.id)
      .eq('status', 'active')
    setClients(data || [])
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

  async function removeClient(clientId) {
    await supabase
      .from('coach_clients')
      .update({ status: 'removed' })
      .eq('coach_id', user.id)
      .eq('client_id', clientId)
    loadClients()
    if (selectedClient === clientId) {
      setSelectedClient(null)
      setClientData(null)
    }
  }

  async function openClient(clientId) {
    setSelectedClient(clientId)
    setLoadingClient(true)
    setActiveTab('overview')
    setClientData(null)
    const { data, error } = await supabase.rpc('get_client_data', {
      client_user_id: clientId
    })
    if (!error && data && !data.error) {
      setClientData(data)
    } else {
      // Fallback: load data directly
      const [profileRes, foodRes, workoutRes, sleepRes, progressRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', clientId).single(),
        supabase.from('food_log').select('*').eq('user_id', clientId).gte('logged_at', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]).order('logged_at', { ascending: false }),
        supabase.from('workout_sessions').select('*').eq('user_id', clientId).gte('workout_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]).order('workout_date', { ascending: false }),
        supabase.from('sleep_log').select('*').eq('user_id', clientId).gte('sleep_date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]).order('sleep_date', { ascending: false }),
        supabase.from('weekly_progress').select('*').eq('user_id', clientId).order('recorded_date', { ascending: false }),
      ])
      setClientData({
        profile: profileRes.data || {},
        food_log_7d: foodRes.data || [],
        food_log_30d_summary: [],
        workouts: workoutRes.data || [],
        workout_sets: [],
        sleep: sleepRes.data || [],
        progress: progressRes.data || [],
        coach_notes: [],
      })
    }
    setLoadingClient(false)
  }

  async function addNote() {
    if (!newNote.trim() || !selectedClient) return
    await supabase.from('coach_notes').insert({
      coach_id: user.id,
      client_id: selectedClient,
      content: newNote.trim(),
    })
    setNewNote('')
    openClient(selectedClient)
  }

  async function deleteNote(noteId) {
    await supabase.from('coach_notes').delete().eq('id', noteId)
    openClient(selectedClient)
  }

  // If viewing a client
  if (selectedClient && clientData) {
    const profile = clientData.profile || {}
    const foodLog7d = clientData.food_log_7d || []
    const foodSummary30d = clientData.food_log_30d_summary || []
    const workouts = clientData.workouts || []
    const workoutSets = clientData.workout_sets || []
    const sleepLog = clientData.sleep || []
    const progress = clientData.progress || []
    const notes = clientData.coach_notes || []

    // Calculate today's totals
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayFood = foodLog7d.filter(f => f.logged_at === today)
    const todayTotals = todayFood.reduce((acc, f) => ({
      calories: acc.calories + Number(f.calories),
      protein: acc.protein + Number(f.protein_g),
      carbs: acc.carbs + Number(f.carbs_g),
      fat: acc.fat + Number(f.fat_g),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

    // Nutrition chart data
    const nutritionChart = foodSummary30d.map(d => ({
      date: format(parseISO(d.logged_at), 'MMM d'),
      calories: Math.round(Number(d.total_cal)),
      protein: Math.round(Number(d.total_protein)),
    }))

    // Sleep chart data
    const sleepChart = [...sleepLog].reverse().map(s => ({
      date: format(parseISO(s.sleep_date), 'MMM d'),
      hours: Number(s.duration_hours),
      quality: s.quality,
    }))

    // Weight chart data
    const weightChart = [...progress].reverse().filter(p => p.weight_kg).map(p => ({
      date: format(parseISO(p.recorded_date), 'MMM d'),
      weight: Number(p.weight_kg),
    }))

    // Compliance calculations
    const daysWithFood = foodSummary30d.length
    const daysHitProtein = foodSummary30d.filter(d => Number(d.total_protein) >= (profile.target_protein_g || 130) * 0.9).length
    const daysHitCalories = foodSummary30d.filter(d => {
      const cal = Number(d.total_cal)
      const target = profile.target_calories || 1950
      return cal >= target * 0.9 && cal <= target * 1.1
    }).length
    const avgSleep = sleepLog.length > 0
      ? (sleepLog.reduce((s, l) => s + Number(l.duration_hours), 0) / sleepLog.length).toFixed(1)
      : '—'
    const workoutsThisWeek = workouts.filter(w => {
      const d = new Date(w.workout_date)
      const now = new Date()
      const weekAgo = new Date(now - 7 * 86400000)
      return d >= weekAgo
    }).length

    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'nutrition', label: 'Nutrition' },
      { id: 'workouts', label: 'Workouts' },
      { id: 'sleep', label: 'Sleep' },
      { id: 'progress', label: 'Progress' },
      { id: 'notes', label: 'Notes' },
    ]

    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setSelectedClient(null); setClientData(null) }}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.full_name || 'Client'}</h1>
            <p className="text-sm text-gray-500">
              Target: {profile.target_calories} kcal · {profile.target_protein_g}g protein
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-gray-400 hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div>
            {/* Compliance Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-xs text-gray-500 mb-1">Protein Hit Rate</div>
                <div className={`text-2xl font-bold ${daysHitProtein / Math.max(daysWithFood, 1) >= 0.8 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {daysWithFood > 0 ? Math.round(daysHitProtein / daysWithFood * 100) : 0}%
                </div>
                <div className="text-xs text-gray-600">{daysHitProtein}/{daysWithFood} days</div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-xs text-gray-500 mb-1">Calorie Compliance</div>
                <div className={`text-2xl font-bold ${daysHitCalories / Math.max(daysWithFood, 1) >= 0.8 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {daysWithFood > 0 ? Math.round(daysHitCalories / daysWithFood * 100) : 0}%
                </div>
                <div className="text-xs text-gray-600">{daysHitCalories}/{daysWithFood} days</div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-xs text-gray-500 mb-1">Avg Sleep</div>
                <div className={`text-2xl font-bold ${Number(avgSleep) >= 7 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {avgSleep}h
                </div>
                <div className="text-xs text-gray-600">last 30 days</div>
              </div>
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                <div className="text-xs text-gray-500 mb-1">Workouts/Week</div>
                <div className={`text-2xl font-bold ${workoutsThisWeek >= 4 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {workoutsThisWeek}
                </div>
                <div className="text-xs text-gray-600">this week</div>
              </div>
            </div>

            {/* Today's Snapshot */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Today's Intake</h3>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className={`text-xl font-bold ${todayTotals.calories > 0 ? 'text-white' : 'text-gray-600'}`}>
                    {Math.round(todayTotals.calories)}
                  </div>
                  <div className="text-xs text-gray-500">/ {profile.target_calories} kcal</div>
                </div>
                <div>
                  <div className={`text-xl font-bold ${todayTotals.protein >= (profile.target_protein_g || 130) * 0.9 ? 'text-emerald-400' : todayTotals.protein > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                    {Math.round(todayTotals.protein)}g
                  </div>
                  <div className="text-xs text-gray-500">/ {profile.target_protein_g}g protein</div>
                </div>
                <div>
                  <div className={`text-xl font-bold ${todayTotals.carbs > 0 ? 'text-white' : 'text-gray-600'}`}>
                    {Math.round(todayTotals.carbs)}g
                  </div>
                  <div className="text-xs text-gray-500">/ {profile.target_carbs_g}g carbs</div>
                </div>
                <div>
                  <div className={`text-xl font-bold ${todayTotals.fat > 0 ? 'text-white' : 'text-gray-600'}`}>
                    {Math.round(todayTotals.fat)}g
                  </div>
                  <div className="text-xs text-gray-500">/ {profile.target_fat_g}g fat</div>
                </div>
              </div>
            </div>

            {/* Weight Trend */}
            {weightChart.length > 1 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Weight Trend</h3>
                <ResponsiveContainer width="100%" height={180}>
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

            {/* Recent Notes */}
            {notes.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Notes</h3>
                {notes.slice(0, 3).map(note => (
                  <div key={note.id} className="text-sm text-gray-300 py-2 border-b border-gray-800 last:border-0">
                    <div>{note.content}</div>
                    <div className="text-xs text-gray-600 mt-1">{format(parseISO(note.created_at), 'MMM d, h:mm a')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NUTRITION TAB */}
        {activeTab === 'nutrition' && (
          <div>
            {nutritionChart.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Daily Calories (30 Days)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={nutritionChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                    <ReferenceLine y={profile.target_calories || 1950} stroke="#10b981" strokeDasharray="5 5" />
                    <Bar dataKey="calories" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {nutritionChart.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Daily Protein (30 Days)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={nutritionChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                    <ReferenceLine y={profile.target_protein_g || 130} stroke="#ef4444" strokeDasharray="5 5" />
                    <Bar dataKey="protein" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Food Log Details */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Last 7 Days Food Log</h3>
              {foodLog7d.length > 0 ? (
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {foodLog7d.map((f, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-800/50 last:border-0">
                      <div>
                        <span className="text-gray-300">{f.custom_name || 'Food'}</span>
                        <span className="text-gray-600 text-xs ml-2">{f.meal_type}</span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {f.logged_at} · {Math.round(f.calories)} kcal · {Math.round(f.protein_g)}p
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No food logged</p>
              )}
            </div>
          </div>
        )}

        {/* WORKOUTS TAB */}
        {activeTab === 'workouts' && (
          <div className="space-y-4">
            {workouts.length > 0 ? workouts.map(w => {
              const wSets = workoutSets.filter(s => s.session_id === w.id)
              const exerciseGroups = wSets.reduce((acc, s) => {
                if (!acc[s.exercise_name]) acc[s.exercise_name] = []
                acc[s.exercise_name].push(s)
                return acc
              }, {})

              return (
                <div key={w.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{w.name || 'Workout'}</h3>
                      <p className="text-xs text-gray-500">
                        {format(parseISO(w.workout_date), 'EEE, MMM d')}
                        {w.duration_minutes && ` · ${w.duration_minutes} min`}
                      </p>
                    </div>
                    <Dumbbell className="w-4 h-4 text-orange-400" />
                  </div>
                  {Object.entries(exerciseGroups).map(([name, sets]) => (
                    <div key={name} className="mb-2">
                      <div className="text-xs font-medium text-gray-300">{name}</div>
                      <div className="text-xs text-gray-500">
                        {sets.map(s => `${s.reps || '?'}×${s.weight_kg || '?'}kg`).join(' → ')}
                      </div>
                    </div>
                  ))}
                  {Object.keys(exerciseGroups).length === 0 && (
                    <p className="text-xs text-gray-600">No sets recorded</p>
                  )}
                </div>
              )
            }) : (
              <div className="text-center py-12 text-gray-600">No workouts in the last 30 days</div>
            )}
          </div>
        )}

        {/* SLEEP TAB */}
        {activeTab === 'sleep' && (
          <div>
            {sleepChart.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Sleep Duration (30 Days)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sleepChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} domain={[0, 12]} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                    <ReferenceLine y={7} stroke="#10b981" strokeDasharray="5 5" />
                    <Bar dataKey="hours" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Sleep Log</h3>
              {sleepLog.length > 0 ? (
                <div className="space-y-2">
                  {sleepLog.map((s, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-gray-300">{format(parseISO(s.sleep_date), 'EEE, MMM d')}</span>
                      <span className="text-gray-500">
                        {s.duration_hours}h · {'⭐'.repeat(s.quality || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No sleep data</p>
              )}
            </div>
          </div>
        )}

        {/* PROGRESS TAB */}
        {activeTab === 'progress' && (
          <div>
            {weightChart.length > 1 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Weight Trend</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={weightChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                    <YAxis stroke="#6b7280" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Check-in History</h3>
              {progress.length > 0 ? (
                <div className="space-y-2">
                  {progress.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-gray-300">{format(parseISO(p.recorded_date), 'MMM d, yyyy')}</span>
                      <span className="text-gray-500">
                        {p.weight_kg && `${p.weight_kg}kg`}
                        {p.waist_cm && ` · ${p.waist_cm}cm`}
                        {p.body_fat_pct && ` · ${p.body_fat_pct}%`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No progress data</p>
              )}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === 'notes' && (
          <div>
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Add Note</h3>
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Write a note for this client..."
                  rows={2}
                  className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-sm"
                />
                <button
                  onClick={addNote}
                  disabled={!newNote.trim()}
                  className="px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg transition-colors self-end"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {notes.length > 0 ? notes.map(note => (
                <div key={note.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                  <div className="flex justify-between items-start">
                    <div className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</div>
                    <button onClick={() => deleteNote(note.id)} className="text-gray-600 hover:text-red-400 ml-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    {format(parseISO(note.created_at), 'EEE, MMM d · h:mm a')}
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-gray-600 text-sm">No notes yet</div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Loading client
  if (selectedClient && loadingClient) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Loading client data...</div>
      </div>
    )
  }

  // Client list
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Coach Dashboard</h1>
          <p className="text-sm text-gray-500">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowAddClient(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Client Cards */}
      {clients.length > 0 ? (
        <div className="space-y-3">
          {clients.map(client => (
            <button
              key={client.id}
              onClick={() => openClient(client.client_id)}
              className="w-full bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition-colors text-left flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {client.profiles?.full_name || 'Client'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Target: {client.profiles?.target_calories || '—'} kcal · {client.profiles?.target_protein_g || '—'}g protein
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-900 rounded-2xl border border-gray-800">
          <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No clients yet</h3>
          <p className="text-sm text-gray-600 mb-4">Ask your clients to share their trainer code with you</p>
          <button
            onClick={() => setShowAddClient(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium"
          >
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
              Ask your client to go to the <strong className="text-gray-300">Share</strong> tab in their app and give you their 6-digit code.
            </p>
            <input
              type="text"
              value={shareToken}
              onChange={(e) => setShareToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4 font-mono text-3xl text-center tracking-[0.3em]"
              autoFocus
            />

            {addResult?.error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" /> {addResult.error}
              </div>
            )}
            {addResult?.success && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Added {addResult.name}!
              </div>
            )}

            <button
              onClick={addClient}
              disabled={!shareToken.trim()}
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              Link Client
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
