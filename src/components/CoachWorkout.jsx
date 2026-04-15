import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { Play, Square, Clock, Search, Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react'

export default function CoachWorkout({ clientId, clientName, coachId }) {
  const [exercises, setExercises] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [sets, setSets] = useState([])
  const [sessionName, setSessionName] = useState('')
  const [showStart, setShowStart] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [filteredExercises, setFilteredExercises] = useState([])
  const [newSet, setNewSet] = useState({ exercise_name: '', reps: '', weight_kg: '', rpe: '' })
  const [timer, setTimer] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [recentSessions, setRecentSessions] = useState([])
  const [expandedSession, setExpandedSession] = useState(null)
  const [expandedSets, setExpandedSets] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadExercises()
    loadRecentSessions()
  }, [clientId])

  useEffect(() => {
    let interval
    if (timer) {
      interval = setInterval(() => setSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(interval)
  }, [timer])

  useEffect(() => {
    if (exerciseSearch.length >= 1) {
      setFilteredExercises(
        exercises.filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase())).slice(0, 8)
      )
    } else {
      setFilteredExercises([])
    }
  }, [exerciseSearch, exercises])

  async function loadExercises() {
    const { data } = await supabase.from('exercises').select('*').order('name')
    setExercises(data || [])
  }

  async function loadRecentSessions() {
    const { data } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', clientId)
      .order('workout_date', { ascending: false })
      .limit(10)
    setRecentSessions(data || [])
  }

  async function startSession() {
    setSaving(true)
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: clientId,
        name: sessionName || `${clientName}'s Workout`,
        workout_date: format(new Date(), 'yyyy-MM-dd'),
      })
      .select()
      .single()

    if (!error && data) {
      setActiveSession(data)
      setSets([])
      setShowStart(false)
      setSessionName('')
      setTimer(true)
      setSeconds(0)
    }
    setSaving(false)
  }

  async function endSession() {
    if (!activeSession) return
    setSaving(true)
    await supabase
      .from('workout_sessions')
      .update({ duration_minutes: Math.round(seconds / 60) || 1 })
      .eq('id', activeSession.id)
    setActiveSession(null)
    setTimer(null)
    setSeconds(0)
    setSaving(false)
    loadRecentSessions()
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

    if (!error && data) {
      setSets([...sets, data])
      setNewSet({ ...newSet, reps: '', weight_kg: '', rpe: '' })
    }
  }

  async function removeSet(id) {
    await supabase.from('workout_sets').delete().eq('id', id)
    setSets(sets.filter(s => s.id !== id))
  }

  async function toggleExpandSession(sessionId) {
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

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  // Group current sets by exercise
  const groupedSets = sets.reduce((acc, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set)
    return acc
  }, {})

  // Group expanded session sets by exercise
  const groupedExpandedSets = expandedSets.reduce((acc, set) => {
    if (!acc[set.exercise_name]) acc[set.exercise_name] = []
    acc[set.exercise_name].push(set)
    return acc
  }, {})

  return (
    <div>
      {/* Active Session */}
      {activeSession ? (
        <div className="bg-gray-900 rounded-xl border-2 border-emerald-500/30 p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {activeSession.name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-emerald-400 mt-1">
                <Clock className="w-4 h-4" />
                {formatTime(seconds)}
              </div>
            </div>
            <button onClick={endSession} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium">
              <Square className="w-4 h-4" /> End Session
            </button>
          </div>

          {/* Exercise Search */}
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={exerciseSearch}
              onChange={(e) => { setExerciseSearch(e.target.value); setNewSet({ ...newSet, exercise_name: e.target.value }) }}
              placeholder="Search exercise..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
            {filteredExercises.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {filteredExercises.map(ex => (
                  <button key={ex.id}
                    onClick={() => { setNewSet({ ...newSet, exercise_name: ex.name }); setExerciseSearch(ex.name); setFilteredExercises([]) }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm text-white">
                    {ex.name} <span className="text-gray-500">- {ex.muscle_group}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Set Inputs */}
          <div className="flex gap-2 mb-4">
            <input type="number" placeholder="Reps" value={newSet.reps}
              onChange={(e) => setNewSet({ ...newSet, reps: e.target.value })}
              className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => e.key === 'Enter' && addSet()} />
            <input type="number" placeholder="Weight (kg)" value={newSet.weight_kg}
              onChange={(e) => setNewSet({ ...newSet, weight_kg: e.target.value })}
              className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => e.key === 'Enter' && addSet()} />
            <input type="number" placeholder="RPE" value={newSet.rpe}
              onChange={(e) => setNewSet({ ...newSet, rpe: e.target.value })}
              className="w-20 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => e.key === 'Enter' && addSet()} />
            <button onClick={addSet} disabled={!newSet.exercise_name}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Live Sets */}
          {Object.entries(groupedSets).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(groupedSets).map(([exerciseName, exerciseSets]) => (
                <div key={exerciseName} className="bg-gray-800/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">{exerciseName}</h4>
                  <div className="space-y-1">
                    {exerciseSets.map(set => (
                      <div key={set.id} className="flex items-center justify-between py-1.5 px-2 bg-gray-800 rounded text-sm">
                        <span className="text-gray-400 w-12">Set {set.set_number}</span>
                        <span className="text-white flex-1 text-center">
                          {set.reps && `${set.reps} reps`}
                          {set.weight_kg && ` x ${set.weight_kg}kg`}
                          {set.rpe && ` @RPE ${set.rpe}`}
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
          ) : (
            <div className="text-center py-6 text-gray-600 text-sm">
              Add exercises and log sets as your client performs them
            </div>
          )}
        </div>
      ) : (
        /* Start New Session */
        <div className="mb-6">
          {showStart ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <h3 className="text-sm font-medium text-white mb-3">Start Live Workout</h3>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder={`${clientName}'s Workout (e.g. Push Day)`}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3 text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={startSession} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium">
                  <Play className="w-4 h-4" /> Start Session
                </button>
                <button onClick={() => setShowStart(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowStart(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl transition-colors text-sm font-medium">
              <Play className="w-4 h-4" /> Start Live Workout for {clientName}
            </button>
          )}
        </div>
      )}

      {/* Recent Sessions */}
      <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Workouts</h3>
      {recentSessions.length > 0 ? (
        <div className="space-y-2">
          {recentSessions.map(session => (
            <div key={session.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <button
                onClick={() => toggleExpandSession(session.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-800/50 transition-colors"
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-white">{session.name || 'Workout'}</div>
                  <div className="text-xs text-gray-500">
                    {session.workout_date}
                    {session.duration_minutes && ` - ${session.duration_minutes} min`}
                  </div>
                </div>
                {expandedSession === session.id
                  ? <ChevronUp className="w-4 h-4 text-gray-500" />
                  : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {expandedSession === session.id && (
                <div className="px-3 pb-3 border-t border-gray-800 pt-2">
                  {Object.entries(groupedExpandedSets).length > 0 ? (
                    Object.entries(groupedExpandedSets).map(([name, eSets]) => (
                      <div key={name} className="mb-2">
                        <div className="text-xs font-medium text-gray-300">{name}</div>
                        <div className="text-xs text-gray-500">
                          {eSets.map(s => `${s.reps || '?'} x ${s.weight_kg || '?'}kg`).join(' / ')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-600">No sets recorded</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-600 text-sm">No workout history yet</div>
      )}
    </div>
  )
}
