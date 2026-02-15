import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { WorkoutPill } from './workout-pill'
import { SessionPill } from './session-pill'
import { EventMarker } from './event-marker'
import type { CalendarDayData } from '@/hooks/use-calendar-data'
import type { PlanDay } from '@/types'

interface CalendarCellProps {
  date: string // YYYY-MM-DD
  dayData?: CalendarDayData
  isCurrentMonth: boolean
  isToday: boolean
  isLastRow?: boolean
  isLastColumn?: boolean
  onSelectDay?: (day: PlanDay) => void
  onClickDate?: (date: string) => void
}

export function CalendarCell({
  date,
  dayData,
  isCurrentMonth,
  isToday,
  isLastRow,
  isLastColumn,
  onSelectDay,
  onClickDate,
}: CalendarCellProps) {
  const dayNumber = parseInt(date.split('-')[2], 10)

  const items = useMemo(() => {
    const result: Array<{ type: 'event' | 'workout' | 'session'; key: string }> = []
    if (dayData?.event) result.push({ type: 'event', key: 'event' })
    if (dayData?.planDay && dayData.planDay.workout_type !== 'rest') result.push({ type: 'workout', key: 'workout' })
    if (dayData?.sessions) {
      for (const s of dayData.sessions) result.push({ type: 'session', key: s.id })
    }
    return result
  }, [dayData])

  return (
    <div
      className={cn(
        'p-3 flex flex-col',
        !isLastRow && 'border-b border-border/50',
        !isLastColumn && 'border-r border-border/50',
        !isCurrentMonth && 'opacity-40',
        isToday && 'bg-red-50/50 dark:bg-red-950/20',
        onClickDate && 'cursor-pointer hover:bg-muted/50 transition-colors',
      )}
      onClick={() => onClickDate?.(date)}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            !isCurrentMonth && 'text-muted-foreground/50',
            isCurrentMonth && 'text-foreground',
            isToday && 'bg-red-500 text-white rounded-full size-6 flex items-center justify-center text-xs',
          )}
        >
          {dayNumber}.
        </span>
      </div>

      {/* Content pills */}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {items.map(item => {
          if (item.type === 'event' && dayData?.event) {
            return <EventMarker key={item.key} name={dayData.event.name} priority={dayData.event.priority} />
          }
          if (item.type === 'workout' && dayData?.planDay) {
            return (
              <WorkoutPill
                key={item.key}
                day={dayData.planDay}
                onClick={onSelectDay ? () => onSelectDay(dayData.planDay!) : undefined}
              />
            )
          }
          if (item.type === 'session') {
            const session = dayData?.sessions.find(s => s.id === item.key)
            if (session) return <SessionPill key={item.key} session={session} />
          }
          return null
        })}
      </div>
    </div>
  )
}
