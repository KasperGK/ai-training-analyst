import { cn } from '@/lib/utils'
import { CalendarCell } from './calendar-cell'
import type { CalendarDayData } from '@/hooks/use-calendar-data'
import type { PlanDay } from '@/types'

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface WeekCalendarGridProps {
  weekStartDate: Date
  weekDates: string[]
  today: string
  dayMap: Map<string, CalendarDayData>
  onSelectDay?: (day: PlanDay) => void
  onClickDate?: (date: string) => void
  className?: string
}

export function WeekCalendarGrid({
  weekStartDate,
  weekDates,
  today,
  dayMap,
  onSelectDay,
  onClickDate,
  className,
}: WeekCalendarGridProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header row */}
      <div
        className="shrink-0 grid border border-border/50 rounded-t-lg bg-muted/50"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
      >
        {DAY_HEADERS.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-xs font-medium text-muted-foreground uppercase tracking-wider p-2 text-center',
              i < 6 && 'border-r border-border/50',
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Single week row — fills remaining height */}
      <div
        className="flex-1 min-h-0 border-x border-b border-border/50 rounded-b-lg"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gridTemplateRows: '1fr',
          minHeight: 200,
        }}
      >
        {weekDates.map((dateStr, dayIdx) => (
          <CalendarCell
            key={dateStr}
            date={dateStr}
            dayData={dayMap.get(dateStr)}
            isCurrentMonth={true}
            isToday={dateStr === today}
            isLastRow={true}
            isLastColumn={dayIdx === 6}
            onSelectDay={onSelectDay}
            onClickDate={onClickDate}
          />
        ))}
      </div>
    </div>
  )
}

// Keep the old export name as an alias for backwards compatibility during transition
export { WeekCalendarGrid as MonthCalendarGrid }
