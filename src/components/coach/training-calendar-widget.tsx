'use client'

/**
 * Training Calendar Widget
 *
 * macOS/iOS-style month calendar showing:
 * - Workout days with colored category bars
 * - Event markers (trophy icons for A-priority)
 * - Completed day checkmarks
 * - Day detail panel on click
 * - Export to .ics button
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Check,
  Download,
  Loader2,
} from 'lucide-react'

interface PlanDay {
  id: string
  date: string
  week_number: number
  day_of_week: number
  workout_name: string | null
  workout_type: string | null
  target_tss: number | null
  target_duration_minutes: number | null
  completed: boolean
  skipped: boolean
}

interface PlanEvent {
  date: string
  name: string
  priority: string
}

interface ActivePlan {
  id: string
  name: string
  start_date: string
  end_date: string
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const workoutTypeColors: Record<string, string> = {
  endurance: 'bg-blue-500',
  tempo: 'bg-yellow-500',
  threshold: 'bg-orange-500',
  vo2max: 'bg-red-500',
  sprint: 'bg-purple-500',
  recovery: 'bg-green-500',
  rest: 'bg-gray-300 dark:bg-gray-600',
  race: 'bg-amber-500',
  sweetspot: 'bg-orange-400',
  strength: 'bg-indigo-500',
}

function getWorkoutColor(type: string | null): string {
  if (!type) return 'bg-muted-foreground/30'
  const lower = type.toLowerCase()
  for (const [key, color] of Object.entries(workoutTypeColors)) {
    if (lower.includes(key)) return color
  }
  return 'bg-blue-400'
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday = 0, Sunday = 6 (ISO week)
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = []

  // Previous month padding
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false })
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true })
  }

  // Next month padding (complete the final row)
  let nextMonthDay = 1
  while (days.length % 7 !== 0) {
    days.push({ date: new Date(year, month + 1, nextMonthDay++), isCurrentMonth: false })
  }

  return days
}

function dateToStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function TrainingCalendarWidget() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [plan, setPlan] = useState<ActivePlan | null>(null)
  const [planDays, setPlanDays] = useState<PlanDay[]>([])
  const [events, setEvents] = useState<PlanEvent[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = dateToStr(new Date())

  // Fetch active plan data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        // GET /api/training-plans returns active plan with days and events
        const res = await fetch('/api/training-plans')
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()

        if (!data.plan) {
          setLoading(false)
          return
        }

        setPlan({
          id: data.plan.id,
          name: data.plan.name,
          start_date: data.plan.start_date,
          end_date: data.plan.end_date,
        })

        setPlanDays(data.days || [])
        setEvents(
          (data.events || []).map((e: { date: string; name: string; priority: string }) => ({
            date: e.date,
            name: e.name,
            priority: e.priority,
          }))
        )
      } catch (error) {
        console.error('Failed to load calendar data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const monthDays = useMemo(() => getMonthDays(year, month), [year, month])

  // Index plan days and events by date for O(1) lookup
  const daysByDate = useMemo(() => {
    const map = new Map<string, PlanDay>()
    for (const d of planDays) {
      map.set(d.date, d)
    }
    return map
  }, [planDays])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, PlanEvent[]>()
    for (const e of events) {
      const existing = map.get(e.date) || []
      existing.push(e)
      map.set(e.date, existing)
    }
    return map
  }, [events])

  const navigateMonth = useCallback((delta: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
    setSelectedDate(null)
  }, [])

  const handleExport = useCallback(async () => {
    if (!plan) return
    setExporting(true)
    try {
      const res = await fetch(`/api/training-plans/${plan.id}/export`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'training-plan.ics'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to export calendar:', error)
    } finally {
      setExporting(false)
    }
  }, [plan])

  // Selected day details
  const selectedDayData = selectedDate ? daysByDate.get(selectedDate) : null
  const selectedDayEvents = selectedDate ? eventsByDate.get(selectedDate) || [] : []

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">No active training plan</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header: Month navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{monthName}</h3>
          <p className="text-xs text-muted-foreground">{plan.name}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setCurrentDate(new Date())
              setSelectedDate(null)
            }}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigateMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl overflow-hidden border border-border">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {DAY_HEADERS.map(day => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px bg-border">
          {monthDays.map(({ date, isCurrentMonth }, i) => {
            const dateStr = dateToStr(date)
            const planDay = daysByDate.get(dateStr)
            const dayEvents = eventsByDate.get(dateStr) || []
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const hasAEvent = dayEvents.some(e => e.priority === 'A')

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                className={cn(
                  'min-h-[72px] p-1.5 text-left bg-background transition-colors relative',
                  !isCurrentMonth && 'opacity-40',
                  isSelected && 'ring-2 ring-primary ring-inset',
                  !isSelected && 'hover:bg-muted/30'
                )}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      isToday
                        ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-semibold'
                        : 'text-muted-foreground'
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {planDay?.completed && (
                    <Check className="h-3 w-3 text-green-500" />
                  )}
                </div>

                {/* Workout bar */}
                {planDay?.workout_name && (
                  <div className="space-y-0.5">
                    <div
                      className={cn(
                        'h-1 rounded-full',
                        getWorkoutColor(planDay.workout_type)
                      )}
                    />
                    <p className="text-[10px] leading-tight truncate text-muted-foreground">
                      {planDay.workout_name}
                    </p>
                  </div>
                )}

                {/* Event indicator */}
                {dayEvents.length > 0 && (
                  <div className="absolute bottom-1 right-1">
                    <Trophy
                      className={cn(
                        'h-3 w-3',
                        hasAEvent ? 'text-amber-500' : 'text-muted-foreground/60'
                      )}
                    />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selectedDate && (selectedDayData || selectedDayEvents.length > 0) && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-medium">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </h4>

          {selectedDayData?.workout_name && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    getWorkoutColor(selectedDayData.workout_type)
                  )}
                />
                <span className="text-sm font-medium">{selectedDayData.workout_name}</span>
                {selectedDayData.completed && (
                  <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded">
                    Done
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground ml-4">
                {selectedDayData.workout_type && (
                  <span className="capitalize">{selectedDayData.workout_type}</span>
                )}
                {selectedDayData.target_duration_minutes && (
                  <span>{formatDuration(selectedDayData.target_duration_minutes)}</span>
                )}
                {selectedDayData.target_tss && (
                  <span>{selectedDayData.target_tss} TSS</span>
                )}
              </div>
            </div>
          )}

          {selectedDayEvents.map((event, i) => (
            <div key={i} className="flex items-center gap-2">
              <Trophy
                className={cn(
                  'h-4 w-4 shrink-0',
                  event.priority === 'A' ? 'text-amber-500' : 'text-muted-foreground/60'
                )}
              />
              <span className="text-sm">{event.name}</span>
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                {event.priority}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Export button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export to Calendar
        </Button>
      </div>
    </div>
  )
}
