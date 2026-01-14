'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  Circle,
  ChevronRight,
  Clock,
  Zap,
} from 'lucide-react'
import type { PlanDay } from '@/types'

interface WorkoutListProps {
  days: PlanDay[]
  selectedDate: string | null
  onSelectDay: (day: PlanDay) => void
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

const statusColors = {
  completed: 'text-green-500',
  skipped: 'text-yellow-500',
  missed: 'text-red-500',
  upcoming: 'text-blue-500',
  rest: 'text-gray-400',
}

const statusIcons = {
  completed: CheckCircle2,
  skipped: XCircle,
  missed: XCircle,
  upcoming: Circle,
  rest: Circle,
}

export function WorkoutList({ days, selectedDate, onSelectDay }: WorkoutListProps) {
  // Filter to only days with workouts
  const workoutDays = days.filter(d => d.workout_name)

  if (workoutDays.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No workouts scheduled for this period
      </div>
    )
  }

  // Group by week
  const weekGroups: Map<number, PlanDay[]> = new Map()
  workoutDays.forEach(day => {
    const week = day.week_number
    if (!weekGroups.has(week)) {
      weekGroups.set(week, [])
    }
    weekGroups.get(week)!.push(day)
  })

  return (
    <div className="space-y-4">
      {Array.from(weekGroups.entries()).map(([weekNum, weekDays]) => (
        <div key={weekNum} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground px-2">
            Week {weekNum}
          </div>
          <div className="space-y-1">
            {weekDays.map(day => {
              const status = getDayStatus(day)
              const StatusIcon = statusIcons[status]
              const isSelected = day.date === selectedDate
              const dayDate = new Date(day.date)

              return (
                <button
                  key={day.id}
                  onClick={() => onSelectDay(day)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                    'hover:bg-accent hover:text-accent-foreground',
                    isSelected && 'bg-accent',
                    status === 'completed' && 'border-green-200',
                    status === 'missed' && 'border-red-200',
                    status === 'skipped' && 'border-yellow-200'
                  )}
                >
                  <StatusIcon className={cn('h-5 w-5', statusColors[status])} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{day.workout_name}</span>
                      {day.workout_type && (
                        <Badge variant="secondary" className="text-xs">
                          {day.workout_type}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dayDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {day.target_duration_minutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{day.target_duration_minutes}m</span>
                      </div>
                    )}
                    {day.target_tss && (
                      <div className="flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" />
                        <span>{day.target_tss}</span>
                      </div>
                    )}
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
