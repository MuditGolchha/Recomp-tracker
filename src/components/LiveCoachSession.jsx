import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Play, Square, Plus, Trash2, Clock, Search, X } from 'lucide-react'

// Live coach-driven workout. Coach starts a session for the client when they arrive,
// logs sets/reps/weights as the client performs them. Writes to client's workout_sessions
// so the client sees it in their Gym page and Progress chart.
export default function LiveCoachSession({ clientId, clientName, coachId, onClose }) {
  const [exercises, setExercises] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [sets, setSets] = useState([])
  const [sessionName, setSessionName] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [timer, setTimer] = useState(null)
  const [exSearch, setExSearch] = useState('')
  const [newSet, setNewSet] = useState({ exercise_name: '', reps: '', weight_kg: '', rpe: '' })
  const [plannedWorkout, setPlannedWorkout] = useState(null)

  useEffect(() => {
    loadExercises()
    checkTodaysPlan()
  }, [])

  useEffect(() => {
    let interval
    if (timer) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  async function loadExercises() {
    const { data } = await supabase.from('exercises').select('*').order('name')
    setExercises(data || [])
  }

  async function checkTodaysPlan() {
    // Look for a planned workout scheduled for today for this client
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('planned_workouts')
      .select('*')
      .eq('client_id', clientId)
      .eq('scheduled_date', today)
      .maybeSingle()
    if (data) {
      setPlannedWorkout(data)
      setSessionName(data.name)
    }
  }

  async function startSession() {
    // Create a workout_session with user_id = clientId (the client owns it)
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: clientId,
        name: sessionName || (plannedWorkout?.name) || 'Workout',
        workout_date: format(new Date(), 'yyyy-MM-dd'),
      })
      .select()
      .single()

    if (error) {
      console.error('start session error:', error)
      alert('Could not start session: ' + error.message)
      return
    }
    setActiveSession(data)
    setSets([])
    setTimer(true)
    setSeconds(0)

    // If there's a planned workout, preload suggested exercises from planned_exercises
    if (plannedWorkout) {
      const { data: planned } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('planned_workout_id', plannedWorkout.id)
        .order('sort_order')
      if (planned && planned.length > 0) {
        // Use first planned exercise as a starting point
        setNewSet({
          exercise_name: planned[0].exercise_name,
          reps: planned[0].reps,
          weight_kg: planned[0].weight_kg || '',
          rpe: ''
        })
        setExSearch(planned[0].exercise_name)
      }
      // Mark planned as in-progress
      await supabase.from('planned_workouts').update({ status: 'completed' }).eq('id', plannedWorkout.id)
    }

    // Notify the client
    await supabase.from('notifications').insert({
      user_id: clientId,
      from_user_id: coachId,
      type: 'workout_assigned',
      title: 'Workout Started',
      message: `Your coach just started your "${sessionName || 'workout'}" session`,
      link: '/gym',
    })
  }

  async function endSession() {
    if (!activeSession) return
    await supabase
      .from('workout_sessions')
      .update({ duration_minutes: Math.round(seconds / 60) })
      .eq('id', activeSession.id)

    setActiveSession(null)
    setTimer(null)
    setSeconds(0)
    setSets([])

    // Close out
    onClose && onClose()
  }

  async function addSet() {
    if (!activeSession || !newSet.exercise_name) return
    const setNumber = sets.filter(s => s.exercise_name === newSet.exercise_name).length + 1
    const { data, error } = await supabase
      .from('workout_sets')
      .insert({
        session_id: activeSession.id,
        exercise_name: newSet.exercise_name,
        set_number: setNumber,
        reps: Number(newSet.reps) || null,
        weight_kg: Number(newSet.weight_kg) || null,
        rpe: Number(newSet.rpe) || null,
      })
      .select()
      .single()

    if (error) {
      console.error('add set error:', error)
      alert('Could not add set: ' + error.message)
      return
    }
    setSets([...sets, data])
    // keep exercise name for easy repeat sets
    setNewSet({ ...newSet, reps: '', weight_kg: '', rpe: '' })
  }

  async function removeSet(id) {
    await supabase.from('workout_sets').delete().eq('id', id)
    setSets(sets.filter(s => s.id !== id))
  }

  const filteredEx = exSearch.length >= 1
    ? exercises.filter(e =>
        e.name.toLowerCase().includes(exSearch.toLowerCase()) &&
        e.name.toLowerCase() !== exSearch.toLowerCase()
      ).slice(0, 6)
    : []

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // Group sets by exercise for display
  const groupedSets = sets.reduce((acc, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Live Session</h2>
            <p className="text-sm text-gray-400">with {clientName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {!activeSession ? (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
            {plannedWorkout ? (
              <div className="mb-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                <div className="text-xs text-emerald-400 mb-1">📅 Scheduled for today</div>
                <div className="text-white font-medium">{plannedWorkout.name}</div>
              </div>
            ) : null}

            <label className="block text-sm text-gray-400 mb-2">Session Name</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Push Day, Leg Day, Full Body..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              autoFocus
            />

            <button
              onClick={startSession}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
            >
              <Play className="w-4 h-4" /> Start Session
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Sets will be saved to {clientName}'s workout history.
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-2xl border border-emerald-500/30 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{activeSession.name}</h3>
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <Clock className="w-4 h-4" />
                  {formatTime(seconds)}
                </div>
              </div>
              <button
                onClick={endSession}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium"
              >
                <Square className="w-4 h-4" /> End
              </button>
            </div>

            {/* Exercise search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={exSearch}
                onChange={(e) => {
                  setExSearch(e.target.value)
                  setNewSet({ ...newSet, exercise_name: e.target.value })
                }}
                placeholder="Search exercise..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {filteredEx.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  {filteredEx.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => {
                        setNewSet({ ...newSet, exercise_name: ex.name })
                        setExSearch(ex.name)
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-white"
                    >
                      {ex.name} <span className="text-gray-500">- {ex.muscle_group}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Set inputs */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <input
                type="number"
                placeholder="Reps"
                value={newSet.reps}
                onChange={(e) => setNewSet({ ...newSet, reps: e.target.value })}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                placeholder="Weight (kg)"
                value={newSet.weight_kg}
                onChange={(e) => setNewSet({ ...newSet, weight_kg: e.target.value })}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                placeholder="RPE"
                value={newSet.rpe}
                onChange={(e) => setNewSet({ ...newSet, rpe: e.target.value })}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={addSet}
                disabled={!newSet.exercise_name || !newSet.reps}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Log
              </button>
            </div>

            {/* Sets grouped by exercise */}
            {Object.entries(groupedSets).length === 0 ? (
              <p className="text-center text-sm text-gray-600 py-4">
                No sets yet. Log the first set above.
              </p>
            ) : (
              Object.entries(groupedSets).map(([exName, exSets]) => (
                <div key={exName} className="mb-3">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">{exName}</h4>
                  <div className="space-y-1">
                    {exSets.map(set => (
                      <div
                        key={set.id}
                        className="flex items-center justify-between py-1.5 px-3 bg-gray-800/50 rounded-lg text-sm"
                      >
                        <span className="text-gray-400">Set {set.set_number}</span>
                        <span className="text-white">
                          {set.reps && `${set.reps} reps`}
                          {set.weight_kg && ` × ${set.weight_kg}kg`}
                          {set.rpe && ` @ RPE ${set.rpe}`}
                        </span>
                        <button
                          onClick={() => removeSet(set.id)}
                          className="text-gray-600 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
