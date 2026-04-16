import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { Plus, Camera, Scale, Ruler, Trash2, Dumbbell, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Progress() {
  const { user, profile } = useAuth()
  const [entries, setEntries] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    recorded_date: format(new Date(), 'yyyy-MM-dd'),
    weight_kg: '',
    waist_cm: '',
    body_fat_pct: '',
    notes: '',
  })
  const [photos, setPhotos] = useState([])
  const [strengthData, setStrengthData] = useState({})
  const [selectedExercise, setSelectedExercise] = useState('')

  useEffect(() => {
    if (user) {
      loadProgress()
      loadStrength()
    }
  }, [user])

  async function loadProgress() {
    const { data } = await supabase
      .from('weekly_progress')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_date', { ascending: false })
    setEntries(data || [])
  }

  async function loadStrength() {
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('id, workout_date')
      .eq('user_id', user.id)
      .order('workout_date')
    if (!sessions || sessions.length === 0) return

    const sessionMap = {}
    sessions.forEach(s => { sessionMap[s.id] = s.workout_date })

    const { data: sets } = await supabase
      .from('workout_sets')
      .select('session_id, exercise_name, reps, weight_kg')
      .in('session_id', sessions.map(s => s.id))
    if (!sets || sets.length === 0) return

    const byEx = {}
    sets.forEach(set => {
      if (!set.weight_kg || !set.reps) return
      const date = sessionMap[set.session_id]
      if (!date) return
      const key = set.exercise_name
      if (!byEx[key]) byEx[key] = {}
      const e1rm = Number(set.weight_kg) * (1 + Number(set.reps) / 30)
      if (!byEx[key][date] || e1rm > byEx[key][date].e1rm) {
        byEx[key][date] = { e1rm, weight: Number(set.weight_kg), reps: Number(set.reps) }
      }
    })

    const result = {}
    Object.entries(byEx).forEach(([ex, dates]) => {
      result[ex] = Object.entries(dates)
        .map(([date, v]) => ({ date: format(parseISO(date), 'MMM d'), weight: v.weight, e1rm: Math.round(v.e1rm * 10) / 10, reps: v.reps }))
        .sort()
    })
    setStrengthData(result)
    const exNames = Object.keys(result)
    if (exNames.length > 0 && !selectedExercise) setSelectedExercise(exNames[0])
  }

  async function saveProgress(e) {
    e.preventDefault()
    const { data, error } = await supabase
      .from('weekly_progress')
      .insert({
        user_id: user.id,
        recorded_date: form.recorded_date,
        weight_kg: Number(form.weight_kg) || null,
        waist_cm: Number(form.waist_cm) || null,
        body_fat_pct: Number(form.body_fat_pct) || null,
        notes: form.notes,
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to save progress:', error?.message)
      return
    }

    // Upload photos if any
    for (const photo of photos) {
      const ext = photo.name.split('.').pop()
      const path = `${user.id}/${data.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(path, photo)

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('progress-photos')
          .getPublicUrl(path)

        await supabase.from('progress_photos').insert({
          user_id: user.id,
          progress_id: data.id,
          photo_url: urlData.publicUrl,
          photo_type: 'front',
          taken_at: form.recorded_date,
        })
      }
    }

    setShowAdd(false)
    setForm({ recorded_date: format(new Date(), 'yyyy-MM-dd'), weight_kg: '', waist_cm: '', body_fat_pct: '', notes: '' })
    setPhotos([])
    loadProgress()
  }

  async function deleteEntry(id) {
    await supabase.from('weekly_progress').delete().eq('id', id)
    loadProgress()
  }

  const weightChart = [...entries].reverse().filter(e => e.weight_kg).map(e => ({
    date: format(parseISO(e.recorded_date), 'MMM d'),
    weight: Number(e.weight_kg),
  }))

  const waistChart = [...entries].reverse().filter(e => e.waist_cm).map(e => ({
    date: format(parseISO(e.recorded_date), 'MMM d'),
    waist: Number(e.waist_cm),
  }))

  const latestWeight = entries.find(e => e.weight_kg)?.weight_kg
  const startWeight = profile?.start_weight_kg || entries[entries.length - 1]?.weight_kg || null
  const weightChange = latestWeight && startWeight ? (latestWeight - startWeight).toFixed(1) : null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Weekly Progress</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Log Progress
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <Scale className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-2xl font-bold text-white">{latestWeight || '--'} kg</div>
          {weightChange && (
            <div className={`text-xs mt-1 ${Number(weightChange) >= 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {Number(weightChange) >= 0 ? '+' : ''}{weightChange} kg from start
            </div>
          )}
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <Ruler className="w-5 h-5 text-purple-400 mb-2" />
          <div className="text-2xl font-bold text-white">
            {entries.find(e => e.waist_cm)?.waist_cm || '--'} cm
          </div>
          <div className="text-xs text-gray-500 mt-1">Waist</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <Camera className="w-5 h-5 text-emerald-400 mb-2" />
          <div className="text-2xl font-bold text-white">{entries.length}</div>
          <div className="text-xs text-gray-500 mt-1">Check-ins</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Weight Trend</h2>
          {weightChart.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              Need at least 2 entries to show trend
            </div>
          )}
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Waist Trend</h2>
          {waistChart.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={waistChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="waist" stroke="#a855f7" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              Need at least 2 entries to show trend
            </div>
          )}
        </div>
      </div>

      {/* Strength Progress */}
      {Object.keys(strengthData).length > 0 && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-semibold text-white">Strength Progress</h2>
            </div>
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
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-gray-800/50 rounded-xl text-center">
                  <div className="text-xs text-gray-500 mb-1">Top Weight</div>
                  <div className="text-xl font-bold text-emerald-400">
                    {Math.max(...strengthData[selectedExercise].map(d => d.weight))} kg
                  </div>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-xl text-center">
                  <div className="text-xs text-gray-500 mb-1">Est. 1RM</div>
                  <div className="text-xl font-bold text-blue-400">
                    {Math.max(...strengthData[selectedExercise].map(d => d.e1rm))} kg
                  </div>
                </div>
                <div className="p-3 bg-gray-800/50 rounded-xl text-center">
                  <div className="text-xs text-gray-500 mb-1">Sessions</div>
                  <div className="text-xl font-bold text-white">
                    {strengthData[selectedExercise].length}
                  </div>
                </div>
              </div>
              {strengthData[selectedExercise].length > 1 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={strengthData[selectedExercise]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="weight" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Weight (kg)" />
                    <Line type="monotone" dataKey="e1rm" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} name="Est. 1RM" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-600 text-sm">
                  Log more sessions to see your strength trend
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* History */}
      <h2 className="text-lg font-semibold text-white mb-4">History</h2>
      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className="flex items-center justify-between bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div>
              <div className="text-sm font-medium text-white">{format(parseISO(entry.recorded_date), 'EEE, MMM d, yyyy')}</div>
              <div className="text-xs text-gray-500 mt-1">
                {entry.weight_kg && `${entry.weight_kg}kg`}
                {entry.waist_cm && ` · ${entry.waist_cm}cm waist`}
                {entry.body_fat_pct && ` · ${entry.body_fat_pct}% BF`}
              </div>
              {entry.notes && <div className="text-xs text-gray-600 mt-1">{entry.notes}</div>}
            </div>
            <button onClick={() => deleteEntry(entry.id)} className="text-gray-600 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Progress Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <form onSubmit={saveProgress} className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Log Progress</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Date</label>
                <input type="date" value={form.recorded_date} onChange={(e) => setForm({ ...form, recorded_date: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Weight (kg)</label>
                  <input type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} placeholder="60.0" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Waist (cm)</label>
                  <input type="number" step="0.1" value={form.waist_cm} onChange={(e) => setForm({ ...form, waist_cm: e.target.value })} placeholder="76" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Body Fat %</label>
                  <input type="number" step="0.1" value={form.body_fat_pct} onChange={(e) => setForm({ ...form, body_fat_pct: e.target.value })} placeholder="18" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Progress Photos</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotos(Array.from(e.target.files))}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-800 file:text-gray-300 file:cursor-pointer hover:file:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="How are things going?" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="submit" className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors">Save</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
