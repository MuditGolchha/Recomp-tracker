import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Target, ChevronRight, ChevronLeft, Loader2, Flame, Dumbbell, Scale, Heart, Leaf, Activity } from 'lucide-react'

const GOALS = [
  { id: 'lose_fat', label: 'Lose Fat', desc: 'Cut body fat while preserving muscle', icon: Flame, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  { id: 'build_muscle', label: 'Build Muscle', desc: 'Gain lean mass with minimal fat', icon: Dumbbell, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { id: 'recomp', label: 'Body Recomp', desc: 'Lose fat and build muscle at the same time', icon: Target, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'maintain', label: 'Stay Healthy', desc: 'Maintain current physique and health', icon: Heart, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
]

const BODY_TYPES = [
  { id: 'lean', label: 'Lean', desc: 'Visible muscle definition, low body fat', img: '🏃' },
  { id: 'athletic', label: 'Athletic', desc: 'Muscular with some definition', img: '💪' },
  { id: 'average', label: 'Average', desc: 'Some muscle, moderate body fat', img: '🧍' },
  { id: 'heavy', label: 'Heavy', desc: 'Higher body fat, working on changing', img: '🎯' },
]

const DIET_TYPES = [
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
  { id: 'non_veg', label: 'Non-Vegetarian', icon: '🍗' },
  { id: 'eggetarian', label: 'Eggetarian', icon: '🥚' },
]

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise, desk job', multiplier: 1.2 },
  { id: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week', multiplier: 1.375 },
  { id: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week', multiplier: 1.55 },
  { id: 'very_active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week', multiplier: 1.725 },
]

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'Beginner', desc: 'New to working out (< 6 months)' },
  { id: 'intermediate', label: 'Intermediate', desc: '6 months to 2 years of training' },
  { id: 'advanced', label: 'Advanced', desc: '2+ years of consistent training' },
]

export default function Onboarding() {
  const { user, fetchProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    goal: '',
    body_type: '',
    diet_type: 'vegetarian',
    activity_level: 'moderate',
    experience_level: 'beginner',
    age: '',
    gender: 'male',
    height_cm: '',
    weight_kg: '',
    target_weight_kg: '',
    deadline: '',
    is_coach: false,
  })

  function calcTargets() {
    const weight = Number(data.weight_kg) || 60
    const height = Number(data.height_cm) || 165
    const age = Number(data.age) || 25
    const isMale = data.gender === 'male'

    // Mifflin-St Jeor
    let bmr = isMale
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161

    const activity = ACTIVITY_LEVELS.find(a => a.id === data.activity_level)
    let tdee = Math.round(bmr * (activity?.multiplier || 1.55))

    let calories, proteinG, carbsG, fatG
    switch (data.goal) {
      case 'lose_fat':
        calories = Math.round(tdee * 0.8)
        proteinG = Math.round(weight * 2.2)
        break
      case 'build_muscle':
        calories = Math.round(tdee * 1.1)
        proteinG = Math.round(weight * 2.0)
        break
      case 'recomp':
        calories = tdee
        proteinG = Math.round(weight * 2.2)
        break
      default:
        calories = tdee
        proteinG = Math.round(weight * 1.8)
    }

    fatG = Math.round(weight * 0.9)
    const fatCals = fatG * 9
    const proteinCals = proteinG * 4
    carbsG = Math.round((calories - proteinCals - fatCals) / 4)
    if (carbsG < 50) carbsG = 50

    return { calories, proteinG, carbsG, fatG }
  }

  async function finish() {
    setSaving(true)
    const targets = calcTargets()

    const { error } = await supabase
      .from('profiles')
      .update({
        goal: data.goal,
        body_type: data.body_type,
        diet_type: data.diet_type,
        activity_level: data.activity_level,
        experience_level: data.experience_level,
        age: Number(data.age) || null,
        gender: data.gender,
        height_cm: Number(data.height_cm) || null,
        start_weight_kg: Number(data.weight_kg) || null,
        target_weight_kg: Number(data.target_weight_kg) || null,
        target_calories: targets.calories,
        target_protein_g: targets.proteinG,
        target_carbs_g: targets.carbsG,
        target_fat_g: targets.fatG,
        deadline: data.deadline || null,
        is_coach: data.is_coach,
        onboarding_completed: true,
      })
      .eq('id', user.id)

    if (!error) {
      await fetchProfile(user.id)
    }
    setSaving(false)
  }

  const totalSteps = 5
  const progress = ((step + 1) / totalSteps) * 100

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-emerald-400" />
              <span className="font-bold text-lg text-white">RecompTracker</span>
            </div>
            <span className="text-xs text-gray-500">Step {step + 1} of {totalSteps}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Step 0: Goal */}
        {step === 0 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-white mb-2">What's your goal?</h1>
            <p className="text-gray-400 text-sm mb-6">This helps us customize your targets and tracking.</p>
            <div className="space-y-3">
              {GOALS.map(g => {
                const Icon = g.icon
                return (
                  <button
                    key={g.id}
                    onClick={() => setData({ ...data, goal: g.id })}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                      data.goal === g.id
                        ? g.color + ' border-2'
                        : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${data.goal === g.id ? '' : 'bg-gray-800'}`}>
                      <Icon className={`w-5 h-5 ${data.goal === g.id ? '' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{g.label}</div>
                      <div className="text-xs text-gray-500">{g.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Are you a coach? */}
            <div className="mt-6 p-4 bg-gray-900 rounded-xl border border-gray-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.is_coach}
                  onChange={(e) => setData({ ...data, is_coach: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-sm font-medium text-white">I'm a coach / trainer</div>
                  <div className="text-xs text-gray-500">Enable the Coach Dashboard to manage clients</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Step 1: Body Stats */}
        {step === 1 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-white mb-2">Tell us about yourself</h1>
            <p className="text-gray-400 text-sm mb-6">We'll use this to calculate your ideal macros.</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Age</label>
                  <input type="number" value={data.age} onChange={(e) => setData({ ...data, age: e.target.value })} placeholder="27" className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Gender</label>
                  <div className="flex gap-2">
                    {['male', 'female'].map(g => (
                      <button key={g} onClick={() => setData({ ...data, gender: g })}
                        className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${data.gender === g ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-gray-900 text-gray-400 border border-gray-800 hover:border-gray-700'}`}>
                        {g === 'male' ? 'Male' : 'Female'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Height (cm)</label>
                  <input type="number" value={data.height_cm} onChange={(e) => setData({ ...data, height_cm: e.target.value })} placeholder="165" className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Current Weight (kg)</label>
                  <input type="number" step="0.1" value={data.weight_kg} onChange={(e) => setData({ ...data, weight_kg: e.target.value })} placeholder="60" className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Weight (kg) <span className="text-gray-600">— optional</span></label>
                <input type="number" step="0.1" value={data.target_weight_kg} onChange={(e) => setData({ ...data, target_weight_kg: e.target.value })} placeholder="65" className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Body Type + Experience */}
        {step === 2 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-white mb-2">Where are you now?</h1>
            <p className="text-gray-400 text-sm mb-6">Pick what best describes your current physique.</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {BODY_TYPES.map(bt => (
                <button key={bt.id} onClick={() => setData({ ...data, body_type: bt.id })}
                  className={`p-4 rounded-xl border text-center transition-all ${data.body_type === bt.id ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                  <div className="text-2xl mb-2">{bt.img}</div>
                  <div className="text-sm font-medium text-white">{bt.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{bt.desc}</div>
                </button>
              ))}
            </div>

            <h2 className="text-lg font-semibold text-white mb-3">Training Experience</h2>
            <div className="space-y-2">
              {EXPERIENCE_LEVELS.map(exp => (
                <button key={exp.id} onClick={() => setData({ ...data, experience_level: exp.id })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${data.experience_level === exp.id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                  <div className={`w-3 h-3 rounded-full ${data.experience_level === exp.id ? 'bg-emerald-400' : 'bg-gray-700'}`} />
                  <div>
                    <div className="text-sm font-medium text-white">{exp.label}</div>
                    <div className="text-xs text-gray-500">{exp.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Diet + Activity */}
        {step === 3 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-white mb-2">Lifestyle</h1>
            <p className="text-gray-400 text-sm mb-6">This helps us recommend the right foods and calories.</p>

            <h2 className="text-lg font-semibold text-white mb-3">Diet Preference</h2>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {DIET_TYPES.map(d => (
                <button key={d.id} onClick={() => setData({ ...data, diet_type: d.id })}
                  className={`p-3 rounded-xl border text-center transition-all ${data.diet_type === d.id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                  <div className="text-xl mb-1">{d.icon}</div>
                  <div className="text-sm font-medium text-white">{d.label}</div>
                </button>
              ))}
            </div>

            <h2 className="text-lg font-semibold text-white mb-3">Activity Level</h2>
            <div className="space-y-2">
              {ACTIVITY_LEVELS.map(a => (
                <button key={a.id} onClick={() => setData({ ...data, activity_level: a.id })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${data.activity_level === a.id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
                  <Activity className={`w-5 h-5 ${data.activity_level === a.id ? 'text-emerald-400' : 'text-gray-600'}`} />
                  <div>
                    <div className="text-sm font-medium text-white">{a.label}</div>
                    <div className="text-xs text-gray-500">{a.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Review & Custom Targets */}
        {step === 4 && (
          <div className="animate-in">
            <h1 className="text-2xl font-bold text-white mb-2">Your Plan</h1>
            <p className="text-gray-400 text-sm mb-6">We've calculated your targets. Adjust if needed.</p>

            {(() => {
              const t = calcTargets()
              return (
                <div className="space-y-4">
                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-bold text-emerald-400">{t.calories}</div>
                        <div className="text-xs text-gray-500">Calories/day</div>
                      </div>
                      <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-400">{t.proteinG}g</div>
                        <div className="text-xs text-gray-500">Protein</div>
                      </div>
                      <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-400">{t.carbsG}g</div>
                        <div className="text-xs text-gray-500">Carbs</div>
                      </div>
                      <div className="text-center p-3 bg-gray-800/50 rounded-lg">
                        <div className="text-2xl font-bold text-red-400">{t.fatG}g</div>
                        <div className="text-xs text-gray-500">Fat</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Goal Deadline <span className="text-gray-600">— optional</span></label>
                    <input type="date" value={data.deadline} onChange={(e) => setData({ ...data, deadline: e.target.value })} className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>

                  <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">Goal</span><span className="text-white capitalize">{(data.goal || '').replace('_', ' ')}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Body Type</span><span className="text-white capitalize">{data.body_type}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Diet</span><span className="text-white capitalize">{(data.diet_type || '').replace('_', ' ')}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Activity</span><span className="text-white capitalize">{(data.activity_level || '').replace('_', ' ')}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Stats</span><span className="text-white">{data.age}yo · {data.height_cm}cm · {data.weight_kg}kg</span></div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded-xl transition-colors text-sm font-medium border border-gray-800">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          )}
          {step < totalSteps - 1 ? (
            <button onClick={() => setStep(step + 1)}
              disabled={step === 0 && !data.goal}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl transition-colors text-sm font-medium">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={finish} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl transition-colors text-sm font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              {saving ? 'Setting up...' : "Let's Go!"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
