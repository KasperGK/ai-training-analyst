import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import type { PlanDay } from '@/types'

const typeColors: Record<string, { border: string; bg: string; text: string; darkBg: string; darkText: string }> = {
  recovery: { border: 'border-l-green-400', bg: 'bg-green-50', text: 'text-green-700', darkBg: 'dark:bg-green-950/40', darkText: 'dark:text-green-300' },
  endurance: { border: 'border-l-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', darkBg: 'dark:bg-blue-950/40', darkText: 'dark:text-blue-300' },
  endurance_long: { border: 'border-l-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', darkBg: 'dark:bg-blue-950/40', darkText: 'dark:text-blue-300' },
  tempo: { border: 'border-l-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', darkBg: 'dark:bg-yellow-950/40', darkText: 'dark:text-yellow-300' },
  tempo_progression: { border: 'border-l-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700', darkBg: 'dark:bg-yellow-950/40', darkText: 'dark:text-yellow-300' },
  sweetspot: { border: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', darkBg: 'dark:bg-orange-950/40', darkText: 'dark:text-orange-300' },
  sweetspot_2x20: { border: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', darkBg: 'dark:bg-orange-950/40', darkText: 'dark:text-orange-300' },
  sweetspot_3x15: { border: 'border-l-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', darkBg: 'dark:bg-orange-950/40', darkText: 'dark:text-orange-300' },
  sweetspot_over_under: { border: 'border-l-orange-500', bg: 'bg-orange-50', text: 'text-orange-700', darkBg: 'dark:bg-orange-950/40', darkText: 'dark:text-orange-300' },
  threshold: { border: 'border-l-red-400', bg: 'bg-red-50', text: 'text-red-700', darkBg: 'dark:bg-red-950/40', darkText: 'dark:text-red-300' },
  threshold_2x20: { border: 'border-l-red-400', bg: 'bg-red-50', text: 'text-red-700', darkBg: 'dark:bg-red-950/40', darkText: 'dark:text-red-300' },
  threshold_3x12: { border: 'border-l-red-400', bg: 'bg-red-50', text: 'text-red-700', darkBg: 'dark:bg-red-950/40', darkText: 'dark:text-red-300' },
  intervals: { border: 'border-l-purple-400', bg: 'bg-purple-50', text: 'text-purple-700', darkBg: 'dark:bg-purple-950/40', darkText: 'dark:text-purple-300' },
  vo2max_5x5: { border: 'border-l-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', darkBg: 'dark:bg-purple-950/40', darkText: 'dark:text-purple-300' },
  vo2max_4x4: { border: 'border-l-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', darkBg: 'dark:bg-purple-950/40', darkText: 'dark:text-purple-300' },
  vo2max_3x3: { border: 'border-l-purple-500', bg: 'bg-purple-50', text: 'text-purple-700', darkBg: 'dark:bg-purple-950/40', darkText: 'dark:text-purple-300' },
}

const defaultColors = { border: 'border-l-gray-400', bg: 'bg-gray-50', text: 'text-gray-700', darkBg: 'dark:bg-gray-800/40', darkText: 'dark:text-gray-300' }

function getDisplayName(day: PlanDay): string {
  if (day.workout_name) return day.workout_name
  if (day.workout_type) {
    return day.workout_type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }
  return 'Workout'
}

interface WorkoutPillProps {
  day: PlanDay
  onClick?: () => void
}

export function WorkoutPill({ day, onClick }: WorkoutPillProps) {
  const colors = typeColors[day.workout_type || ''] || defaultColors
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isMissed = !day.completed && !day.skipped && day.date < todayStr
  const isSkipped = day.skipped
  const isCompleted = day.completed

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2.5 py-1.5 rounded-md text-sm leading-tight',
        'border-l-[3px] transition-colors',
        colors.border, colors.bg, colors.text, colors.darkBg, colors.darkText,
        isSkipped && 'opacity-50 line-through',
        isMissed && 'bg-red-50/80 dark:bg-red-950/30',
        onClick && 'hover:brightness-95 dark:hover:brightness-110 cursor-pointer',
      )}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="truncate font-medium">{getDisplayName(day)}</span>
        {isCompleted && <Check className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />}
        {isMissed && !isSkipped && <X className="size-3.5 shrink-0 text-red-500" />}
      </span>
      {(day.target_tss || day.target_duration_minutes) && (
        <span className="text-xs text-muted-foreground mt-0.5 block">
          {day.target_tss ? `${day.target_tss} TSS` : ''}
          {day.target_tss && day.target_duration_minutes ? ' · ' : ''}
          {day.target_duration_minutes ? `${day.target_duration_minutes}m` : ''}
        </span>
      )}
    </button>
  )
}
