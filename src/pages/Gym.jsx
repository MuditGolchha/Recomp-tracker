import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, Play, Square, Clock, Search, ChevronDown, ChevronUp } from 'lucide-react'

export default function Gym() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [sets, setSets] = useState([])
  const [showNewSession, setShowNewSession] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [filteredExercises, setFilteredExercises] = useState([])
  const [expandedSessions, setExpandedSessions] = useState({})
  const [newSet, setNewSet] = useState({ exercise_name: '', reps: '', weight_kg: '', rpe: '' })
  const [timer, setTimer] = useState(null)
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    if (user) {
      loadSessions()
      loadExercises()
    }
  }, [user])

  useEffect(() => {
    let interval
    if (timer) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  async function loadSessions() {
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('workout_date', { ascending: false })
      .limit(20)
    setSessions(data || [])
  }

  async function loadExercises() {
    const { data } = await supabase.from('exercises').select('*').order('name')
    setExercises(data || [])
  }

  async function loadSets(sessionId) {
    const { data } = await supabase
      .from('workout_sets')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at')
    return data || []
  }

  async function startSession() {
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({ user_id: user.id, name: sessionName || 'Workout', workout_date: format(new Date(), 'yyyy-MM-dd') })
      .select()
      .single()
    if (error || !data) return
    setActiveSession(data)
    setSets([])
    setShowNewSession(false)
    setSessionName('')
    setTimer(true)
    setSeconds(0)
    loadSessions()
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
    loadSessions()
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
    if (error || !data) return
    setSets([...sets, data])
    setNewSet({ ...newSet, reps: '', weight_kg: '', rpe: '' })
  }

  async function removeSet(id) {
    await supabase.from('workout_sets').delete().eq('id', id)
    setSets(sets.filter(s => s.id !== id))
  }

  async function toggleExpand(sessionId) {
    if (expandedSessions[sessionId]) {
      setExpandedSessions({ ...expandedSessions, [sessionId]: null })
    } else {
      const data = await loadSets(sessionId)
      setExpandedSessions({ ...expandedSessions, [sessionId]: data })
    }
  }

  async function deleteSession(sessionId) {
    await supabase.from('workout_sessions').delete().eq('id', sessionId)
    loadSessions()
  }

  useEffect(() => {
    if (exerciseSearch.length >= 1) {
      setFilteredExercises(
        exercises.filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) && e.name.toLowerCase() !== exerciseSearch.toLowerCase()).slice(0, 8)
      )
    } else {
      setFilteredExercises([])
    }
  }, [exerciseSearch, exercises])

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // Group sets by exercise
  const groupedSets = sets.reduce((acc, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set)
    return acc
  }, {})

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Gym Log</h1>
        {!activeSession && (
          <button
            onClick={() => setShowNewSession(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Play className="w-4 h-4" /> Start Workout
          </button>
        )}
      </div>

      {/* New Session Form */}
      {showNewSession && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-6">
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Workout name (e.g. Push Day, Leg Day)"
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={startSession} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium">
              Start
            </button>
            <button onClick={() => setShowNewSession(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Session */}
      {activeSession && (
        <div className="bg-gray-900 rounded-2xl border border-emerald-500/30 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{activeSession.name}</h2>
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <Clock className="w-4 h-4" />
                {formatTime(seconds)}
              </div>
            </div>
            <button
              onClick={endSession}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium"
            >
              <Square className="w-4 h-4" /> End Workout
            </button>
          </div>

          {/* Add Exercise */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={exerciseSearch}
                onChange={(e) => { setExerciseSearch(e.target.value); setNewSet({ ...newSet, exercise_name: e.target.value }) }}
                placeholder="Search exercise..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              {filteredExercises.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                  {filteredExercises.map(ex => (
                    <button
                      key={ex.id}
                      onClick={() => { setNewSet({ ...newSet, exercise_name: ex.name }); setExerciseSearch(ex.name); setFilteredExercises([]) }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-white"
                    >
                      {ex.name} <span className="text-gray-500">· {ex.muscle_group}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Set inputs */}
          <div className="flex gap-2 mb-4">
            <input type="number" placeholder="Reps" value={newSet.reps} onChange={(e) => setNewSet({ ...newSet, reps: e.target.value })} className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="number" placeholder="Weight (kg)" value={newSet.weight_kg} onChange={(e) => setNewSet({ ...newSet, weight_kg: e.target.value })} className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <input type="number" placeholder="RPE" value={newSet.rpe} onChange={(e) => setNewSet({ ...newSet, rpe: e.target.value })} className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={addSet} disabled={!newSet.exercise_name} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Sets grouped by exercise */}
          {Object.entries(groupedSets).map(([exerciseName, exerciseSets]) => (
            <div key={exerciseName} className="mb-3">
              <h4 className="text-sm font-medium text-gray-300 mb-2">{exerciseName}</h4>
              <div className="space-y-1">
                {exerciseSets.map(set => (
                  <div key={set.id} className="flex items-center justify-between py-1.5 px-3 bg-gray-800/50 rounded-lg text-sm">
                    <span className="text-gray-400">Set {set.set_number}</span>
                    <span className="text-white">
                      {set.reps && `${set.reps} reps`}
                      {set.weight_kg && ` × ${set.weight_kg}kg`}
                      {set.rpe && ` @ RPE ${set.rpe}`}
                    </span>
                    <button onClick={() => removeSet(set.id)} className="text-gray-600 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Past Sessions */}
      <h2 className="text-lg font-semibold text-white mb-4">History</h2>
      <div className="space-y-3">
        {sessions.map(session => (
          <div key={session.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <button
              onClick={() => toggleExpand(session.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
            >
              <div className="text-left">
                <div className="text-sm font-medium text-white">{session.name || 'Workout'}</div>
                <div className="text-xs text-gray-500">
                  {format(parseISO(session.workout_date), 'MMM d, yyyy')}
                  {session.duration_minutes && ` · ${session.duration_minutes} min`}
                </div>
              </div>
              {expandedSessions[session.id] ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {expandedSessions[session.id] && (
              <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                {expandedSessions[session.id].length > 0 ? (
                  <div className="space-y-1">
                    {expandedSessions[session.id].map(set => (
                      <div key={set.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-300">{set.exercise_name}</span>
                        <span className="text-gray-500">
                          {set.reps && `${set.reps} × `}{set.weight_kg && `${set.weight_kg}kg`}{set.rpe && ` @${set.rpe}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No sets recorded</p>
                )}
                <button
                  onClick={() => deleteSession(session.id)}
                  className="mt-3 text-xs text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Delete session
                </button>
              </div>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            No workouts yet. Start your first session!
          </div>
        )}
      </div>
    </div>
  )
}
