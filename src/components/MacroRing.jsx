export default function MacroRing({ label, current, target, color, unit = 'g' }) {
  const pct = Math.min((current / target) * 100, 100)
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const isOver = current > target

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke="currentColor"
            className="text-gray-800"
            strokeWidth="6"
          />
          <circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={isOver ? '#ef4444' : color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-white">{Math.round(current)}</span>
          <span className="text-xs text-gray-500">{unit}</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-sm font-medium text-gray-300">{label}</div>
        <div className="text-xs text-gray-500">
          {Math.round(current)} / {target}{unit === 'kcal' ? '' : unit}
        </div>
      </div>
    </div>
  )
}
