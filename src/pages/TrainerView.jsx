import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Share2, Copy, Check, RefreshCw } from 'lucide-react'

export default function TrainerView() {
  const { user, profile, fetchProfile } = useAuth()
  const [copied, setCopied] = useState(false)

  // Check if accessed via /trainer?token=xxx (public read-only view)
  const urlParams = new URLSearchParams(window.location.search)
  const tokenFromUrl = urlParams.get('token')

  if (tokenFromUrl) {
    return <PublicTrainerView token={tokenFromUrl} />
  }

  function copyCode() {
    if (!profile?.trainer_share_token) return
    navigator.clipboard.writeText(profile.trainer_share_token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateCode() {
    const newCode = String(Math.floor(Math.random() * 1000000)).padStart(6, '0')
    await supabase
      .from('profiles')
      .update({ trainer_share_token: newCode })
      .eq('id', user.id)
    fetchProfile(user.id)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Share with Coach</h1>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Share2 className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Your Share Code</h2>
        </div>
        <p className="text-sm text-gray-400 mb-6">
          Give this code to your coach. They'll enter it in their Coach Dashboard to link your account.
        </p>

        {profile?.trainer_share_token ? (
          <div>
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="text-5xl font-mono font-bold text-white tracking-[0.3em] bg-gray-800 px-8 py-4 rounded-xl border border-gray-700">
                {profile.trainer_share_token}
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <button
                onClick={regenerateCode}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                New Code
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center">Loading your share code...</p>
        )}
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-md font-semibold text-white mb-3">How it works</h3>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
            <span>Share your 6-digit code with your coach</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
            <span>Your coach signs up on this app and goes to the <strong className="text-gray-300">Coach</strong> tab</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <span>They click <strong className="text-gray-300">Add Client</strong> and enter your code</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <span>Your coach can now see your nutrition, workouts, sleep, and progress</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PublicTrainerView({ token }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    loadData()
  }, [token])

  async function loadData() {
    const { data: result, error: err } = await supabase.rpc('get_trainer_view', { share_token: token })
    if (err || !result) setError(true)
    else setData(result)
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>
  if (error || !data) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-400 text-lg mb-2">Invalid or expired link</p>
        <p className="text-gray-600 text-sm">Ask your client for a new share code</p>
      </div>
    </div>
  )

  const p = data.profile
  const foodLog = data.recent_food_log || []
  const workouts = data.recent_workouts || []
  const sleepLog = data.recent_sleep || []
  const progress = data.progress || []

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{p?.full_name || 'Client'}</h1>
      <p className="text-sm text-gray-500 mb-8">Target: {p?.target_calories} kcal · {p?.target_protein_g}g protein</p>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">This Week's Nutrition</h2>
        {foodLog.length > 0 ? foodLog.map((f, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span className="text-gray-300">{f.custom_name || 'Food'}</span>
            <span className="text-gray-500">{Math.round(f.calories)} kcal · {Math.round(f.protein_g)}p</span>
          </div>
        )) : <p className="text-sm text-gray-600">Nothing logged</p>}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Workouts</h2>
        {workouts.length > 0 ? workouts.map((w, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span className="text-gray-300">{w.name || 'Workout'}</span>
            <span className="text-gray-500">{w.workout_date}</span>
          </div>
        )) : <p className="text-sm text-gray-600">No workouts</p>}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Sleep</h2>
        {sleepLog.length > 0 ? sleepLog.map((s, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span className="text-gray-300">{s.sleep_date}</span>
            <span className="text-gray-500">{s.duration_hours}h · {s.quality}/5</span>
          </div>
        )) : <p className="text-sm text-gray-600">No sleep data</p>}
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Progress</h2>
        {progress.length > 0 ? progress.map((p, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span className="text-gray-300">{p.recorded_date}</span>
            <span className="text-gray-500">{p.weight_kg && `${p.weight_kg}kg`}{p.waist_cm && ` · ${p.waist_cm}cm`}</span>
          </div>
        )) : <p className="text-sm text-gray-600">No data</p>}
      </div>
    </div>
  )
}
