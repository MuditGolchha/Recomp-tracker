import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { Eye, Share2, Copy, Check, User, Utensils, Dumbbell, Moon, Scale } from 'lucide-react'

export default function TrainerView() {
  const { user, profile } = useAuth()
  const [copied, setCopied] = useState(false)
  const [trainerData, setTrainerData] = useState(null)
  const [viewToken, setViewToken] = useState('')

  // Check if we're in trainer view mode (via URL param)
  const urlParams = new URLSearchParams(window.location.search)
  const tokenFromUrl = urlParams.get('token')

  useEffect(() => {
    if (tokenFromUrl) {
      loadTrainerData(tokenFromUrl)
    }
  }, [tokenFromUrl])

  async function loadTrainerData(token) {
    const { data, error } = await supabase.rpc('get_trainer_view', { share_token: token })
    if (!error && data) {
      setTrainerData(data)
    }
  }

  async function loadPreview() {
    if (!viewToken) return
    loadTrainerData(viewToken)
  }

  function copyLink() {
    const link = `${window.location.origin}/trainer?token=${profile?.trainer_share_token}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Trainer view (read-only)
  if (tokenFromUrl || trainerData) {
    if (!trainerData) {
      return (
        <div className="text-center py-20">
          <Eye className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading trainer view...</p>
        </div>
      )
    }

    const p = trainerData.profile
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Eye className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Trainer View</h1>
        </div>

        {/* Client Info */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">{p.full_name || 'Client'}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Calories:</span> <span className="text-white">{p.target_calories}</span></div>
            <div><span className="text-gray-500">Protein:</span> <span className="text-white">{p.target_protein_g}g</span></div>
            <div><span className="text-gray-500">Carbs:</span> <span className="text-white">{p.target_carbs_g}g</span></div>
            <div><span className="text-gray-500">Fat:</span> <span className="text-white">{p.target_fat_g}g</span></div>
          </div>
        </div>

        {/* Recent Nutrition */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-green-400" /> This Week's Nutrition
          </h2>
          {trainerData.recent_food_log?.length > 0 ? (
            <div className="space-y-2">
              {trainerData.recent_food_log.map((f, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300">{f.custom_name || 'Food'}</span>
                  <span className="text-gray-500">
                    {f.logged_at} · {Math.round(f.calories)} kcal · {Math.round(f.protein_g)}p
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No food logged this week</p>
          )}
        </div>

        {/* Recent Workouts */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-orange-400" /> This Week's Workouts
          </h2>
          {trainerData.recent_workouts?.length > 0 ? (
            <div className="space-y-2">
              {trainerData.recent_workouts.map((w, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300">{w.name || 'Workout'}</span>
                  <span className="text-gray-500">{w.workout_date} · {w.duration_minutes || '?'} min</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No workouts this week</p>
          )}
        </div>

        {/* Recent Sleep */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-400" /> This Week's Sleep
          </h2>
          {trainerData.recent_sleep?.length > 0 ? (
            <div className="space-y-2">
              {trainerData.recent_sleep.map((s, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300">{s.sleep_date}</span>
                  <span className="text-gray-500">{s.duration_hours}h · Quality: {s.quality}/5</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No sleep data this week</p>
          )}
        </div>

        {/* Progress */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-400" /> Progress History
          </h2>
          {trainerData.progress?.length > 0 ? (
            <div className="space-y-2">
              {trainerData.progress.map((p, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-800 last:border-0">
                  <span className="text-gray-300">{p.recorded_date}</span>
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
    )
  }

  // Share view (for the user)
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Trainer View</h1>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Share2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Share with your trainer</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Share this link with your trainer so they can view your weekly nutrition, workouts, sleep, and progress (read-only).
        </p>

        {profile?.trainer_share_token ? (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/trainer?token=${profile.trainer_share_token}`}
              className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 text-sm font-mono"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Share token not available. Try logging out and back in.</p>
        )}
      </div>

      {/* Preview */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Preview</h2>
        <p className="text-sm text-gray-400 mb-4">Enter a share token to preview the trainer view:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={viewToken}
            onChange={(e) => setViewToken(e.target.value)}
            placeholder="Paste share token..."
            className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={loadPreview}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Preview
          </button>
        </div>
      </div>
    </div>
  )
}
