import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { USER_DEFAULTS, MEAL_TYPES, MEAL_ICONS } from '../lib/constants'
import MacroRing from '../components/MacroRing'
import { format } from 'date-fns'
import { Search, Plus, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function Nutrition() {
  const { user, profile } = useAuth()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [foodLog, setFoodLog] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMeal, setSelectedMeal] = useState('breakfast')
  const [showAdd, setShowAdd] = useState(false)
  const [customFood, setCustomFood] = useState({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', servings: 1 })
  const [showCustom, setShowCustom] = useState(false)
  const searchRef = useRef(null)

  const targets = {
    calories: profile?.target_calories || USER_DEFAULTS.target_calories,
    protein: profile?.target_protein_g || USER_DEFAULTS.target_protein_g,
    carbs: profile?.target_carbs_g || USER_DEFAULTS.target_carbs_g,
    fat: profile?.target_fat_g || USER_DEFAULTS.target_fat_g,
  }

  useEffect(() => {
    if (user) loadFoodLog()
  }, [user, date])

  async function loadFoodLog() {
    const { data } = await supabase
      .from('food_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('logged_at', date)
      .order('created_at')
    setFoodLog(data || [])
  }

  async function searchFoods(query) {
    if (query.length < 2) { setSearchResults([]); return }
    const { data } = await supabase
      .from('foods')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(15)
    setSearchResults(data || [])
  }

  useEffect(() => {
    const timer = setTimeout(() => searchFoods(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  async function addFood(food) {
    const servings = food.servings || 1
    await supabase.from('food_log').insert({
      user_id: user.id,
      food_id: food.id || null,
      custom_name: food.id ? null : food.name,
      meal_type: selectedMeal,
      servings,
      calories: food.calories_per_serving ? food.calories_per_serving * servings : Number(food.calories),
      protein_g: (food.protein_g || 0) * servings,
      carbs_g: (food.carbs_g || 0) * servings,
      fat_g: (food.fat_g || 0) * servings,
      logged_at: date,
    })
    setSearchQuery('')
    setSearchResults([])
    setShowAdd(false)
    setShowCustom(false)
    loadFoodLog()
  }

  async function addCustomFood() {
    await supabase.from('food_log').insert({
      user_id: user.id,
      custom_name: customFood.name,
      meal_type: selectedMeal,
      servings: Number(customFood.servings) || 1,
      calories: Number(customFood.calories),
      protein_g: Number(customFood.protein_g) || 0,
      carbs_g: Number(customFood.carbs_g) || 0,
      fat_g: Number(customFood.fat_g) || 0,
      logged_at: date,
    })
    setCustomFood({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', servings: 1 })
    setShowCustom(false)
    setShowAdd(false)
    loadFoodLog()
  }

  async function removeFood(id) {
    await supabase.from('food_log').delete().eq('id', id)
    loadFoodLog()
  }

  function changeDate(offset) {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    setDate(format(d, 'yyyy-MM-dd'))
  }

  const totals = foodLog.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories),
    protein: acc.protein + Number(f.protein_g),
    carbs: acc.carbs + Number(f.carbs_g),
    fat: acc.fat + Number(f.fat_g),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  const mealGroups = MEAL_TYPES.reduce((acc, meal) => {
    acc[meal] = foodLog.filter(f => f.meal_type === meal)
    return acc
  }, {})

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Nutrition Tracker</h1>

      {/* Date Picker */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Macro Summary */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 justify-items-center">
          <MacroRing label="Calories" current={totals.calories} target={targets.calories} color="#10b981" unit="kcal" />
          <MacroRing label="Protein" current={totals.protein} target={targets.protein} color="#3b82f6" />
          <MacroRing label="Carbs" current={totals.carbs} target={targets.carbs} color="#f59e0b" />
          <MacroRing label="Fat" current={totals.fat} target={targets.fat} color="#ef4444" />
        </div>
      </div>

      {/* Meals */}
      {MEAL_TYPES.map(meal => (
        <div key={meal} className="bg-gray-900 rounded-2xl border border-gray-800 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold text-white capitalize flex items-center gap-2">
              <span>{MEAL_ICONS[meal]}</span> {meal}
              <span className="text-xs text-gray-500 font-normal">
                {Math.round(mealGroups[meal].reduce((s, f) => s + Number(f.calories), 0))} kcal
              </span>
            </h3>
            <button
              onClick={() => { setSelectedMeal(meal); setShowAdd(true) }}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors text-emerald-400"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {mealGroups[meal].length > 0 ? (
            <div className="space-y-2">
              {mealGroups[meal].map(item => (
                <div key={item.id} className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <div className="text-sm text-white">{item.custom_name || 'Food'}</div>
                    <div className="text-xs text-gray-500">
                      {Math.round(item.calories)} kcal · {Math.round(item.protein_g)}p · {Math.round(item.carbs_g)}c · {Math.round(item.fat_g)}f
                    </div>
                  </div>
                  <button
                    onClick={() => removeFood(item.id)}
                    className="p-1 text-gray-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No items logged</p>
          )}
        </div>
      ))}

      {/* Add Food Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Add to {MEAL_ICONS[selectedMeal]} {selectedMeal}
              </h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search foods (e.g. paneer, dal, roti)..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Results */}
              {searchResults.length > 0 && (
                <div className="mb-4 space-y-1 max-h-60 overflow-y-auto">
                  {searchResults.map(food => (
                    <button
                      key={food.id}
                      onClick={() => addFood({ ...food, servings: 1 })}
                      className="w-full text-left px-4 py-3 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      <div className="text-sm text-white font-medium">{food.name}</div>
                      <div className="text-xs text-gray-500">
                        {food.serving_size} · {food.calories_per_serving} kcal · {food.protein_g}p · {food.carbs_g}c · {food.fat_g}f
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Add Custom */}
              <button
                onClick={() => setShowCustom(!showCustom)}
                className="w-full py-2.5 border border-dashed border-gray-700 rounded-lg text-sm text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
              >
                + Quick add custom food
              </button>

              {showCustom && (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Food name"
                    value={customFood.name}
                    onChange={(e) => setCustomFood({ ...customFood, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder="Calories" value={customFood.calories} onChange={(e) => setCustomFood({ ...customFood, calories: e.target.value })} className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <input type="number" placeholder="Protein (g)" value={customFood.protein_g} onChange={(e) => setCustomFood({ ...customFood, protein_g: e.target.value })} className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <input type="number" placeholder="Carbs (g)" value={customFood.carbs_g} onChange={(e) => setCustomFood({ ...customFood, carbs_g: e.target.value })} className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <input type="number" placeholder="Fat (g)" value={customFood.fat_g} onChange={(e) => setCustomFood({ ...customFood, fat_g: e.target.value })} className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <button
                    onClick={addCustomFood}
                    disabled={!customFood.name || !customFood.calories}
                    className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                  >
                    Add Food
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
