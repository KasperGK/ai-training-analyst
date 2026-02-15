import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { TrainingPlan } from '@/types'

const MONTH_NAMES_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

interface CalendarToolbarProps {
  weekStartDate: Date
  plan: TrainingPlan | null
  planProgress?: number
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
  events?: Array<{ date: string; name: string; priority: string }>
  today?: string
}

export function CalendarToolbar({
  weekStartDate,
  plan,
  planProgress,
  onPrevWeek,
  onNextWeek,
  onToday,
  events,
  today,
}: CalendarToolbarProps) {
  const progress = planProgress ?? plan?.progress_percent ?? 0

  // Compute week end (Sunday)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekStartDate.getDate() + 6)

  const weekNum = getISOWeekNumber(weekStartDate)
  const startDay = weekStartDate.getDate()
  const endDay = weekEndDate.getDate()
  const startMonth = MONTH_NAMES_SHORT[weekStartDate.getMonth()]
  const endMonth = MONTH_NAMES_SHORT[weekEndDate.getMonth()]

  // Format: "week 6 · feb 3–9" or "week 6 · jan 27 – feb 2" if spanning months
  const dateRange = startMonth === endMonth
    ? `${startMonth} ${startDay}–${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`

  const title = `week ${weekNum} · ${dateRange}`

  // Next upcoming event
  const nextEvent = (() => {
    if (!events || !today) return null
    const now = new Date(today + 'T12:00:00')
    const upcoming = events
      .filter(e => new Date(e.date) > now)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (upcoming.length === 0) return null
    const e = upcoming[0]
    const weeks = Math.ceil((new Date(e.date).getTime() - now.getTime()) / (7 * 86400000))
    return { name: e.name, weeksUntil: weeks }
  })()

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Left: week title + nav */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-light tracking-tight lowercase">
          {title}
        </h1>
        <div className="flex items-center gap-0.5 ml-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={onPrevWeek}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onToday}>
            This Week
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={onNextWeek}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Right: plan badge + next event */}
      <div className="flex items-center gap-3">
        {/* Plan badge */}
        {plan && (
          <Badge variant="secondary" className="text-xs font-normal">
            {plan.name} · {Math.round(progress)}%
          </Badge>
        )}

        {/* Next event chip */}
        {nextEvent && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trophy className="size-3.5" />
            <span className="truncate max-w-[140px]">{nextEvent.name}</span>
            <span className="text-foreground font-medium">{nextEvent.weeksUntil}w</span>
          </div>
        )}
      </div>
    </div>
  )
}
