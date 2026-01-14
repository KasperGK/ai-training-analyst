'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Circle,
  Dumbbell,
  Bike,
  Zap,
  Heart,
  Trophy,
} from 'lucide-react'
import type { PlanDay } from '@/types'

interface CalendarGridProps {
  days: PlanDay[]
  viewMode: '3day' | 'week' | 'month'
  selectedDate: string | null
  onSelectDay: (day: PlanDay) => void
  events?: Array<{ date: string; name: string; priority: string }>
}

const workoutTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  recovery: Heart,
  endurance: Bike,
  tempo: Bike,
  sweetspot: Zap,
  threshold: Zap,
  vo2max: Dumbbell,
  anaerobic: Dumbbell,
  sprint: Zap,
}

const workoutTypeColors: Record<string, string> = {
  recovery: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  endurance: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  tempo: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  sweetspot: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  threshold: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  vo2max: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  anaerobic: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  sprint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
}

function getDayStatus(day: PlanDay): 'completed' | 'skipped' | 'missed' | 'upcoming' | 'rest' {
  if (!day.workout_name) return 'rest'
  if (day.completed) return 'completed'
  if (day.skipped) return 'skipped'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayDate = new Date(day.date)

  if (dayDate < today) return 'missed'
  return 'upcoming'
}

function StatusIcon({ status }: { status: ReturnType<typeof getDayStatus> }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'skipped':
      return <XCircle className="h-4 w-4 text-yellow-500" />
    case 'missed':
      return <XCircle className="h-4 w-4 text-red-500" />
    case 'upcoming':
      return <Circle className="h-4 w-4 text-blue-500" />
    default:
      return null
  }
}

export function CalendarGrid({
  days,
  viewMode,
  selectedDate,
  onSelectDay,
  events = [],
}: CalendarGridProps) {
  const daysByDate = new Map(days.map(d => [d.date, d]))
  const eventsByDate = new Map(events.map(e => [e.date, e]))

  // Generate dates for the view
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let displayDates: Date[] = []

  if (viewMode === '3day') {
    // Yesterday, today, tomorrow
    for (let i = -1; i <= 1; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      displayDates.push(d)
    }
  } else if (viewMode === 'week') {
    // Current week (Mon-Sun)
    const weekStart = new Date(today)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)) // Monday
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      displayDates.push(d)
    }
  } else {
    // Month view
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    // Start from Monday of first week
    const calStart = new Date(monthStart)
    calStart.setDate(calStart.getDate() - ((calStart.getDay() + 6) % 7))

    for (let i = 0; i < 42; i++) { // 6 weeks max
      const d = new Date(calStart)
      d.setDate(d.getDate() + i)
      if (d > monthEnd && d.getDay() === 1) break // Stop at week after month ends
      displayDates.push(d)
    }
  }

  const gridCols = viewMode === '3day' ? 'grid-cols-3' : 'grid-cols-7'

  const dayNames = viewMode === '3day'
    ? ['Yesterday', 'Today', 'Tomorrow']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-2">
      {/* Day headers */}
      <div className={cn('grid gap-1', gridCols)}>
        {dayNames.map((name, i) => (
          <div
            key={i}
            className="text-xs font-medium text-muted-foreground text-center py-1"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={cn('grid gap-1', gridCols)}>
        {displayDates.map((date) => {
          const dateStr = date.toISOString().split('T')[0]
          const day = daysByDate.get(dateStr)
          const event = eventsByDate.get(dateStr)
          const isToday = date.getTime() === today.getTime()
          const isSelected = dateStr === selectedDate
          const status = day ? getDayStatus(day) : 'rest'
          const WorkoutIcon = day?.workout_type
            ? workoutTypeIcons[day.workout_type] || Bike
            : null

          return (
            <button
              key={dateStr}
              onClick={() => day && onSelectDay(day)}
              disabled={!day}
              className={cn(
                'relative p-2 rounded-lg border text-left transition-colors min-h-[80px]',
                viewMode === 'month' && 'min-h-[60px]',
                isToday && 'ring-2 ring-blue-500',
                isSelected && 'bg-accent',
                status === 'completed' && 'border-green-200 bg-green-50 dark:bg-green-950/20',
                status === 'missed' && 'border-red-200 bg-red-50 dark:bg-red-950/20',
                status === 'skipped' && 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20',
                status === 'upcoming' && 'border-blue-200 bg-blue-50 dark:bg-blue-950/20',
                status === 'rest' && 'border-gray-200 bg-gray-50 dark:bg-gray-950/20',
                !day && 'opacity-50 cursor-default'
              )}
            >
              {/* Date number */}
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-xs font-medium',
                  isToday && 'text-blue-600 dark:text-blue-400'
                )}>
                  {date.getDate()}
                </span>
                {day && <StatusIcon status={status} />}
              </div>

              {/* Event indicator */}
              {event && (
                <div className="absolute top-1 right-1">
                  <Trophy className={cn(
                    'h-3 w-3',
                    event.priority === 'A' ? 'text-amber-500' : 'text-gray-400'
                  )} />
                </div>
              )}

              {/* Workout info */}
              {day?.workout_name && (
                <div className="mt-1 space-y-1">
                  {WorkoutIcon && (
                    <div className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
                      workoutTypeColors[day.workout_type || ''] || 'bg-gray-100'
                    )}>
                      <WorkoutIcon className="h-3 w-3" />
                      {viewMode !== 'month' && (
                        <span className="truncate max-w-[60px]">
                          {day.workout_type}
                        </span>
                      )}
                    </div>
                  )}
                  {viewMode !== 'month' && (
                    <div className="text-xs truncate text-muted-foreground">
                      {day.target_tss && `${day.target_tss} TSS`}
                    </div>
                  )}
                </div>
              )}

              {!day?.workout_name && day && (
                <div className="mt-2 text-xs text-muted-foreground">Rest</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
