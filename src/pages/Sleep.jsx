import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { QUALITY_LABELS } from '../lib/constants'
import { Moon, Plus, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

export default function Sleep() {
  const { user } = useAuth()
  const [sleepLog, setSleepLog] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    sleep_date: format(new Date(), 'yyyy-MM-dd'),
    bedtime: '23:00',
    wake_time: '07:00',
    quality: 3,
    notes: '',
  })

  useEffect(() => {
    if (user) loadSleep()
  }, [user])

  async function loadSleep() {
    const { data } = await supabase
      .from('sleep_log')
      .select('*')
      .eq('user_id', user.id)
      .order('sleep_date', { ascending: false })
      .limit(30)
    setSleepLog(data || [])
  }

  function calcDuration(bedtime, wakeTime) {
    const [bh, bm] = bedtime.split(':').map(Number)
    const [wh, wm] = wakeTime.split(':').map(Number)
    let hours = wh - bh + (wm - bm) / 60
    if (hours < 0) hours += 24
    return Math.round(hours * 10) / 10
  }

  async function saveSleep(e) {
    e.preventDefault()
    const duration = calcDuration(form.bedtime, form.wake_time)
    await supabase.from('sleep_log').upsert({
      user_id: user.id,
      sleep_date: form.sleep_date,
      bedtime: form.bedtime,
      wake_time: form.wake_time,
      duration_hours: duration,
      quality: form.quality,
      notes: form.notes,
    }, { onConflict: 'user_id,sleep_date' })
    setShowAdd(false)
    setForm({ sleep_date: format(new Date(), 'yyyy-MM-dd'), bedtime: '23:00', wake_time: '07:00', quality: 3, notes: '' })
    loadSleep()
  }

  async function deleteSleep(id) {
    await supabase.from('sleep_log').delete().eq('id', id)
    loadSleep()
  }

  const chartData = [...sleepLog].reverse().map(s => ({
    date: format(parseISO(s.sleep_date), 'MMM d'),
    hours: Number(s.duration_hours),
    quality: s.quality,
  }))

  const avgHours = sleepLog.length > 0
    ? (sleepLog.reduce((s, l) => s + Number(l.duration_hours), 0) / sleepLog.length).toFixed(1)
    : 0

  const avgQuality = sleepLog.length > 0
    ? (sleepLog.reduce((s, l) => s + (l.quality || 0), 0) / sleepLog.length).toFixed(1)
    : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Sleep Tracker</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Log Sleep
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <div className="text-sm text-gray-400 mb-1">Avg Duration</div>
          <div className="text-3xl font-bold text-white">{avgHours}h</div>
          <div className="text-xs text-gray-500 mt-1">Target: 7-8h</div>
        </div>
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
          <div className="text-sm text-gray-400 mb-1">Avg Quality</div>
          <div className="text-3xl font-bold text-white flex items-center gap-2">
            {avgQuality} <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
          </div>
          <div className="text-xs text-gray-500 mt-1">out of 5</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Sleep Duration</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} domain={[0, 12]} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <ReferenceLine y={7} stroke="#10b981" strokeDasharray="5 5" label={{ value: '7h target', fill: '#10b981', fontSize: 11 }} />
              <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-gray-600">
            No sleep data yet
          </div>
        )}
      </div>

      {/* Log */}
      <h2 className="text-lg font-semibold text-white mb-4">Recent Entries</h2>
      <div className="space-y-2">
        {sleepLog.map(entry => (
          <div key={entry.id} className="flex items-center justify-between bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-indigo-400" />
              <div>
                <div className="text-sm text-white">{format(parseISO(entry.sleep_date), 'EEE, MMM d')}</div>
                <div className="text-xs text-gray-500">
                  {entry.bedtime?.slice(0, 5)} → {entry.wake_time?.slice(0, 5)} · {entry.duration_hours}h
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm text-yellow-400">{'⭐'.repeat(entry.quality || 0)}</div>
              <button onClick={() => deleteSleep(entry.id)} className="text-gray-600 hover:text-red-400 text-xs">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Sleep Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <form onSubmit={saveSleep} className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Log Sleep</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Date</label>
                <input type="date" value={form.sleep_date} onChange={(e) => setForm({ ...form, sleep_date: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bedtime</label>
                  <input type="time" value={form.bedtime} onChange={(e) => setForm({ ...form, bedtime: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Wake Time</label>
                  <input type="time" value={form.wake_time} onChange={(e) => setForm({ ...form, wake_time: e.target.value })} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Quality</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(q => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setForm({ ...form, quality: q })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        form.quality === q
                          ? 'bg-indigo-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {q} {QUALITY_LABELS[q]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="How did you sleep?" className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button type="submit" className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors">
                Save
              </button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
