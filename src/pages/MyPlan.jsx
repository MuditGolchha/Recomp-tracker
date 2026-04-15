import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO, isToday, isFuture, isPast, addDays } from 'date-fns'
import {
  Calendar, Dumbbell, Clock, CheckCircle, XCircle, MessageSquare,
  ChevronDown, ChevronUp, Send, AlertCircle, ArrowRight,
} from 'lucide-react'

export default function MyPlan() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [workouts, setWorkouts] = useState([])
  const [exercises, setExercises] = useState({})
  const [expandedWorkout, setExpandedWorkout] = useState(null)
  const [attendance, setAttendance] = useState({})
  const [changeRequests, setChangeRequests] = useState({})
  const [newMessage, setNewMessage] = useState('')
  const [messageWorkoutId, setMessageWorkoutId] = useState(null)
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadData()
  }, [user])

  async function loadData() {
    setLoading(true)

    // Get coach link
    const { data: link } = await supabase
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!link) {
      setLoading(false)
      return
    }

    // Get coach name
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', link.coach_id)
      .single()
    if (coachProfile) setCoachName(coachProfile.full_name)

    // Get active programs assigned to me
    const { data: progs } = await supabase
      .from('workout_programs')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    setPrograms(progs || [])

    // Auto-select active program
    const active = (progs || []).find(p => p.status === 'active')
    if (active) {
      setSelectedProgram(active)
      await loadWorkouts(active.id)
    }

    // Load today's attendance
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: att } = await supabase
      .from('attendance')
      .select('*')
      .eq('client_id', user.id)
      .gte('date', format(addDays(new Date(), -7), 'yyyy-MM-dd'))
      .lte('date', today)
    const attMap = {}
    ;(att || []).forEach(a => { attMap[a.date] = a })
    setAttendance(attMap)

    // Load change requests
    const { data: requests } = await supabase
      .from('workout_change_requests')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
    const reqMap = {}
    ;(requests || []).forEach(r => { reqMap[r.planned_workout_id] = r })
    setChangeRequests(reqMap)

    setLoading(false)
  }

  async function loadWorkouts(programId) {
    const { data: wks } = await supabase
      .from('planned_workouts')
      .select('*')
      .eq('program_id', programId)
      .order('scheduled_date')

    setWorkouts(wks || [])

    // Load exercises for all workouts
    const ids = (wks || []).map(w => w.id)
    if (ids.length > 0) {
      const { data: exs } = await supabase
        .from('planned_exercises')
        .select('*')
        .in('planned_workout_id', ids)
        .order('sort_order')
      const exMap = {}
      ;(exs || []).forEach(e => {
        if (!exMap[e.planned_workout_id]) exMap[e.planned_workout_id] = []
        exMap[e.planned_workout_id].push(e)
      })
      setExercises(exMap)
    }
  }

  async function rsvpToday(status) {
    const today = format(new Date(), 'yyyy-MM-dd')

    // Get coach_id
    const { data: link } = await supabase
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!link) return

    const existing = attendance[today]
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert({
        coach_id: link.coach_id,
        client_id: user.id,
        date: today,
        status,
      })
    }

    // Refresh attendance
    const { data: att } = await supabase
      .from('attendance')
      .select('*')
      .eq('client_id', user.id)
      .eq('date', today)
      .single()
    setAttendance({ ...attendance, [today]: att })
  }

  async function sendChangeRequest(workoutId) {
    if (!newMessage.trim()) return

    const { data: link } = await supabase
      .from('coach_clients')
      .select('coach_id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (!link) return

    const { data, error } = await supabase
      .from('workout_change_requests')
      .insert({
        planned_workout_id: workoutId,
        client_id: user.id,
        coach_id: link.coach_id,
        message: newMessage.trim(),
        status: 'pending',
      })
      .select()
      .single()

    if (!error && data) {
      setChangeRequests({ ...changeRequests, [workoutId]: data })

      // Also send a notification to the coach
      await supabase.from('notifications').insert({
        user_id: link.coach_id,
        from_user_id: user.id,
        type: 'coach_message',
        title: 'Change Request',
        message: newMessage.trim(),
      })
    }

    setNewMessage('')
    setMessageWorkoutId(null)
  }

  async function markWorkoutDone(workoutId) {
    await supabase.from('planned_workouts').update({ status: 'completed' }).eq('id', workoutId)
    setWorkouts(workouts.map(w => w.id === workoutId ? { ...w, status: 'completed' } : w))
  }

  const today = format(new Date(), 'yyyy-MM-dd')
  const todayAttendance = attendance[today]
  const todayWorkout = workouts.find(w => w.scheduled_date === today)

  // Group workouts by week
  const weekGroups = {}
  workouts.forEach(w => {
    const wk = w.week_number || 1
    if (!weekGroups[wk]) weekGroups[wk] = []
    weekGroups[wk].push(w)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (programs.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-white mb-4">My Plan</h1>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-400 mb-1">No workout plan yet</h2>
          <p className="text-sm text-gray-600">
            {coachName
              ? `Your coach ${coachName} hasn't assigned a program yet. Check back soon!`
              : 'Connect with a coach to get a personalized workout plan.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Plan</h1>
          {coachName && <p className="text-sm text-gray-500 mt-0.5">Coach: {coachName}</p>}
        </div>
        {programs.length > 1 && (
          <select
            value={selectedProgram?.id || ''}
            onChange={(e) => {
              const prog = programs.find(p => p.id === e.target.value)
              setSelectedProgram(prog)
              if (prog) loadWorkouts(prog.id)
            }}
            className="px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name} {p.status !== 'active' ? `(${p.status})` : ''}</option>
            ))}
          </select>
        )}
      </div>

      {/* Program Info */}
      {selectedProgram && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{selectedProgram.name}</h2>
              {selectedProgram.description && <p className="text-sm text-gray-500 mt-0.5">{selectedProgram.description}</p>}
            </div>
            <div className="text-right">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                selectedProgram.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                selectedProgram.status === 'completed' ? 'bg-blue-500/10 text-blue-400' :
                'bg-gray-800 text-gray-500'
              }`}>
                {selectedProgram.status}
              </span>
              <div className="text-xs text-gray-600 mt-1">{selectedProgram.duration_weeks} weeks</div>
            </div>
          </div>
        </div>
      )}

      {/* Today's RSVP Card */}
      <div className="bg-gray-900 rounded-2xl border border-emerald-500/20 p-5 mb-6">
        <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Today — {format(new Date(), 'EEEE, MMM d')}
        </h3>

        {todayWorkout ? (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Dumbbell className="w-4 h-4 text-gray-400" />
              <span className="text-white font-medium">{todayWorkout.name}</span>
              {todayWorkout.status === 'completed' && (
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">Done</span>
              )}
            </div>
            {exercises[todayWorkout.id] && (
              <div className="text-xs text-gray-500 ml-6">
                {exercises[todayWorkout.id].map(e => e.exercise_name).join(', ')}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No workout scheduled for today</p>
        )}

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">Will you attend?</span>
          <div className="flex gap-2">
            <button onClick={() => rsvpToday('present')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                todayAttendance?.status === 'present'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-emerald-400'
              }`}>
              <CheckCircle className="w-3.5 h-3.5" /> Yes
            </button>
            <button onClick={() => rsvpToday('absent')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                todayAttendance?.status === 'absent'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-red-400'
              }`}>
              <XCircle className="w-3.5 h-3.5" /> No
            </button>
            <button onClick={() => rsvpToday('excused')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                todayAttendance?.status === 'excused'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-gray-800 text-gray-400 hover:text-yellow-400'
              }`}>
              <AlertCircle className="w-3.5 h-3.5" /> Maybe
            </button>
          </div>
        </div>

        {todayWorkout && todayWorkout.status !== 'completed' && (
          <button onClick={() => markWorkoutDone(todayWorkout.id)}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
            <CheckCircle className="w-4 h-4" /> Mark as Done
          </button>
        )}
      </div>

      {/* Weekly Workout Schedule */}
      {Object.entries(weekGroups).map(([weekNum, weekWorkouts]) => (
        <div key={weekNum} className="mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Week {weekNum}</h3>
          <div className="space-y-2">
            {weekWorkouts.map(workout => {
              const isExpanded = expandedWorkout === workout.id
              const wExercises = exercises[workout.id] || []
              const changeReq = changeRequests[workout.id]
              const isPastDay = isPast(parseISO(workout.scheduled_date)) && !isToday(parseISO(workout.scheduled_date))
              const isTodayWorkout = isToday(parseISO(workout.scheduled_date))

              return (
                <div key={workout.id} className={`bg-gray-900 rounded-xl border overflow-hidden ${
                  isTodayWorkout ? 'border-emerald-500/30' :
                  workout.status === 'completed' ? 'border-gray-800 opacity-70' :
                  'border-gray-800'
                }`}>
                  <button
                    onClick={() => setExpandedWorkout(isExpanded ? null : workout.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 text-left">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        workout.status === 'completed' ? 'bg-emerald-500/10' :
                        isTodayWorkout ? 'bg-emerald-500/10' :
                        'bg-gray-800'
                      }`}>
                        {workout.status === 'completed'
                          ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                          : <Dumbbell className={`w-4 h-4 ${isTodayWorkout ? 'text-emerald-400' : 'text-gray-500'}`} />
                        }
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{workout.name}</div>
                        <div className="text-xs text-gray-500">
                          {format(parseISO(workout.scheduled_date), 'EEE, MMM d')}
                          {isTodayWorkout && <span className="text-emerald-400 ml-1">• Today</span>}
                          {wExercises.length > 0 && <span className="ml-2">• {wExercises.length} exercises</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {changeReq && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          changeReq.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                          changeReq.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {changeReq.status === 'pending' ? 'Change Requested' :
                           changeReq.status === 'approved' ? 'Change Approved' : 'Change Declined'}
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-800 pt-3">
                      {/* Exercise list */}
                      {wExercises.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {wExercises.map((ex, i) => (
                            <div key={ex.id} className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-600 w-5">{i + 1}.</span>
                                <span className="text-sm text-white">{ex.exercise_name}</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {ex.sets} × {ex.reps}
                                {ex.weight_kg && ` @ ${ex.weight_kg}kg`}
                                {ex.rest_seconds && <span className="ml-2"><Clock className="w-3 h-3 inline" /> {ex.rest_seconds}s rest</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 mb-4">No exercises listed for this workout yet.</p>
                      )}

                      {workout.notes && (
                        <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-800/30 rounded-lg">
                          <span className="text-gray-400 font-medium">Coach note:</span> {workout.notes}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {workout.status !== 'completed' && !isPastDay && (
                          <button onClick={() => markWorkoutDone(workout.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> Mark Done
                          </button>
                        )}

                        {!changeReq && isFuture(parseISO(workout.scheduled_date)) && (
                          <button onClick={() => setMessageWorkoutId(messageWorkoutId === workout.id ? null : workout.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs font-medium transition-colors">
                            <MessageSquare className="w-3.5 h-3.5" /> Request Change
                          </button>
                        )}
                      </div>

                      {/* Change request form */}
                      {messageWorkoutId === workout.id && (
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="e.g. Can we swap squats for leg press?"
                            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') sendChangeRequest(workout.id) }}
                          />
                          <button onClick={() => sendChangeRequest(workout.id)}
                            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm">
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Show existing change request */}
                      {changeReq && (
                        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                          <div className="text-xs text-gray-500 mb-1">Your request:</div>
                          <div className="text-sm text-gray-300">{changeReq.message}</div>
                          {changeReq.coach_reply && (
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                              <div className="text-xs text-gray-500 mb-1">Coach reply:</div>
                              <div className="text-sm text-gray-300">{changeReq.coach_reply}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
