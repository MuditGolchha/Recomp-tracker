export const USER_DEFAULTS = {
  name: 'Mudit',
  height_cm: 165,
  start_weight_kg: 60.0,
  target_calories: 1950,
  target_protein_g: 130,
  target_carbs_g: 175,
  target_fat_g: 55,
  goal: 'Body recomp — visible abs by June 9, 2026',
  is_vegetarian: true,
}

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_ICONS = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍿',
}

export const QUALITY_LABELS = {
  1: 'Terrible',
  2: 'Poor',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
}

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/nutrition', label: 'Nutrition', icon: 'Utensils' },
  { path: '/gym', label: 'Gym', icon: 'Dumbbell' },
  { path: '/sleep', label: 'Sleep', icon: 'Moon' },
  { path: '/progress', label: 'Progress', icon: 'TrendingUp' },
  { path: '/coach', label: 'AI Coach', icon: 'Bot' },
]
